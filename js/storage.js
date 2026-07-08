// storage.js — autosave localStorage + ouverture de fichiers .md locaux
const STORAGE_KEY = 'md-editor:content';
const STORAGE_TITLE_KEY = 'md-editor:title';

function saveToLocalStorage(content, title) {
  try {
    localStorage.setItem(STORAGE_KEY, content);
    localStorage.setItem(STORAGE_TITLE_KEY, title);
    return true;
  } catch (e) {
    console.error('Sauvegarde locale impossible :', e);
    return false;
  }
}

function loadFromLocalStorage() {
  return {
    content: localStorage.getItem(STORAGE_KEY) || '',
    title: localStorage.getItem(STORAGE_TITLE_KEY) || 'sans-titre'
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
