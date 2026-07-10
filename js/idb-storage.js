// idb-storage.js — couche de persistance principale, basée sur IndexedDB.
// Pourquoi : localStorage plafonne à ~5-10 Mo et est synchrone (peut geler
// l'UI sur un gros document) ; IndexedDB tient des centaines de Mo et est
// asynchrone. On garde storage.js (localStorage) comme filet de sécurité
// pour les navigateurs/contextes où IndexedDB est indisponible (certains
// modes de navigation privée stricte, ou pages ouvertes en file://).
//
// Deux magasins :
//   - "doc"      : le document courant, une seule entrée (clé fixe 'current')
//   - "versions" : un historique d'instantanés, pour revenir en arrière si
//                  besoin — indépendant de l'undo de l'éditeur, qui ne
//                  survit pas à un rechargement de page.

const IDB_NAME = 'md-editor-db';
const IDB_VERSION = 1;
const MAX_VERSIONS = 40;
const VERSION_SNAPSHOT_INTERVAL_MS = 90 * 1000; // au minimum 90s entre deux instantanés

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (!window.indexedDB) { dbPromise = Promise.resolve(null); return dbPromise; }

  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (e) {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('doc')) {
        db.createObjectStore('doc', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('versions')) {
        const store = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    // Navigation privée stricte (Safari/Firefox anciens) ou quota bloqué :
    // on bascule proprement sur le fallback localStorage plutôt que de planter.
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function idbAvailable() {
  return openDb().then((db) => !!db);
}

function tx(db, storeNames, mode) {
  return db.transaction(storeNames, mode);
}

// ---------- Document courant ----------

async function idbSaveDoc(content, title) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['doc'], 'readwrite');
      t.objectStore('doc').put({ id: 'current', content, title, updatedAt: Date.now() });
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
      t.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function idbLoadDoc() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['doc'], 'readonly');
      const req = t.objectStore('doc').get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// ---------- Historique de versions ----------

let lastVersionAt = 0;

async function idbAddVersion(content, title, force) {
  const db = await openDb();
  if (!db) return false;
  const now = Date.now();
  if (!force && now - lastVersionAt < VERSION_SNAPSHOT_INTERVAL_MS) return false;
  lastVersionAt = now;

  const words = (content.trim().match(/\S+/g) || []).length;

  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readwrite');
      const store = t.objectStore('versions');
      store.add({ ts: now, content, title, words });
      t.oncomplete = () => { pruneVersions(); resolve(true); };
      t.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function pruneVersions() {
  const db = await openDb();
  if (!db) return;
  const t = tx(db, ['versions'], 'readwrite');
  const store = t.objectStore('versions');
  const index = store.index('ts');
  let seen = 0;
  index.openCursor(null, 'prev').onsuccess = (e) => {
    const cursor = e.target.result;
    if (!cursor) return;
    seen += 1;
    if (seen > MAX_VERSIONS) store.delete(cursor.value.id); // au-delà des N plus récents : supprimé
    cursor.continue();
  };
}

async function idbListVersions() {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readonly');
      const store = t.objectStore('versions');
      const results = [];
      store.index('ts').openCursor(null, 'prev').onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(results); return; }
        const { id, ts, title, words } = cursor.value;
        results.push({ id, ts, title, words });
        cursor.continue();
      };
      t.onerror = () => resolve(results);
    } catch (e) {
      resolve([]);
    }
  });
}

async function idbGetVersion(id) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readonly');
      const req = t.objectStore('versions').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// ---------- Orchestration avec repli localStorage (storage.js) ----------

let idbUsable = null; // mémoïsé après le 1er essai

async function persistDocument(content, title) {
  if (idbUsable === null) idbUsable = await idbAvailable();

  if (idbUsable) {
    const ok = await idbSaveDoc(content, title);
    if (ok) {
      idbAddVersion(content, title, false); // best-effort, pas bloquant pour le statut affiché
      return 'ok';
    }
    // IndexedDB a échoué ponctuellement (quota plein, transaction avortée...) : repli.
  }
  return saveToLocalStorage(content, title); // définie dans storage.js : 'ok' | 'quota-exceeded' | 'memory'
}

async function restoreDocument() {
  idbUsable = await idbAvailable();
  if (idbUsable) {
    const doc = await idbLoadDoc();
    if (doc) return { content: doc.content, title: doc.title };
    // Migration ponctuelle : un ancien brouillon existe seulement en localStorage.
    const legacy = loadFromLocalStorage();
    if (legacy.content) {
      await idbSaveDoc(legacy.content, legacy.title);
      return legacy;
    }
    return { content: '', title: 'sans-titre' };
  }
  return loadFromLocalStorage();
}
