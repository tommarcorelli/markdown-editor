// export-pdf.js — PDF généré côté client, indépendant du moteur d'impression
// du navigateur : marges fixes, pas d'en-tête/pied de page imposé par Chrome,
// pagination qui ne coupe jamais un titre/tableau/bloc de code en plein milieu.

async function exportAsDesignedPdf(rawHtml, title, themeName, onStatusChange) {
  const themeCss = THEME_CSS[themeName] || THEME_CSS.github;
  const cardBg = THEME_BG[themeName] || '#ffffff';
  const cleanHtml = stripSyncAttributes(rawHtml);

  const scale = 2; // rendu net (équivalent ~192dpi)
  const pageWidthPx = 794;   // A4 à 96dpi
  const pageHeightPx = 1123;
  const marginPx = 56;
  const footerReservePx = 30; // bande basse réservée au pied de page maison

  onStatusChange?.('Préparation…');

  const container = document.createElement('div');
  container.style.cssText = `position: fixed; left: -99999px; top: 0; width: ${pageWidthPx}px; background: ${cardBg};`;
  container.innerHTML = `<style>
    ${BASE_CSS}
    ${themeCss}
    ${HLJS_CSS}
    .markdown-body {
      max-width: 100% !important;
      margin: 0 !important;
      padding: ${marginPx}px !important;
      box-sizing: border-box !important;
    }
  </style><div class="markdown-body">${cleanHtml}</div>`;
  document.body.appendChild(container);

  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 60)); // laisse peindre les images base64

    const mdEl = container.querySelector('.markdown-body');
    const totalHeight = Math.ceil(mdEl.scrollHeight + marginPx);

    // Points de coupe sûrs : jamais au milieu d'un titre, tableau, bloc de code, citation…
    const blockSelector = ':scope > *, :scope > * > li, :scope > * tr, :scope > * > *';
    const blockEls = Array.from(mdEl.querySelectorAll(blockSelector));
    const safeBottoms = [...new Set(blockEls.map((el) => Math.round(el.offsetTop + el.offsetHeight)))]
      .sort((a, b) => a - b);

    onStatusChange?.('Rendu du contenu…');

    // Garde-fou : certains navigateurs limitent la hauteur max d'un canvas (~16000px)
    const maxCanvasHeight = 15000;
    const effectiveScale = (totalHeight * scale > maxCanvasHeight)
      ? Math.max(1, Math.floor((maxCanvasHeight / totalHeight) * 10) / 10)
      : scale;

    const canvas = await window.PDFLibs.html2canvas(container, {
      width: pageWidthPx,
      height: totalHeight,
      windowWidth: pageWidthPx,
      scale: effectiveScale,
      backgroundColor: cardBg,
      useCORS: true,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0
    });

    onStatusChange?.('Pagination…');

    const contentHeightPx = pageHeightPx - footerReservePx;
    const pages = [];
    let cursor = 0;
    let guard = 0;
    while (cursor < totalHeight && guard < 500) {
      guard++;
      let target = cursor + contentHeightPx;
      if (target >= totalHeight) { pages.push([cursor, totalHeight]); break; }
      let cut = safeBottoms.filter((b) => b > cursor + 40 && b <= target).pop();
      if (!cut) cut = target; // aucun point sûr (élément plus grand qu'une page) : coupe forcée
      pages.push([cursor, cut]);
      cursor = cut;
    }
    if (pages.length === 0) pages.push([0, totalHeight]);

    onStatusChange?.(`Génération du PDF… (0/${pages.length})`);

    const pdf = new window.PDFLibs.jsPDF({ unit: 'px', format: [pageWidthPx, pageHeightPx], compress: true });

    pages.forEach(([from, to], i) => {
      if (i > 0) pdf.addPage([pageWidthPx, pageHeightPx]);
      const sliceHeightPx = Math.max(1, to - from);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.round(sliceHeightPx * effectiveScale);
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(
        canvas,
        0, Math.round(from * effectiveScale), canvas.width, sliceCanvas.height,
        0, 0, canvas.width, sliceCanvas.height
      );
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.93);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthPx, sliceHeightPx);

      // Pied de page maison : texte vectoriel, toujours net (pas rasterisé)
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(title || 'document', marginPx, pageHeightPx - 16);
      const pageLabel = `${i + 1} / ${pages.length}`;
      const labelWidth = pdf.getTextWidth(pageLabel);
      pdf.text(pageLabel, pageWidthPx - marginPx - labelWidth, pageHeightPx - 16);

      onStatusChange?.(`Génération du PDF… (${i + 1}/${pages.length})`);
    });

    pdf.save(`${title || 'document'}.pdf`);
  } finally {
    document.body.removeChild(container);
    onStatusChange?.(null);
  }
}
