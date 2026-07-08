// renderer.js — parsing markdown -> HTML sûr et coloré
const md = window.markdownit({
  html: false,        // pas de HTML brut autorisé dans la source (sécurité)
  linkify: true,       // auto-détection des URLs
  typographer: true,   // guillemets, tirets typographiques
  breaks: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (e) { /* fallback en dessous */ }
    }
    return md.utils.escapeHtml(str);
  }
});

// Injecte data-line=<n° de ligne source> sur chaque token de bloc,
// utilisé ensuite pour synchroniser le scroll éditeur <-> preview.
md.core.ruler.push('inject_line_numbers', (state) => {
  state.tokens.forEach((token) => {
    if (token.map && token.type.endsWith('_open')) {
      token.attrSet('data-line', String(token.map[0]));
    }
  });
});

function renderMarkdown(source) {
  const rawHtml = md.render(source || '');
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
}
