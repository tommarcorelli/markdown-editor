// storage.js — autosave localStorage (avec fallback mémoire) + ouverture de fichiers .md locaux
const STORAGE_KEY = 'md-editor:content';
const STORAGE_TITLE_KEY = 'md-editor:title';

// Certains navigateurs bloquent localStorage sur les pages ouvertes en file://
// (origine "opaque") ou en navigation privée stricte. On teste une fois et on
// bascule sur un stockage en mémoire si besoin, pour que l'app ne plante jamais.
const memoryFallback = {};
let localStorageAvailable = true;
try {
  const testKey = '__md_editor_test__';
  localStorage.setItem(testKey, '1');
  localStorage.removeItem(testKey);
} catch (e) {
  localStorageAvailable = false;
  console.warn('localStorage indisponible (file:// ou navigation privée) — fallback en mémoire activé.');
}

function safeGet(key) {
  if (!localStorageAvailable) return memoryFallback[key] ?? null;
  try { return localStorage.getItem(key); } catch (e) { return memoryFallback[key] ?? null; }
}

function safeSet(key, value) {
  if (!localStorageAvailable) { memoryFallback[key] = value; return 'memory'; }
  try { localStorage.setItem(key, value); return 'ok'; }
  catch (e) {
    memoryFallback[key] = value;
    // QuotaExceededError : le document est trop gros pour localStorage (~5-10 Mo selon navigateurs).
    // Le contenu reste en mémoire pour la session en cours, mais ne survivra pas à un rechargement.
    return e.name === 'QuotaExceededError' ? 'quota-exceeded' : 'memory';
  }
}

function saveToLocalStorage(content, title) {
  const result = safeSet(STORAGE_KEY, content);
  safeSet(STORAGE_TITLE_KEY, title);
  return result;
}

function loadFromLocalStorage() {
  return {
    content: safeGet(STORAGE_KEY) || '',
    title: safeGet(STORAGE_TITLE_KEY) || 'sans-titre'
  };
}

// Ouverture d'un fichier .md depuis le disque
function openMarkdownFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error('Aucun fichier sélectionné'));
      const reader = new FileReader();
      reader.onload = () => resolve({
        content: reader.result,
        title: file.name.replace(/\.(md|markdown|txt)$/i, '')
      });
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

// Téléchargement générique d'un blob
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
