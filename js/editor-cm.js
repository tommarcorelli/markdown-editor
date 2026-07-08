// editor-cm.js — instancie CodeMirror 6 et expose une API simple,
// pour que le reste de l'app (app.js) n'ait pas à connaître l'API interne de CM.
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
  { tag: CM.tags.processingInstruction, color: '#6b7280' }, // marqueurs #, *, > etc.
  { tag: CM.tags.contentSeparator, color: '#5eead4' }, // ---
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
  '.cm-line': { padding: '0' }
}, { dark: true });

/**
 * Crée l'éditeur CodeMirror et retourne une API minimaliste :
 * getValue / setValue / onChange / getView / focus
 */
function createMarkdownEditor(mountEl, initialContent, onChangeCallback) {
  const state = CM.EditorState.create({
    doc: initialContent,
    extensions: [
      CM.history(),
      CM.drawSelection(),
      CM.highlightSpecialChars(),
      CM.keymap.of([...CM.defaultKeymap, ...CM.historyKeymap, CM.indentWithTab]),
      CM.markdown(),
      CM.syntaxHighlighting(markdownHighlight),
      CM.EditorView.lineWrapping,
      CM.placeholder('# Commence à écrire…'),
      editorTheme,
      CM.EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeCallback(update.state.doc.toString());
        }
      })
    ]
  });

  const view = new CM.EditorView({ state, parent: mountEl });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (text) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text }
      });
    },
    focus: () => view.focus(),
    getView: () => view
  };
}
