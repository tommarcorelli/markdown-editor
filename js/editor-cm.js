// editor-cm.js — instancie CodeMirror 6 et expose une API riche
// (formatage, raccourcis, listes intelligentes, images collées/déposées).
const CM = window.CMBundle;

// Palette de coloration syntaxique markdown, calée sur les couleurs du thème "encre"
const markdownHighlight = CM.HighlightStyle.define([
  { tag: CM.tags.heading1, color: '#5eead4', fontWeight: '700', fontSize: '1.25em' },
  { tag: CM.tags.heading2, color: '#5eead4', fontWeight: '700', fontSize: '1.15em' },
  { tag: CM.tags.heading3, color: '#5eead4', fontWeight: '700', fontSize: '1.05em' },
  { tag: [CM.tags.heading4, CM.tags.heading5, CM.tags.heading6], color: '#5eead4', fontWeight: '700' },
  { tag: CM.tags.strong, color: '#f5f3ee', fontWeight: '700' },
  { tag: CM.tags.emphasis, color: '#f5f3ee', fontStyle: 'italic' },
  { tag: CM.tags.strikethrough, color: '#8b8f9a', textDecoration: 'line-through' },
  { tag: CM.tags.link, color: '#7dd3fc', textDecoration: 'underline' },
  { tag: CM.tags.url, color: '#7dd3fc' },
  { tag: CM.tags.monospace, color: '#ffb86b', fontFamily: 'var(--font-mono)' },
  { tag: CM.tags.quote, color: '#8b8f9a', fontStyle: 'italic' },
  { tag: CM.tags.list, color: '#5eead4' },
  { tag: CM.tags.processingInstruction, color: '#6b7280' },
  { tag: CM.tags.contentSeparator, color: '#5eead4' },
  { tag: CM.tags.meta, color: '#6b7280' }
]);

const editorTheme = CM.EditorView.theme({
  '&': {
    color: 'var(--ink-text)',
    backgroundColor: 'var(--ink-bg)',
    height: '100%',
    fontSize: '14.5px'
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.7',
    padding: '28px 32px',
    caretColor: '#5eead4'
  },
  '.cm-scroller': { overflow: 'auto' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: '#5eead4', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(94, 234, 212, 0.18) !important'
  },
  '.cm-placeholder': { color: 'var(--ink-text-dim)', fontStyle: 'normal' },
  '.cm-line': { padding: '0' },
  '&.cm-drop-active': { outline: '2px dashed #5eead4', outlineOffset: '-4px' }
}, { dark: true });

// ---------- Continuation intelligente des listes (Entrée) ----------
const LIST_BULLET_RE = /^(\s*)([-*+])(\s+)(\[[ xX]\]\s+)?/;
const LIST_ORDERED_RE = /^(\s*)(\d+)([.)])(\s+)/;

function smartListEnter(view) {
  const { state } = view;
  const { from, to } = state.selection.main;
  if (from !== to) return false; // laisse le comportement par défaut si sélection active

  const line = state.doc.lineAt(from);
  const textBefore = line.text.slice(0, from - line.from);
  const textAfter = line.text.slice(from - line.from);

  const bulletMatch = textBefore.match(LIST_BULLET_RE);
  const orderedMatch = textBefore.match(LIST_ORDERED_RE);

  if (bulletMatch) {
    const [full, indent, bullet, , checkbox] = bulletMatch;
    // Ligne de liste vide -> on sort de la liste (supprime le marqueur)
    if (textBefore.trim() === bullet && textAfter.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: from, insert: '' },
        selection: { anchor: line.from }
      });
      return true;
    }
    const prefix = indent + bullet + ' ' + (checkbox ? '[ ] ' : '');
    view.dispatch({
      changes: { from, to, insert: '\n' + prefix },
      selection: { anchor: from + 1 + prefix.length }
    });
    return true;
  }

  if (orderedMatch) {
    const [full, indent, num, delim] = orderedMatch;
    if (textBefore.trim() === `${num}${delim}` && textAfter.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: from, insert: '' },
        selection: { anchor: line.from }
      });
      return true;
    }
    const nextNum = parseInt(num, 10) + 1;
    const prefix = `${indent}${nextNum}${delim} `;
    view.dispatch({
      changes: { from, to, insert: '\n' + prefix },
      selection: { anchor: from + 1 + prefix.length }
    });
    return true;
  }

  return false; // pas dans une liste, comportement par défaut
}

// ---------- Images collées / déposées -> base64 embarqué ----------
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function insertImageAtPos(view, pos, altText, dataUri) {
  const markdown = `![${altText}](${dataUri})`;
  view.dispatch({
    changes: { from: pos, to: pos, insert: markdown },
    selection: { anchor: pos + markdown.length }
  });
}

async function handleImageFile(view, file, pos) {
  if (!file.type.startsWith('image/')) return false;
  try {
    const dataUri = await fileToDataUri(file);
    const altText = file.name ? file.name.replace(/\.[^.]+$/, '') : 'image';
    insertImageAtPos(view, pos, altText, dataUri);
  } catch (e) {
    console.warn('Impossible d\'intégrer l\'image :', e);
  }
  return true;
}

const imageHandling = CM.EditorView.domEventHandlers({
  paste(event, view) {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((it) => it.type.startsWith('image/'));
    if (!imageItem) return false;
    const file = imageItem.getAsFile();
    if (!file) return false;
    event.preventDefault();
    handleImageFile(view, file, view.state.selection.main.from);
    return true;
  },
  drop(event, view) {
    const files = Array.from(event.dataTransfer?.files || []);
    const imageFile = files.find((f) => f.type.startsWith('image/'));
    if (!imageFile) return false;
    event.preventDefault();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
    handleImageFile(view, imageFile, pos);
    return true;
  }
});

/**
 * Crée l'éditeur CodeMirror et retourne une API riche :
 * getValue / setValue / focus / getView / wrapSelection / insertText / toggleLinePrefix / insertTable
 */
function createMarkdownEditor(mountEl, initialContent, onChangeCallback) {
  const state = CM.EditorState.create({
    doc: initialContent,
    extensions: [
      CM.history(),
      CM.drawSelection(),
      CM.highlightSpecialChars(),
      CM.keymap.of([
        { key: 'Enter', run: smartListEnter },
        { key: 'Tab', run: CM.indentMore },
        { key: 'Shift-Tab', run: CM.indentLess },
        ...CM.defaultKeymap,
        ...CM.historyKeymap
      ]),
      CM.markdown(),
      CM.syntaxHighlighting(markdownHighlight),
      CM.EditorView.lineWrapping,
      CM.placeholder('# Commence à écrire…'),
      editorTheme,
      imageHandling,
      CM.EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeCallback(update.state.doc.toString());
        }
      })
    ]
  });

  const view = new CM.EditorView({ state, parent: mountEl });

  // Entoure la sélection de `before`/`after` (ex: ** **). Sans sélection,
  // insère un texte indicatif déjà sélectionné pour pouvoir écrire par-dessus.
  function wrapSelection(before, after, placeholderText) {
    const { state } = view;
    const changes = state.changeByRange((range) => {
      const selected = state.sliceDoc(range.from, range.to);
      const text = selected || placeholderText;
      const insert = before + text + after;
      const insideFrom = range.from + before.length;
      const insideTo = insideFrom + text.length;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: selected
          ? CM.EditorSelection.range(range.from + insert.length, range.from + insert.length)
          : CM.EditorSelection.range(insideFrom, insideTo)
      };
    });
    view.dispatch(state.update(changes));
    view.focus();
  }

  // Ajoute/retire un préfixe en début de chaque ligne sélectionnée (titres, citation, liste)
  function toggleLinePrefix(prefix) {
    const { state } = view;
    const range = state.selection.main;
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    const changes = [];
    for (let ln = startLine; ln <= endLine; ln++) {
      const line = state.doc.line(ln);
      if (line.text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
      } else {
        changes.push({ from: line.from, insert: prefix });
      }
    }
    view.dispatch({ changes });
    view.focus();
  }

  // Remplace le préfixe de titre existant (## ) par un nouveau niveau, sans dupliquer
  function setHeadingLevel(level) {
    const { state } = view;
    const range = state.selection.main;
    const line = state.doc.lineAt(range.from);
    const stripped = line.text.replace(/^#{1,6}\s*/, '');
    const prefix = '#'.repeat(level) + ' ';
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: prefix + stripped }
    });
    view.focus();
  }

  function insertText(text, selectFrom, selectTo) {
    const pos = view.state.selection.main.from;
    view.dispatch({
      changes: { from: pos, to: pos, insert: text },
      selection: (selectFrom != null)
        ? { anchor: pos + selectFrom, head: pos + (selectTo ?? selectFrom) }
        : { anchor: pos + text.length }
    });
    view.focus();
  }

  function insertTable() {
    const table = '| Colonne 1 | Colonne 2 | Colonne 3 |\n| --- | --- | --- |\n| ligne 1 | ligne 1 | ligne 1 |\n| ligne 2 | ligne 2 | ligne 2 |\n';
    insertText(table);
  }

  function triggerImagePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (file) handleImageFile(view, file, view.state.selection.main.from);
    };
    input.click();
  }

  const undoCmd = CM.historyKeymap.find((k) => k.key === 'Mod-z');
  const redoCmd = CM.historyKeymap.find((k) => k.key === 'Mod-y');

  // ---------- Recherche / remplacement ----------
  // @codemirror/search n'est pas dans le bundle embarqué (js/vendor/codemirror.min.js
  // n'exporte pas Decoration/highlightSelectionMatches) : on reconstruit une
  // recherche minimale au-dessus des primitives disponibles (EditorSelection,
  // view.dispatch). Le "surlignage" du match courant se fait via la sélection
  // native (déjà stylée par le thème de l'éditeur), pas via des décorations.
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function findMatches(query, caseSensitive) {
    if (!query) return [];
    const text = view.state.doc.toString();
    const re = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi');
    const matches = [];
    let m;
    while ((m = re.exec(text))) {
      matches.push({ from: m.index, to: m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++; // garde-fou, ne devrait pas arriver ici
    }
    return matches;
  }

  function selectMatch(match) {
    view.dispatch({
      selection: CM.EditorSelection.range(match.from, match.to),
      scrollIntoView: true
    });
    view.focus();
  }

  function findNext(query, caseSensitive) {
    const matches = findMatches(query, caseSensitive);
    if (!matches.length) return { index: -1, total: 0 };
    const pos = view.state.selection.main.to;
    let next = matches.find((m) => m.from >= pos);
    if (!next || (view.state.selection.main.from === next.from && view.state.selection.main.to === next.to)) {
      next = matches.find((m) => m.from > view.state.selection.main.from) || matches[0];
    }
    if (!next) next = matches[0];
    selectMatch(next);
    return { index: matches.indexOf(next), total: matches.length };
  }

  function findPrev(query, caseSensitive) {
    const matches = findMatches(query, caseSensitive);
    if (!matches.length) return { index: -1, total: 0 };
    const pos = view.state.selection.main.from;
    let prevMatches = matches.filter((m) => m.to <= pos);
    const prev = prevMatches.length ? prevMatches[prevMatches.length - 1] : matches[matches.length - 1];
    selectMatch(prev);
    return { index: matches.indexOf(prev), total: matches.length };
  }

  function matchInfo(query, caseSensitive) {
    const matches = findMatches(query, caseSensitive);
    const sel = view.state.selection.main;
    const idx = matches.findIndex((m) => m.from === sel.from && m.to === sel.to);
    return { index: idx, total: matches.length };
  }

  function replaceCurrent(query, replacement, caseSensitive) {
    const sel = view.state.selection.main;
    const current = view.state.sliceDoc(sel.from, sel.to);
    const matchesCurrent = caseSensitive ? current === query : current.toLowerCase() === query.toLowerCase();
    if (matchesCurrent && current) {
      view.dispatch({ changes: { from: sel.from, to: sel.to, insert: replacement } });
    }
    return findNext(query, caseSensitive);
  }

  function replaceAll(query, replacement, caseSensitive) {
    const matches = findMatches(query, caseSensitive);
    if (!matches.length) return 0;
    const changes = matches.map((m) => ({ from: m.from, to: m.to, insert: replacement }));
    view.dispatch({ changes });
    return matches.length;
  }

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (text) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text }
      });
    },
    undo: () => undoCmd && undoCmd.run(view),
    redo: () => redoCmd && redoCmd.run(view),
    focus: () => view.focus(),
    getView: () => view,
    findNext,
    findPrev,
    replaceCurrent,
    replaceAll,
    matchInfo,
    wrapSelection,
    toggleLinePrefix,
    setHeadingLevel,
    insertText,

    insertTable,
    triggerImagePicker
  };
}
