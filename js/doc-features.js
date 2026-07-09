// doc-features.js — sommaire (TOC) et numérotation automatique des sections
// Fonctionne directement sur le DOM déjà rendu (headings avec id, cf. renderer.js)

/**
 * Construit un sommaire imbriqué (h2/h3/h4) à partir des titres présents
 * dans containerEl. Retourne une chaîne HTML (liste imbriquée), ou '' s'il
 * y a moins de 2 titres (pas utile pour un doc trop court).
 */
function buildTocHtml(containerEl) {
  const headings = Array.from(containerEl.querySelectorAll('h2[id], h3[id], h4[id]'));
  if (headings.length < 2) return '';

  let html = '<nav class="doc-toc"><div class="doc-toc-title">Sommaire</div><ul>';
  let currentLevel = 2;
  const levelStack = [2];

  headings.forEach((h) => {
    const level = parseInt(h.tagName[1], 10);
    if (level > currentLevel) {
      html += '<ul>'.repeat(level - currentLevel);
    } else if (level < currentLevel) {
      html += '</ul>'.repeat(currentLevel - level);
    }
    currentLevel = level;
    const text = h.textContent.replace(/^[\d.]+\s*/, ''); // évite de doubler avec la numérotation
    html += `<li><a href="#${h.id}">${escapeForToc(text)}</a></li>`;
  });
  html += '</ul>'.repeat(currentLevel - 1) + '</nav>';
  return html;
}

function escapeForToc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Préfixe chaque titre (h1-h4) d'un numéro hiérarchique : 1. / 1.1 / 1.1.2…
 * Idempotent : appelé sur un DOM fraîchement rendu à chaque fois
 * (le markdown source n'est jamais modifié).
 */
function applyHeadingNumbers(containerEl) {
  const headings = Array.from(containerEl.querySelectorAll('h1, h2, h3, h4'));
  const counters = [0, 0, 0, 0];

  headings.forEach((h) => {
    const level = parseInt(h.tagName[1], 10) - 1; // 0-indexé
    counters[level] += 1;
    for (let i = level + 1; i < counters.length; i++) counters[i] = 0;
    const numberStr = counters.slice(0, level + 1).join('.');

    const span = document.createElement('span');
    span.className = 'heading-num';
    span.textContent = numberStr + '  ';
    h.insertBefore(span, h.firstChild);
  });
}
