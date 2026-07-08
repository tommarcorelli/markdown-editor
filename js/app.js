// app.js — orchestration de l'application
(function () {
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const docTitle = document.getElementById('doc-title');
  const wordCount = document.getElementById('word-count');
  const charCount = document.getElementById('char-count');
  const saveStatus = document.getElementById('save-status');
  const workspace = document.querySelector('.workspace');
  const resizer = document.getElementById('resizer');
  const fileMenu = document.getElementById('file-menu');
  const themeSelect = document.getElementById('theme-select');

  let debounceTimer = null;

  // ---------- Rendu live (debounced) ----------
  function renderPreview() {
    preview.innerHTML = renderMarkdown(editor.value);
  }

  function updateStats() {
    const text = editor.value.trim();
    const words = text.length ? text.split(/\s+/).length : 0;
    wordCount.textContent = `${words} mot${words > 1 ? 's' : ''}`;
    charCount.textContent = `${editor.value.length} caractères`;
  }

  function onEditorInput() {
    saveStatus.textContent = 'Modifications…';
    saveStatus.classList.add('unsaved');
    updateStats();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderPreview();
      saveToLocalStorage(editor.value, docTitle.value);
      saveStatus.textContent = 'Enregistré';
      saveStatus.classList.remove('unsaved');
    }, 150);
  }

  editor.addEventListener('input', onEditorInput);
  docTitle.addEventListener('change', () => {
    saveToLocalStorage(editor.value, docTitle.value);
  });

  // ---------- Modes d'affichage (split / édition / aperçu) ----------
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      workspace.dataset.mode = btn.dataset.mode;
    });
  });

  // ---------- Resizer du split-pane ----------
  (function initResizer() {
    let dragging = false;

    resizer.addEventListener('mousedown', () => {
      dragging = true;
      resizer.classList.add('active');
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = workspace.getBoundingClientRect();
      const ratio = Math.min(0.85, Math.max(0.15, (e.clientX - rect.left) / rect.width));
      workspace.querySelector('.pane-editor').style.flex = `1 1 ${ratio * 100}%`;
      workspace.querySelector('.pane-preview').style.flex = `1 1 ${(1 - ratio) * 100}%`;
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      resizer.classList.remove('active');
      document.body.style.userSelect = '';
    });
  })();

  // ---------- Menu Fichier ----------
  const menuTrigger = fileMenu.querySelector('.menu-trigger');
  menuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    fileMenu.classList.toggle('open');
  });
  document.addEventListener('click', () => fileMenu.classList.remove('open'));

  fileMenu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      fileMenu.classList.remove('open');
      const action = btn.dataset.action;

      if (action === 'new') {
        if (editor.value && !confirm('Créer un nouveau document ? Le contenu actuel sera perdu s\'il n\'est pas exporté.')) return;
        editor.value = '';
        docTitle.value = 'sans-titre';
        onEditorInput();
        renderPreview();
      }

      if (action === 'open') {
        try {
          const { content, title } = await openMarkdownFile();
          editor.value = content;
          docTitle.value = title;
          onEditorInput();
          renderPreview();
        } catch (e) {
          console.warn('Ouverture annulée ou impossible :', e.message);
        }
      }

      if (action === 'save') {
        exportAsMarkdown(editor.value, docTitle.value);
      }

      if (action === 'export-html') {
        exportAsHtml(preview.innerHTML, docTitle.value, themeSelect.value);
      }

      if (action === 'export-pdf') {
        exportAsPdf();
      }
    });
  });

  // ---------- Init ----------
  function init() {
    initTheme();
    const { content, title } = loadFromLocalStorage();
    editor.value = content || `# Bienvenue

Commence à écrire en **markdown** ici, l'aperçu se met à jour en direct à droite.

- Liste à puces
- \`code inline\`
- [lien](https://exemple.fr)

\`\`\`js
console.log("bloc de code coloré");
\`\`\`
`;
    docTitle.value = title;
    renderPreview();
    updateStats();
  }

  init();
})();
