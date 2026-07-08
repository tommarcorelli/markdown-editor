// export.js — export .md / .html standalone / PDF (window.print)

async function exportAsMarkdown(content, title) {
  downloadBlob(content, `${title || 'document'}.md`, 'text/markdown');
}

function stripSyncAttributes(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('[data-line]').forEach(el => el.removeAttribute('data-line'));
  return container.innerHTML;
}

function exportAsHtml(htmlContent, title, themeName) {
  // Le CSS est embarqué en JS (js/theme-styles.js) plutôt que récupéré via
  // fetch() : fetch() échoue silencieusement quand l'éditeur est ouvert en
  // file:// (double-clic), ce qui produisait un export sans aucun style.
  const themeCss = THEME_CSS[themeName] || THEME_CSS.github;
  const bg = THEME_BG[themeName] || '#ffffff';
  const cleanHtml = stripSyncAttributes(htmlContent);

  const standalone = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlText(title)}</title>
<style>
html { background: ${bg}; }
body {
  margin: 0;
  background: ${bg};
  padding: 56px 24px;
  min-height: 100vh;
  box-sizing: border-box;
}
${themeCss}
${HLJS_CSS}
</style>
</head>
<body>
<div class="markdown-body">
${cleanHtml}
</div>
</body>
</html>`;

  downloadBlob(standalone, `${title || 'document'}.html`, 'text/html');
}

function exportAsPdf() {
  // Approche pragmatique : @media print (css/print.css) + boîte de dialogue navigateur
  // L'utilisateur choisit "Enregistrer en PDF" dans le sélecteur d'imprimante.
  window.print();
}

function escapeHtmlText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
