// export.js — export .md / .html standalone / PDF (window.print)

async function exportAsMarkdown(content, title) {
  downloadBlob(content, `${title || 'document'}.md`, 'text/markdown');
}

async function exportAsHtml(htmlContent, title, themeName) {
  // On récupère le CSS du thème actif pour l'inliner (fichier autonome)
  let themeCss = '';
  try {
    const res = await fetch(`css/themes/${themeName}.css`);
    themeCss = await res.text();
  } catch (e) {
    console.warn('Impossible de charger le CSS du thème pour l\'export :', e);
  }

  const standalone = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlText(title)}</title>
<style>
body { margin: 0; padding: 40px 20px; background: #fff; }
${themeCss}
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
