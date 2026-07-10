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
  const themeCss = (THEME_CSS[themeName] || THEME_CSS.github)
    // Repli robuste hors-ligne : le <link> Google Fonts ne se chargera pas
    // sans connexion, donc on ajoute de bonnes polices système AVANT le
    // générique 'monospace'/'serif', plutôt que de dépendre uniquement du
    // fallback générique du navigateur.
    .replace(/'JetBrains Mono', monospace/g, "'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace")
    .replace(/'Source Serif 4', Georgia, serif/g, "'Source Serif 4', Georgia, 'Iowan Old Style', 'Palatino Linotype', serif")
    .replace(/'Source Serif 4', Georgia, 'Times New Roman', serif/g, "'Source Serif 4', Georgia, 'Iowan Old Style', 'Times New Roman', serif");
  const cardBg = THEME_BG[themeName] || '#ffffff';
  const bodyBg = THEME_BODY_BG[themeName] || '#f0f0f0';
  const accent = THEME_ACCENT[themeName] || '#5eead4';
  const cleanHtml = stripSyncAttributes(htmlContent);
  const isNeobrutalist = themeName === 'neobrutalist';

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Néobrutalist a déjà son propre langage visuel (bordures dures, ombres
  // portées franches) — on le prolonge plutôt que d'imposer un style "carte"
  // arrondie qui casserait l'esthétique voulue.
  const cardStyle = isNeobrutalist
    ? `border: 3px solid #111; box-shadow: 10px 10px 0 #111; border-radius: 0;`
    : `border-radius: 16px; box-shadow: 0 30px 70px -20px rgba(0,0,0,0.45), 0 12px 24px -12px rgba(0,0,0,0.25); border-top: 5px solid ${accent};`;

  const standalone = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlText(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>
  html { background: ${bodyBg}; }
  body {
    margin: 0;
    background: ${bodyBg};
    padding: 64px 24px;
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
  }
  ${BASE_CSS}
  ${themeCss}
  ${HLJS_CSS}
  /* Habillage "document" par-dessus le thème */
  .doc-wrap { width: 100%; max-width: 900px; }
  .markdown-body {
    box-sizing: border-box !important;
    ${cardStyle}
    padding: 68px 76px !important;
    margin: 0 !important;
    width: 100%;
  }
  .doc-footer {
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    letter-spacing: 0.03em;
    color: ${accent};
    opacity: 0.55;
    margin-top: 22px;
  }
  @media (max-width: 640px) {
    body { padding: 24px 12px; }
    .markdown-body { padding: 32px 24px !important; }
  }
  @media print {
    html, body, .markdown-body, .doc-toc {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body { background: #fff !important; padding: 0 !important; display: block; }
    .markdown-body { box-shadow: none !important; border-top: none !important; border: none !important; }
    .doc-footer { display: none; }
  }
</style>
</head>
<body>
<div class="doc-wrap">
  <div class="markdown-body">
${cleanHtml}
  </div>
  <div class="doc-footer">${escapeHtmlText(title)} · généré le ${dateStr} avec MD.</div>
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
