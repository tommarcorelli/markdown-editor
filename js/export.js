// export.js — export .md / .html standalone / PDF (window.print)

async function exportAsMarkdown(content, title) {
  downloadBlob(content, `${title || 'document'}.md`, 'text/markdown');
}

function exportAsHtml(htmlContent, title, themeName) {
  // Le CSS est embarqué en JS (js/theme-styles.js) plutôt que récupéré via
  // fetch() : fetch() échoue silencieusement quand l'éditeur est ouvert en
  // file:// (double-clic), ce qui produisait un export sans aucun style.
  const themeCss = THEME_CSS[themeName] || THEME_CSS.github;

  const standalone = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlText(title)}</title>
<style>
body { margin: 0; padding: 40px 20px; }
${themeCss}
${HLJS_CSS}
</style>
</head>
<body>
<div class="markdown-body">
${htmlContent}
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
