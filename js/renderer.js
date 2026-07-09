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

// Génère un id (ancre) unique sur chaque titre à partir de son texte,
// pour pouvoir linker vers une section précise (#installation-docker).
md.core.ruler.push('inject_heading_ids', (state) => {
  const slugCounts = {};
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = inline ? inline.content : '';
      let slug = text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';
      if (slugCounts[slug] != null) {
        slugCounts[slug] += 1;
        slug = `${slug}-${slugCounts[slug]}`;
      } else {
        slugCounts[slug] = 0;
      }
      tokens[i].attrSet('id', slug);
    }
  }
});

function renderMarkdown(source) {
  try {
    const rawHtml = md.render(source || '');
    return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
  } catch (e) {
    console.error('Erreur de rendu markdown :', e);
    return `<div style="padding:16px;border:1px solid #e0665a;border-radius:6px;color:#e0665a;font-family:monospace;font-size:13px;">
      Erreur de rendu — un passage du document n'a pas pu être interprété.<br>
      Le contenu reste intact dans l'éditeur, seul l'aperçu est affecté.
    </div>`;
  }
}
