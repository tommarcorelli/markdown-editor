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

  // ---------- Scroll sync éditeur <-> preview ----------
  let syncing = false;
  let rafPending = false;

  function getLineHeight() {
    const lh = parseFloat(getComputedStyle(editor).lineHeight);
    return isNaN(lh) ? 24 : lh;
  }

  function syncPreviewFromEditor() {
    if (syncing) return;
    syncing = true;

    const lineHeight = getLineHeight();
    const currentLine = editor.scrollTop / lineHeight;
    const anchors = Array.from(preview.querySelectorAll('[data-line]'));

    if (anchors.length) {
      let match = anchors[0];
      let next = null;
      for (const el of anchors) {
        const line = parseFloat(el.dataset.line);
        if (line <= currentLine) match = el;
        else { next = el; break; }
      }
      const matchLine = parseFloat(match.dataset.line);
      const nextLine = next ? parseFloat(next.dataset.line) : matchLine + 1;
      const span = nextLine - matchLine || 1;
      const frac = next ? Math.min(1, Math.max(0, (currentLine - matchLine) / span)) : 0;
      const nextTop = next ? next.offsetTop : match.offsetTop + match.offsetHeight;
      const targetTop = match.offsetTop + frac * (nextTop - match.offsetTop);
      preview.scrollTop = targetTop - 12;
    }

    requestAnimationFrame(() => { syncing = false; });
  }

  function syncEditorFromPreview() {
    if (syncing) return;
    syncing = true;

    const anchors = Array.from(preview.querySelectorAll('[data-line]'));
    if (anchors.length) {
      const previewScrollCenter = preview.scrollTop + 12;
      let match = anchors[0];
      let next = null;
      for (const el of anchors) {
        if (el.offsetTop <= previewScrollCenter) match = el;
        else { next = el; break; }
      }
      const matchLine = parseFloat(match.dataset.line);
      const nextLine = next ? parseFloat(next.dataset.line) : matchLine + 1;
      const nextTop = next ? next.offsetTop : match.offsetTop + match.offsetHeight;
      const span = nextTop - match.offsetTop || 1;
      const frac = next ? Math.min(1, Math.max(0, (previewScrollCenter - match.offsetTop) / span)) : 0;
      const targetLine = matchLine + frac * (nextLine - matchLine);
      editor.scrollTop = targetLine * getLineHeight();
    }

    requestAnimationFrame(() => { syncing = false; });
  }

  function throttledRaf(fn) {
    return () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => { fn(); rafPending = false; });
    };
  }

  editor.addEventListener('scroll', throttledRaf(syncPreviewFromEditor));
  preview.addEventListener('scroll', throttledRaf(syncEditorFromPreview));

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
