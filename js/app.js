// app.js — orchestration de l'application
(function () {
  const editorMount = document.getElementById('editor-mount');
  const preview = document.getElementById('preview');
  const docTitle = document.getElementById('doc-title');
  const wordCount = document.getElementById('word-count');
  const charCount = document.getElementById('char-count');
  const saveStatus = document.getElementById('save-status');
  const workspace = document.querySelector('.workspace');
  const resizer = document.getElementById('resizer');
  const fileMenu = document.getElementById('file-menu');
  const optionsMenu = document.getElementById('options-menu');
  const toggleToc = document.getElementById('toggle-toc');
  const toggleNumbering = document.getElementById('toggle-numbering');
  const themeSelect = document.getElementById('theme-select');

  let debounceTimer = null;
  let cmEditor = null; // API retournée par createMarkdownEditor()

  function setSaveStatus(text, unsaved) {
    saveStatus.querySelector('.save-status-text').textContent = text;
    saveStatus.classList.toggle('unsaved', !!unsaved);
  }

  // ---------- Rendu live (debounced) ----------
  function renderPreview() {
    preview.innerHTML = renderMarkdown(cmEditor.getValue());
    if (toggleNumbering.checked) applyHeadingNumbers(preview);
    if (toggleToc.checked) {
      const tocHtml = buildTocHtml(preview);
      if (tocHtml) preview.insertAdjacentHTML('afterbegin', tocHtml);
    }
  }

  function updateStats() {
    const text = cmEditor.getValue().trim();
    const words = text.length ? text.split(/\s+/).length : 0;
    const raw = cmEditor.getValue();
    wordCount.textContent = `${words} mot${words > 1 ? 's' : ''}`;
    charCount.textContent = `${raw.length} caractères`;
  }

  function onEditorChange() {
    setSaveStatus('Modifications…', true);
    updateStats();

    clearTimeout(debounceTimer);
    const len = cmEditor.getValue().length;
    // Sur un gros document, on laisse un peu plus de temps entre les frappes
    // et le re-rendu, pour éviter les à-coups pendant la saisie.
    const delay = len > 200000 ? 500 : len > 50000 ? 300 : 150;

    debounceTimer = setTimeout(async () => {
      renderPreview();
      const saved = await persistDocument(cmEditor.getValue(), docTitle.value);
      if (saved === 'quota-exceeded') {
        setSaveStatus('Trop volumineux pour l\'autosave — pense à exporter', true);
      } else if (saved === 'memory') {
        setSaveStatus('Enregistré (session en cours uniquement)', true);
      } else {
        setSaveStatus('Enregistré', false);
      }
    }, delay);
  }

  docTitle.addEventListener('change', () => {
    persistDocument(cmEditor.getValue(), docTitle.value);
  });

  // ---------- Scroll sync éditeur <-> preview ----------
  // S'appuie sur les blocs de ligne réels de CodeMirror (lineBlockAtHeight),
  // qui tiennent compte du retour à la ligne automatique — plus fiable
  // qu'un calcul approximatif basé sur une hauteur de ligne fixe.
  let syncing = false;
  let rafPending = false;

  function syncPreviewFromEditor() {
    if (syncing) return;
    syncing = true;

    const view = cmEditor.getView();
    const scrollTop = view.scrollDOM.scrollTop;
    const block = view.lineBlockAtHeight(scrollTop);
    const currentLine = view.state.doc.lineAt(block.from).number - 1; // 0-indexé, comme token.map de markdown-it
    const fracInBlock = block.height > 0 ? (scrollTop - block.top) / block.height : 0;

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
      const frac = next
        ? Math.min(1, Math.max(0, (currentLine - matchLine + fracInBlock) / span))
        : 0;
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
      const view = cmEditor.getView();
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

      const doc = view.state.doc;
      const lineNum = Math.min(doc.lines, Math.max(1, Math.floor(targetLine) + 1));
      const block = view.lineBlockAt(doc.line(lineNum).from);
      const lineFrac = targetLine - Math.floor(targetLine);
      view.scrollDOM.scrollTop = block.top + lineFrac * block.height;
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

  // ---------- Barre d'outils de formatage ----------
  const toolbarActions = {
    bold: () => cmEditor.wrapSelection('**', '**', 'texte en gras'),
    italic: () => cmEditor.wrapSelection('*', '*', 'texte en italique'),
    strike: () => cmEditor.wrapSelection('~~', '~~', 'texte barré'),
    h1: () => cmEditor.setHeadingLevel(1),
    h2: () => cmEditor.setHeadingLevel(2),
    h3: () => cmEditor.setHeadingLevel(3),
    ul: () => cmEditor.toggleLinePrefix('- '),
    ol: () => cmEditor.toggleLinePrefix('1. '),
    task: () => cmEditor.toggleLinePrefix('- [ ] '),
    quote: () => cmEditor.toggleLinePrefix('> '),
    code: () => cmEditor.wrapSelection('`', '`', 'code'),
    codeblock: () => cmEditor.wrapSelection('```\n', '\n```', 'code'),
    link: () => cmEditor.wrapSelection('[', '](https://)', 'texte du lien'),
    image: () => cmEditor.triggerImagePicker(),
    table: () => cmEditor.insertTable(),
    hr: () => cmEditor.insertText('\n---\n')
  };

  document.getElementById('toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    const action = toolbarActions[btn.dataset.cmd];
    if (action) action();
  });

  // ---------- Raccourcis clavier globaux ----------
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    if (e.key === 's') {
      e.preventDefault();
      exportAsMarkdown(cmEditor.getValue(), docTitle.value);
    } else if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toolbarActions.bold();
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      toolbarActions.italic();
    } else if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toolbarActions.link();
    }
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

  // ---------- Menus (Fichier + Options) ----------
  document.querySelectorAll('.menu').forEach((menu) => {
    const trigger = menu.querySelector('.menu-trigger');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
      if (!wasOpen) menu.classList.add('open');
    });
    menu.querySelector('.menu-list').addEventListener('click', (e) => e.stopPropagation());
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
  });

  const TOC_STORAGE_KEY = 'md-editor:toc';
  const NUMBERING_STORAGE_KEY = 'md-editor:numbering';
  toggleToc.checked = safeGet(TOC_STORAGE_KEY) === '1';
  toggleNumbering.checked = safeGet(NUMBERING_STORAGE_KEY) === '1';
  toggleToc.addEventListener('change', () => {
    safeSet(TOC_STORAGE_KEY, toggleToc.checked ? '1' : '0');
    renderPreview();
  });
  toggleNumbering.addEventListener('change', () => {
    safeSet(NUMBERING_STORAGE_KEY, toggleNumbering.checked ? '1' : '0');
    renderPreview();
  });

  fileMenu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      fileMenu.classList.remove('open');
      const action = btn.dataset.action;

      try {
        if (action === 'new') {
          if (cmEditor.getValue() && !confirm('Créer un nouveau document ? Le contenu actuel sera perdu s\'il n\'est pas exporté.')) return;
          cmEditor.setValue('');
          docTitle.value = 'sans-titre';
        }

        if (action === 'open') {
          if (cmEditor.getValue() && !confirm('Ouvrir un autre fichier ? Le contenu actuel sera remplacé s\'il n\'est pas exporté.')) return;
          const { content, title } = await openMarkdownFile();
          cmEditor.setValue(content);
          docTitle.value = title;
        }

        if (action === 'save') {
          exportAsMarkdown(cmEditor.getValue(), docTitle.value);
        }

        if (action === 'export-html') {
          exportAsHtml(preview.innerHTML, docTitle.value, themeSelect.value);
        }

        if (action === 'export-pdf') {
          await exportAsDesignedPdf(preview.innerHTML, docTitle.value, themeSelect.value, (status) => {
            setSaveStatus(status || 'Enregistré', !!status);
          });
        }

        if (action === 'export-pdf-vector') {
          await exportAsVectorPdf(cmEditor.getValue(), docTitle.value, themeSelect.value, (status) => {
            setSaveStatus(status || 'Enregistré', !!status);
          });
        }

        if (action === 'export-pdf-office') {
          await exportAsOfficePdf(cmEditor.getValue(), docTitle.value, (status) => {
            setSaveStatus(status || 'Enregistré', !!status);
          });
        }

        if (action === 'print-pdf') {
          exportAsPdf();
        }

        if (action === 'export-slides') {
          exportAsSlides(cmEditor.getValue(), docTitle.value, themeSelect.value);
        }
      } catch (err) {
        console.error(`Échec de l'action "${action}" :`, err);
        if (action === 'open') {
          console.warn('Ouverture annulée ou impossible :', err.message);
        } else {
          alert(`Une erreur est survenue (${action}) : ${err.message || err}\n\nLe contenu de ton document n'est pas affecté.`);
        }
      }
    });
  });

  function loadDocumentIntoEditor(content, title) {
    cmEditor.setValue(content);
    docTitle.value = title;
    cmEditor.focus();
  }
  window.mdEditor = {
    loadDocument: loadDocumentIntoEditor,
    getValue: () => cmEditor.getValue(),
    getTitle: () => docTitle.value
  };

  // ---------- Init ----------
  window.addEventListener('beforeunload', (e) => {
    if (saveStatus.classList.contains('unsaved')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  async function init() {
    initTheme();
    const { content, title } = await restoreDocument();
    const initialContent = content || `# Bienvenue

Commence à écrire en **markdown** ici, l'aperçu se met à jour en direct à droite.

- Liste à puces
- \`code inline\`
- [lien](https://exemple.fr)

\`\`\`js
console.log("bloc de code coloré");
\`\`\`
`;
    docTitle.value = title;

    cmEditor = createMarkdownEditor(editorMount, initialContent, onEditorChange);
    cmEditor.getView().scrollDOM.addEventListener('scroll', throttledRaf(syncPreviewFromEditor));
    preview.addEventListener('scroll', throttledRaf(syncEditorFromPreview));

    renderPreview();
    updateStats();
  }

  function showFatalError(err) {
    console.error('Erreur fatale au démarrage de l\'éditeur :', err);
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#e0665a;color:#1a1d23;font-family:monospace;font-size:13px;padding:10px 16px;z-index:9999;';
    banner.textContent = 'Erreur au chargement de l\'éditeur : ' + (err && err.message ? err.message : err);
    document.body.appendChild(banner);
  }

  init().catch(showFatalError);
})();
