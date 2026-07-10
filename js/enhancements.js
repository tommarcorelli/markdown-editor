// enhancements.js — Focus mode, palette de commandes Ctrl+K, temps de lecture,
// rendu Mermaid, export DOCX/EPUB. Chargé APRÈS app.js.
(function () {
  const $ = (s) => document.querySelector(s);

  // ---------- Temps de lecture (dans la statusbar) ----------
  const wordCount = $('#word-count');
  const statusbar = $('.statusbar');
  const readTime = document.createElement('span');
  readTime.id = 'read-time';
  readTime.textContent = '~1 min de lecture';
  wordCount && wordCount.after(readTime);

  function updateReadTime() {
    const txt = (wordCount && wordCount.textContent) || '';
    const words = parseInt(txt.match(/\d+/) || 0, 10) || 0;
    const mins = Math.max(1, Math.round(words / 200));
    readTime.textContent = `~${mins} min de lecture`;
  }
  // observe le compteur de mots (mis à jour par app.js)
  if (wordCount) {
    new MutationObserver(updateReadTime).observe(wordCount, { childList: true, characterData: true, subtree: true });
    updateReadTime();
  }

  // ---------- Focus mode (Ctrl/Cmd + Shift + F) ----------
  function toggleFocus() { document.body.classList.toggle('focus-mode'); }
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFocus();
    }
    if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
      toggleFocus();
    }
  });

  // ---------- Palette de commandes (Ctrl/Cmd + P) ----------
  const commands = [
    { icon: 'B', label: 'Gras', shortcut: '⌘B', run: () => trigger('bold') },
    { icon: 'I', label: 'Italique', shortcut: '⌘I', run: () => trigger('italic') },
    { icon: 'S', label: 'Barré', run: () => trigger('strike') },
    { icon: 'H₁', label: 'Titre H1', run: () => trigger('h1') },
    { icon: 'H₂', label: 'Titre H2', run: () => trigger('h2') },
    { icon: 'H₃', label: 'Titre H3', run: () => trigger('h3') },
    { icon: '•', label: 'Liste à puces', run: () => trigger('ul') },
    { icon: '1.', label: 'Liste numérotée', run: () => trigger('ol') },
    { icon: '☑', label: 'Liste de tâches', run: () => trigger('task') },
    { icon: '"', label: 'Citation', run: () => trigger('quote') },
    { icon: '<>', label: 'Code inline', run: () => trigger('code') },
    { icon: '{}', label: 'Bloc de code', run: () => trigger('codeblock') },
    { icon: '🔗', label: 'Lien', shortcut: '⌘K', run: () => trigger('link') },
    { icon: '⊞', label: 'Tableau', run: () => trigger('table') },
    { icon: '―', label: 'Séparateur', run: () => trigger('hr') },
    { icon: '◨', label: 'Mode Split', run: () => setMode('split') },
    { icon: '✎', label: 'Mode Édition seule', run: () => setMode('edit') },
    { icon: '◉', label: 'Mode Aperçu seul', run: () => setMode('preview') },
    { icon: '⌂', label: 'Focus (Zen)', shortcut: '⇧⌘F', run: toggleFocus },
    { icon: '↓', label: 'Enregistrer (.md)', shortcut: '⌘S', run: () => fileAction('save') },
    { icon: '⤒', label: 'Nouveau document', run: () => fileAction('new') },
    { icon: '⤴', label: 'Ouvrir un fichier…', run: () => fileAction('open') },
    { icon: '🕘', label: 'Historique des versions', run: () => { if (window.openVersionHistory) window.openVersionHistory(); } },
    { icon: '↗', label: 'Exporter en HTML', run: () => fileAction('export-html') },
    { icon: '📄', label: 'Exporter en PDF (fidèle au thème)', run: () => fileAction('export-pdf') },
    { icon: '📃', label: 'Exporter en PDF (texte sélectionnable)', run: () => fileAction('export-pdf-vector') },
    { icon: 'W', label: 'Exporter en DOCX (Word)', run: () => exportDocx() },
    { icon: '📖', label: 'Exporter en EPUB', run: () => exportEpub() },
    { icon: '▤', label: 'Exporter en présentation', run: () => fileAction('export-slides') },
    { icon: '🖶', label: 'Imprimer (PDF navigateur)', run: () => fileAction('print-pdf') },
    { icon: '⟲', label: 'Réinitialiser (efface tout, historique inclus)', run: () => fileAction('reset-all') },
    { icon: '🔎', label: 'Rechercher…', run: () => { if (window.openFindReplace) window.openFindReplace(false); } },
    { icon: '🔁', label: 'Rechercher et remplacer…', run: () => { if (window.openFindReplace) window.openFindReplace(true); } },
    { icon: '◱', label: 'Mode focus (masquer l\'interface)', run: () => toggleFocus() },
  ];

  function trigger(cmd) {
    const btn = document.querySelector(`[data-cmd="${cmd}"]`);
    if (btn) btn.click();
  }
  function setMode(m) {
    const btn = document.querySelector(`[data-mode="${m}"]`);
    if (btn) btn.click();
  }
  function fileAction(a) {
    const btn = document.querySelector(`[data-action="${a}"]`);
    if (btn) btn.click();
  }

  // DOM palette
  const overlay = document.createElement('div');
  overlay.className = 'cmd-overlay';
  overlay.innerHTML = `<div class="cmd-modal" role="dialog" aria-modal="true" aria-label="Palette de commandes">
    <input type="text" class="cmd-input" placeholder="Tape une commande…" autocomplete="off" spellcheck="false" aria-label="Rechercher une commande">
    <div class="cmd-list" role="listbox"></div>
  </div>`;
  document.body.appendChild(overlay);
  let lastFocusedBeforePalette = null;
  const cmdInput = overlay.querySelector('.cmd-input');
  const cmdList = overlay.querySelector('.cmd-list');
  let filtered = commands.slice();
  let activeIdx = 0;

  function renderList() {
    if (!filtered.length) {
      cmdList.innerHTML = '<div class="cmd-empty">Aucune commande</div>';
      return;
    }
    cmdList.innerHTML = filtered.map((c, i) => `
      <div class="cmd-item${i === activeIdx ? ' active' : ''}" data-idx="${i}">
        <span class="cmd-icon">${c.icon}</span>
        <span>${c.label}</span>
        ${c.shortcut ? `<span class="cmd-shortcut">${c.shortcut}</span>` : ''}
      </div>`).join('');
  }

  function openPalette() {
    lastFocusedBeforePalette = document.activeElement;
    overlay.classList.add('open');
    cmdInput.value = '';
    filtered = commands.slice();
    activeIdx = 0;
    renderList();
    setTimeout(() => cmdInput.focus(), 30);
  }
  function closePalette() {
    overlay.classList.remove('open');
    if (lastFocusedBeforePalette && document.body.contains(lastFocusedBeforePalette)) {
      lastFocusedBeforePalette.focus();
    }
    lastFocusedBeforePalette = null;
  }

  cmdInput.addEventListener('input', () => {
    const q = cmdInput.value.trim().toLowerCase();
    filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q)) : commands.slice();
    activeIdx = 0;
    renderList();
  });

  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(filtered.length - 1, activeIdx + 1); renderList(); scrollActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); renderList(); scrollActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIdx]) { filtered[activeIdx].run(); closePalette(); } }
    else if (e.key === 'Escape') { closePalette(); }
    else if (e.key === 'Tab') {
      // Seul champ focusable de la modale : on empêche Tab de sortir vers la page en dessous.
      e.preventDefault();
    }
  });
  function scrollActive() {
    const el = cmdList.querySelector('.cmd-item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  cmdList.addEventListener('click', (e) => {
    const item = e.target.closest('.cmd-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx, 10);
    if (filtered[idx]) { filtered[idx].run(); closePalette(); }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePalette(); });

  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey) {
      // laisse "print" natif si focus est ailleurs et Shift ; sinon on ouvre palette
      e.preventDefault();
      openPalette();
    }
  });

  // ---------- Rendu Mermaid ----------
  if (window.mermaid) {
    try { window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict', fontFamily: 'inherit' }); } catch (e) {}
  }
  const preview = $('#preview');
  let mermaidCounter = 0;
  async function renderMermaid() {
    if (!window.mermaid || !preview) return;
    const blocks = preview.querySelectorAll('pre code.language-mermaid, pre > code.language-mermaid');
    for (const codeEl of blocks) {
      const preEl = codeEl.closest('pre');
      const src = codeEl.textContent;
      const id = 'mmd-' + (++mermaidCounter);
      try {
        const { svg } = await window.mermaid.render(id, src);
        const wrap = document.createElement('div');
        wrap.className = 'mermaid-block';
        wrap.innerHTML = svg;
        preEl.replaceWith(wrap);
      } catch (err) {
        // laisse le bloc code en place si mermaid échoue
      }
    }
  }
  // Observe les mises à jour du preview et re-rend mermaid
  if (preview) {
    const mo = new MutationObserver(() => { mermaidCounter = 0; renderMermaid(); });
    mo.observe(preview, { childList: true, subtree: false });
    renderMermaid();
  }

  // ---------- Export DOCX ----------
  function getPreviewClone() {
    const clone = preview.cloneNode(true);
    // Supprime attributs de sync (data-line)
    clone.querySelectorAll('[data-line]').forEach(el => el.removeAttribute('data-line'));
    return clone.innerHTML;
  }
  function currentTitle() { return ($('#doc-title').value || 'document').replace(/[\/\\?*:|"<>]/g, '_'); }

  function exportDocx() {
    if (!window.htmlDocx) { alert("Bibliothèque DOCX non chargée."); return; }
    const title = currentTitle();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }
      h1, h2, h3, h4 { color: #111; margin-top: 1.2em; }
      h1 { font-size: 22pt; } h2 { font-size: 17pt; } h3 { font-size: 14pt; }
      code { font-family: Consolas, 'Courier New', monospace; background: #f2f2f2; padding: 1px 4px; }
      pre { background: #f5f5f5; padding: 10px; font-family: Consolas, monospace; font-size: 10pt; white-space: pre-wrap; }
      blockquote { border-left: 3px solid #888; margin: 1em 0; padding-left: 12px; color: #555; font-style: italic; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 6px 10px; }
      th { background: #eee; }
      img { max-width: 100%; }
    </style></head>
    <body><h1>${title}</h1>${getPreviewClone()}</body></html>`;
    const blob = window.htmlDocx.asBlob(html);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title}.docx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- Export EPUB ----------
  async function exportEpub() {
    if (!window.JSZip) { alert("Bibliothèque EPUB non chargée."); return; }
    const title = currentTitle();
    const uuid = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
    const body = getPreviewClone();
    const zip = new window.JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.folder('META-INF').file('container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
    const oebps = zip.folder('OEBPS');
    oebps.file('content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${uuid}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>fr</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chap1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="chap1"/></spine>
</package>`);
    oebps.file('style.css',
      `body { font-family: Georgia, serif; line-height: 1.6; margin: 1em; }
h1,h2,h3 { color: #111; }
code { font-family: monospace; background: #f0f0f0; padding: 1px 4px; }
pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
blockquote { border-left: 3px solid #888; padding-left: 12px; color: #555; font-style: italic; }`);
    oebps.file('nav.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${title}</title></head>
<body><nav epub:type="toc"><h1>Sommaire</h1><ol><li><a href="chapter1.xhtml">${title}</a></li></ol></nav></body>
</html>`);
    oebps.file('chapter1.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title><link rel="stylesheet" href="style.css"/></head>
<body><h1>${title}</h1>${body}</body></html>`);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title}.epub`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Boutons ajoutés dynamiquement dans le menu Fichier
  const fileMenu = document.querySelector('#file-menu .menu-list');
  if (fileMenu) {
    const slidesBtn = fileMenu.querySelector('[data-action="export-slides"]');
    const insertBefore = slidesBtn || null;
    const mkBtn = (label, action) => {
      const b = document.createElement('button');
      b.dataset.action = action;
      b.innerHTML = `<span class="mi">↓</span>${label}`;
      b.addEventListener('click', () => {
        document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
        if (action === 'docx') exportDocx();
        else if (action === 'epub') exportEpub();
      });
      return b;
    };
    fileMenu.insertBefore(mkBtn('Exporter en DOCX (Word)', 'docx'), insertBefore);
    fileMenu.insertBefore(mkBtn('Exporter en EPUB', 'epub'), insertBefore);
  }

  // Enregistre les plugins markdown-it (footnotes)
  // On patche md juste après renderer.js si dispo :
  try {
    // md est une const dans renderer.js — accessible via window? Non, IIFE-less mais const in module scope of that file.
    // Astuce : renderMarkdown est global, on ré-enveloppe pour ajouter les notes via re-parse. Alternative :
    // markdown-it-footnote a été chargé avant renderer.js, mais renderer.js ne l'appelle pas.
    // Solution : accéder via markdownitFootnote.default et patcher au chargement suivant.
    // Comme renderer.js définit md et non exporté, on ne peut pas le patcher a posteriori proprement.
    // Fallback léger : convertit [^n] et [^n]: en HTML simple ici.
    const origRender = window.renderMarkdown;
    if (origRender) {
      window.renderMarkdown = function (source) {
        return origRender(preprocessFootnotes(source || ''));
      };
    }
  } catch (e) {}

  // Preprocesseur simple pour footnotes markdown [^id] et [^id]: contenu
  function preprocessFootnotes(src) {
    const defs = {};
    // Extract definitions
    src = src.replace(/^\[\^([^\]]+)\]:[ \t]*([^\n]+(?:\n[ \t]+[^\n]+)*)/gm, (m, id, body) => {
      defs[id] = body.replace(/\n[ \t]+/g, ' ').trim();
      return '';
    });
    if (!Object.keys(defs).length) return src;
    let n = 0;
    const order = {};
    src = src.replace(/\[\^([^\]]+)\]/g, (m, id) => {
      if (!(id in order)) order[id] = ++n;
      const i = order[id];
      return `<sup class="footnote-ref"><a href="#fn${i}" id="fnref${i}">${i}</a></sup>`;
    });
    // Append footnotes section
    let notes = '\n\n<section class="footnotes"><ol>';
    Object.keys(order).sort((a,b)=>order[a]-order[b]).forEach(id => {
      const i = order[id];
      notes += `<li id="fn${i}">${defs[id] || ''} <a href="#fnref${i}" class="footnote-backref">↩</a></li>`;
    });
    notes += '</ol></section>';
    return src + notes;
  }
})();
