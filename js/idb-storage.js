// idb-storage.js — couche de persistance principale, basée sur IndexedDB.
// Pourquoi IndexedDB plutôt que localStorage : localStorage plafonne à
// ~5-10 Mo et est synchrone (peut geler l'UI sur un gros document) ;
// IndexedDB tient des centaines de Mo et est asynchrone. storage.js
// (localStorage) reste le filet de sécurité pour les navigateurs/contextes
// où IndexedDB est indisponible (navigation privée stricte, pages en
// file://) — dans ce cas on repasse en mode "un seul document", sans
// historique ni multi-documents.
//
// Trois magasins :
//   - "doc"      : un enregistrement par document {id, title, content, updatedAt, words}
//   - "versions" : instantanés, rattachés à un document via un index "docId"
//   - "meta"     : petites clés/valeurs globales (aujourd'hui : le document actif)

const IDB_NAME = 'md-editor-db';
const IDB_VERSION = 2;
const MAX_VERSIONS_PER_DOC = 40;
const VERSION_SNAPSHOT_INTERVAL_MS = 90 * 1000; // au minimum 90s entre deux instantanés d'un même document

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

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const upgradeTx = req.transaction;
      const oldVersion = event.oldVersion;

      const docStore = db.objectStoreNames.contains('doc')
        ? upgradeTx.objectStore('doc')
        : db.createObjectStore('doc', { keyPath: 'id' });

      const versionsStore = db.objectStoreNames.contains('versions')
        ? upgradeTx.objectStore('versions')
        : db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
      if (!versionsStore.indexNames.contains('ts')) versionsStore.createIndex('ts', 'ts');
      if (!versionsStore.indexNames.contains('docId')) versionsStore.createIndex('docId', 'docId');

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }

      if (oldVersion < 2) {
        // Migration v1 → v2 : l'ancien schéma stockait un unique document
        // sous l'id fixe 'current'. On le garde tel quel (il devient
        // simplement le premier document du mode multi-doc) et on pointe
        // le document actif dessus. Les anciennes versions n'avaient pas
        // de docId : on les rattache à 'current'.
        docStore.get('current').onsuccess = (e) => {
          if (e.target.result) {
            upgradeTx.objectStore('meta').put({ key: 'activeDocId', value: 'current' });
          }
        };
        versionsStore.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          if (cursor.value.docId == null) {
            cursor.update(Object.assign({}, cursor.value, { docId: 'current' }));
          }
          cursor.continue();
        };
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

function countWords(content) {
  return (content.trim().match(/\S+/g) || []).length;
}

function generateDocId() {
  return 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------- CRUD documents ----------

async function idbSaveDocumentRecord(id, content, title) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['doc'], 'readwrite');
      t.objectStore('doc').put({ id, content, title, updatedAt: Date.now(), words: countWords(content) });
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
      t.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function idbGetDocument(id) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['doc'], 'readonly');
      const req = t.objectStore('doc').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbListDocuments() {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['doc'], 'readonly');
      const results = [];
      t.objectStore('doc').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { results.sort((a, b) => b.updatedAt - a.updatedAt); resolve(results); return; }
        const { id, title, updatedAt, words } = cursor.value;
        results.push({ id, title, updatedAt, words: words || 0 });
        cursor.continue();
      };
      t.onerror = () => resolve(results);
    } catch (e) {
      resolve([]);
    }
  });
}

async function idbCreateDocument(title, content) {
  const id = generateDocId();
  await idbSaveDocumentRecord(id, content || '', title || 'sans-titre');
  return id;
}

async function idbDeleteDocument(id) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['doc', 'versions'], 'readwrite');
      t.objectStore('doc').delete(id);
      const idx = t.objectStore('versions').index('docId');
      idx.openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

// ---------- Document actif (meta) ----------

async function idbGetActiveDocId() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['meta'], 'readonly');
      const req = t.objectStore('meta').get('activeDocId');
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbSetActiveDocId(id) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['meta'], 'readwrite');
      t.objectStore('meta').put({ key: 'activeDocId', value: id });
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

// ---------- Historique de versions (par document) ----------

const lastVersionAtByDoc = {};

async function idbAddVersion(docId, content, title, force) {
  const db = await openDb();
  if (!db || !docId) return false;
  const now = Date.now();
  if (!force && now - (lastVersionAtByDoc[docId] || 0) < VERSION_SNAPSHOT_INTERVAL_MS) return false;
  lastVersionAtByDoc[docId] = now;

  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readwrite');
      t.objectStore('versions').add({ docId, ts: now, content, title, words: countWords(content) });
      t.oncomplete = () => { pruneVersions(docId); resolve(true); };
      t.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function pruneVersions(docId) {
  const db = await openDb();
  if (!db) return;
  const t = tx(db, ['versions'], 'readwrite');
  const store = t.objectStore('versions');
  const idx = store.index('docId');
  let seen = 0;
  idx.openCursor(IDBKeyRange.only(docId), 'prev').onsuccess = (e) => {
    const cursor = e.target.result;
    if (!cursor) return;
    seen += 1;
    if (seen > MAX_VERSIONS_PER_DOC) store.delete(cursor.primaryKey);
    cursor.continue();
  };
}

async function idbListVersions(docId) {
  const db = await openDb();
  if (!db || !docId) return [];
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readonly');
      const idx = t.objectStore('versions').index('docId');
      const results = [];
      idx.openCursor(IDBKeyRange.only(docId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { results.sort((a, b) => b.ts - a.ts); resolve(results); return; }
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

async function idbDeleteVersion(id) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readwrite');
      t.objectStore('versions').delete(id);
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

async function idbClearVersionsForDoc(docId) {
  const db = await openDb();
  if (!db || !docId) return false;
  return new Promise((resolve) => {
    try {
      const t = tx(db, ['versions'], 'readwrite');
      const idx = t.objectStore('versions').index('docId');
      idx.openCursor(IDBKeyRange.only(docId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

// ---------- Orchestration multi-documents, avec repli localStorage ----------
// Tout ce qui suit maintient un "document actif" en mémoire (activeDocId)
// pour que app.js n'ait pas à connaître le détail du schéma : il appelle
// juste persistActiveDocument(), switchActiveDocument(id), etc.

let activeDocId = null;
let idbUsable = null; // mémoïsé après le 1er essai

function getActiveDocId() { return activeDocId; }

async function initDocumentStore() {
  idbUsable = await idbAvailable();
  if (!idbUsable) return null; // pas d'IndexedDB : mode "un seul document" via localStorage, géré par app.js

  let id = await idbGetActiveDocId();
  let doc = id ? await idbGetDocument(id) : null;

  if (!doc) {
    const list = await idbListDocuments();
    if (list.length) {
      id = list[0].id;
      doc = await idbGetDocument(id);
    } else {
      // Rien en IndexedDB : dernière chance de récupérer un brouillon resté
      // en localStorage (ancien navigateur, ou tout premier lancement).
      const legacy = loadFromLocalStorage();
      id = await idbCreateDocument(legacy.title || 'sans-titre', legacy.content || '');
      doc = await idbGetDocument(id);
    }
    await idbSetActiveDocId(id);
  }

  activeDocId = id;
  return doc;
}

async function persistActiveDocument(content, title) {
  if (!idbUsable || !activeDocId) {
    return saveToLocalStorage(content, title); // définie dans storage.js : 'ok' | 'quota-exceeded' | 'memory'
  }
  const ok = await idbSaveDocumentRecord(activeDocId, content, title);
  if (ok) {
    idbAddVersion(activeDocId, content, title, false); // best-effort, pas bloquant pour le statut affiché
    return 'ok';
  }
  return saveToLocalStorage(content, title);
}

async function switchActiveDocument(id) {
  if (!idbUsable) return null;
  const doc = await idbGetDocument(id);
  if (!doc) return null;
  activeDocId = id;
  await idbSetActiveDocId(id);
  return doc;
}

async function createAndSwitchDocument(title, content) {
  if (!idbUsable) return null;
  const id = await idbCreateDocument(title, content || '');
  activeDocId = id;
  await idbSetActiveDocId(id);
  return id;
}

async function deleteDocumentAndMaybeSwitch(id) {
  if (!idbUsable) return null;
  await idbDeleteDocument(id);
  if (id !== activeDocId) return null; // pas besoin de changer de document actif côté éditeur
  const list = await idbListDocuments();
  if (list.length) {
    activeDocId = list[0].id;
  } else {
    activeDocId = await idbCreateDocument('sans-titre', '');
  }
  await idbSetActiveDocId(activeDocId);
  return idbGetDocument(activeDocId);
}

async function duplicateDocument(id) {
  if (!idbUsable) return null;
  const doc = await idbGetDocument(id);
  if (!doc) return null;
  return idbCreateDocument((doc.title || 'sans-titre') + ' (copie)', doc.content);
}

async function renameDocumentRecord(id, title) {
  if (!idbUsable) return false;
  const doc = await idbGetDocument(id);
  if (!doc) return false;
  return idbSaveDocumentRecord(id, doc.content, title);
}

// Réinitialisation complète : tous les documents, tout l'historique, le
// document actif, et le repli localStorage. Utilisé par "Réinitialiser"
// dans le menu Fichier — volontairement destructeur et global, à la
// différence de "Nouveau document" qui n'affecte rien d'existant.
async function resetAllStorage() {
  for (const k in lastVersionAtByDoc) delete lastVersionAtByDoc[k];
  const db = await openDb();
  if (db) {
    await new Promise((resolve) => {
      const t = tx(db, ['doc', 'versions', 'meta'], 'readwrite');
      t.objectStore('doc').clear();
      t.objectStore('versions').clear();
      t.objectStore('meta').clear();
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    });
    if (idbUsable) {
      activeDocId = await idbCreateDocument('sans-titre', '');
      await idbSetActiveDocId(activeDocId);
    }
  }
  clearLocalDocument(); // définie dans storage.js
  return activeDocId ? idbGetDocument(activeDocId) : { id: null, content: '', title: 'sans-titre' };
}
