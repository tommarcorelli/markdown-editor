// export-slides.js — découpe le markdown en slides sur les séparateurs ---
// (thematic break de niveau racine) et génère un deck HTML autonome.

function splitIntoSlides(source) {
  // On utilise les tokens markdown-it pour repérer les 'hr' de premier niveau
  // (fiables, contrairement à une regex qui pourrait matcher un --- dans un bloc de code).
  const tokens = md.parse(source, {});
  const lines = source.split('\n');
  const breakLines = tokens
    .filter(t => t.type === 'hr' && t.map)
    .map(t => t.map[0]);

  if (!breakLines.length) return [source];

  const slides = [];
  let start = 0;
  breakLines.forEach((lineNum) => {
    slides.push(lines.slice(start, lineNum).join('\n'));
    start = lineNum + 1;
  });
  slides.push(lines.slice(start).join('\n'));
  return slides.map(s => s.trim()).filter(s => s.length > 0);
}

function exportAsSlides(source, title, themeName) {
  const slides = splitIntoSlides(source);
  const themeCss = THEME_CSS[themeName] || THEME_CSS.github;
  const cardBg = THEME_BG[themeName] || '#ffffff';
  const bodyBg = THEME_BODY_BG[themeName] || '#f0f0f0';
  const accent = THEME_ACCENT[themeName] || '#5eead4';

  const slidesHtml = slides.map((s, i) => `
    <section class="slide" data-index="${i}">
      <div class="markdown-body">${stripSyncAttributes(renderMarkdown(s))}</div>
    </section>`).join('\n');

  const doc = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlText(title)} — présentation</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>
  ${BASE_CSS}
  ${themeCss}
  ${HLJS_CSS}
  html, body { margin: 0; height: 100%; overflow: hidden; background: ${bodyBg}; }
  .deck { position: relative; width: 100vw; height: 100vh; }
  .slide {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 6vh 8vw;
    box-sizing: border-box;
    opacity: 0; pointer-events: none;
    transition: opacity 0.35s ease;
  }
  .slide.active { opacity: 1; pointer-events: auto; }
  .slide .markdown-body {
    max-width: 900px; width: 100%; max-height: 100%; overflow-y: auto;
    background: ${cardBg};
    border-radius: 16px;
    border-top: 6px solid ${accent};
    box-shadow: 0 30px 70px -20px rgba(0,0,0,0.45);
    padding: 64px 72px;
    box-sizing: border-box;
  }
  .deck-nav {
    position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 14px;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: ${accent}; opacity: 0.8; user-select: none;
    background: ${bodyBg}; padding: 8px 16px; border-radius: 999px;
  }
  .deck-nav button {
    background: none; border: 1px solid currentColor; color: inherit;
    border-radius: 50%; width: 26px; height: 26px; cursor: pointer; font-size: 13px;
  }
  .deck-nav button:hover { opacity: 0.7; }
  .deck-progress { position: fixed; top: 0; left: 0; height: 3px; background: ${accent}; transition: width 0.3s ease; z-index: 10; }
  @media print {
    .slide { position: relative; opacity: 1 !important; pointer-events: auto; break-after: page; height: 100vh; }
    .deck-nav, .deck-progress { display: none; }
  }
</style>
</head>
<body>
<div class="deck-progress" id="progress"></div>
<div class="deck" id="deck">
${slidesHtml}
</div>
<div class="deck-nav">
  <button id="prev" aria-label="Précédent">‹</button>
  <span id="counter">1 / ${slides.length}</span>
  <button id="next" aria-label="Suivant">›</button>
</div>
<script>
  const slidesEls = Array.from(document.querySelectorAll('.slide'));
  let current = 0;
  function render() {
    slidesEls.forEach((el, i) => el.classList.toggle('active', i === current));
    document.getElementById('counter').textContent = (current + 1) + ' / ' + slidesEls.length;
    document.getElementById('progress').style.width = ((current + 1) / slidesEls.length * 100) + '%';
  }
  function go(delta) {
    current = Math.min(slidesEls.length - 1, Math.max(0, current + delta));
    render();
  }
  document.getElementById('prev').addEventListener('click', () => go(-1));
  document.getElementById('next').addEventListener('click', () => go(1));
  window.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { go(1); e.preventDefault(); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { go(-1); e.preventDefault(); }
  });
  let touchStartX = 0;
  window.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  window.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  });
  render();
</script>
</body>
</html>`;

  downloadBlob(doc, `${title || 'presentation'}-slides.html`, 'text/html');
}
