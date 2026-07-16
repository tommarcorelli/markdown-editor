// export-pdf-vector.js — génère un PDF vectoriel réel via pdfmake, à partir
// des tokens markdown-it directement (pas de capture d'écran). Texte
// sélectionnable/cherchable, fichier léger. En contrepartie : ne reprend pas
// à l'identique le rendu CSS de chaque thème (bordures, ombres, glow...),
// seulement une palette (accent + fond + texte) adaptée par thème.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(n, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rl, gl, bl] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function getThemePalette(themeName) {
  const accent = THEME_ACCENT[themeName] || '#333333';
  const bg = THEME_BG[themeName] || '#ffffff';
  const isDark = relativeLuminance(bg) < 0.5;
  return {
    accent,
    bg,
    text: isDark ? '#eef0f2' : '#1c1c1c',
    muted: isDark ? '#9aa3ad' : '#5a6270',
    codeBg: isDark ? '#00000040' : '#00000010',
    isDark
  };
}

// ---------- Numérotation des titres (opère sur les tokens, pas le DOM) ----------
function numberHeadingTokens(tokens) {
  const counters = [0, 0, 0, 0];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const level = parseInt(tokens[i].tag.slice(1), 10) - 1;
      counters[level] += 1;
      for (let k = level + 1; k < counters.length; k++) counters[k] = 0;
      const numStr = counters.slice(0, level + 1).join('.');
      const inline = tokens[i + 1];
      if (inline && inline.children && inline.children.length) {
        const textToken = inline.children.find((c) => c.type === 'text') || inline.children[0];
        if (textToken) textToken.content = `${numStr}  ${textToken.content}`;
      }
    }
  }
}

// ---------- Sommaire (à partir des heading_open trouvés) ----------
function collectToc(tokens) {
  const entries = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const level = parseInt(tokens[i].tag.slice(1), 10);
      if (level < 2 || level > 4) continue;
      const inline = tokens[i + 1];
      const text = inline ? inline.content : '';
      entries.push({ level, text });
    }
  }
  return entries;
}

// ---------- Inline (gras, italique, code, lien) -> runs de texte pdfmake ----------
function inlineTokensToRuns(children, palette) {
  const runs = [];
  let bold = false, italic = false, code = false, linkHref = null;

  (children || []).forEach((tok) => {
    if (tok.type === 'strong_open') bold = true;
    else if (tok.type === 'strong_close') bold = false;
    else if (tok.type === 'em_open') italic = true;
    else if (tok.type === 'em_close') italic = false;
    else if (tok.type === 'link_open') linkHref = tok.attrGet('href');
    else if (tok.type === 'link_close') linkHref = null;
    else if (tok.type === 'code_inline') {
      runs.push({
        text: tok.content,
        font: 'Courier',
        fontSize: 9.5,
        background: palette.codeBg,
        color: palette.text
      });
    } else if (tok.type === 'softbreak' || tok.type === 'hardbreak') {
      runs.push({ text: '\n' });
    } else if (tok.type === 'text') {
      const run = { text: tok.content };
      if (bold) run.bold = true;
      if (italic) run.italics = true;
      if (linkHref) { run.link = linkHref; run.color = palette.accent; run.decoration = 'underline'; }
      runs.push(run);
    } else if (tok.type === 'image') {
      const src = tok.attrGet('src') || '';
      if (src.startsWith('data:image')) {
        runs.push({ text: '' }); // les images sont gérées séparément au niveau bloc si isolées
      }
    }
  });

  return runs.length ? runs : [{ text: '' }];
}

// ---------- Conversion complète des tokens en contenu pdfmake ----------
function tokensToPdfContent(tokens, palette) {
  const content = [];
  let i = 0;
  const listStack = [];

  function currentListTarget() {
    if (!listStack.length) return content;
    return listStack[listStack.length - 1].items;
  }

  while (i < tokens.length) {
    const t = tokens[i];

    if (t.type === 'heading_open') {
      const level = parseInt(t.tag.slice(1), 10);
      const inline = tokens[i + 1];
      const sizes = { 1: 20, 2: 16, 3: 13.5, 4: 12 };
      currentListTarget().push({
        text: inline ? inline.content : '',
        fontSize: sizes[level] || 11,
        bold: true,
        color: palette.accent,
        margin: [0, level === 1 ? 4 : 14, 0, 6]
      });
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    if (t.type === 'paragraph_open') {
      const inline = tokens[i + 1];
      currentListTarget().push({
        text: inlineTokensToRuns(inline ? inline.children : [], palette),
        fontSize: 10.5,
        color: palette.text,
        margin: [0, 2, 0, 8],
        lineHeight: 1.35
      });
      i += 3;
      continue;
    }

    if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
      const items = [];
      listStack.push({ type: t.type === 'bullet_list_open' ? 'ul' : 'ol', items });
      i += 1;
      continue;
    }
    if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') {
      const finished = listStack.pop();
      const node = finished.type === 'ul' ? { ul: finished.items } : { ol: finished.items };
      node.margin = [0, 2, 0, 8];
      currentListTarget().push(node);
      i += 1;
      continue;
    }
    if (t.type === 'list_item_open') {
      // Le contenu de l'item est construit par les tokens suivants (paragraph/inline)
      // jusqu'à list_item_close ; on pousse un sous-tableau temporaire.
      listStack.push({ type: 'item', items: [] });
      i += 1;
      continue;
    }
    if (t.type === 'list_item_close') {
      const finished = listStack.pop();
      const parent = currentListTarget();
      if (finished.items.length === 1 && !Array.isArray(finished.items[0])) {
        parent.push({ ...finished.items[0], color: palette.text, fontSize: 10.5 });
      } else {
        parent.push({ stack: finished.items, color: palette.text, fontSize: 10.5 });
      }
      i += 1;
      continue;
    }

    if (t.type === 'blockquote_open') {
      // Collecte tout jusqu'à blockquote_close, rendu en table 2 colonnes (barre + texte)
      let j = i + 1, depth = 1;
      const inner = [];
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === 'blockquote_open') depth++;
        if (tokens[j].type === 'blockquote_close') depth--;
        if (depth > 0) inner.push(tokens[j]);
        j++;
      }
      const innerContent = tokensToPdfContent(inner, palette);
      currentListTarget().push({
        table: {
          widths: [3, '*'],
          body: [[
            { text: '', fillColor: palette.accent },
            { stack: innerContent, italics: true, color: palette.muted, fontSize: 10, border: [false, false, false, false] }
          ]]
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 10]
      });
      i = j;
      continue;
    }

    if (t.type === 'fence' || t.type === 'code_block') {
      const codeText = t.content.replace(/\n$/, '');
      currentListTarget().push({
        table: {
          widths: ['*'],
          body: [[{
            text: codeText,
            font: 'Courier',
            fontSize: 8.5,
            color: palette.text,
            fillColor: palette.codeBg,
            margin: [8, 8, 8, 8]
          }]]
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 10]
      });
      i += 1;
      continue;
    }

    if (t.type === 'table_open') {
      let j = i + 1;
      const rows = [];
      let currentRow = null;
      let isHeaderRow = false;
      while (j < tokens.length && tokens[j].type !== 'table_close') {
        const tt = tokens[j];
        if (tt.type === 'thead_open') isHeaderRow = true;
        if (tt.type === 'thead_close') isHeaderRow = false;
        if (tt.type === 'tr_open') currentRow = [];
        if (tt.type === 'tr_close') { rows.push({ cells: currentRow, header: isHeaderRow }); currentRow = null; }
        if ((tt.type === 'th_open' || tt.type === 'td_open')) {
          const inline = tokens[j + 1];
          currentRow.push({
            text: inline ? inline.content : '',
            bold: isHeaderRow,
            fontSize: 9.5,
            color: isHeaderRow ? palette.accent : palette.text
          });
        }
        j++;
      }
      const body = rows.map((r) => r.cells);
      const colCount = body[0] ? body[0].length : 1;
      currentListTarget().push({
        table: { headerRows: rows[0] && rows[0].header ? 1 : 0, widths: Array(colCount).fill('*'), body },
        layout: {
          hLineColor: () => palette.muted,
          vLineColor: () => palette.muted,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4
        },
        margin: [0, 4, 0, 10]
      });
      i = j + 1;
      continue;
    }

    if (t.type === 'hr') {
      currentListTarget().push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.75, lineColor: palette.muted }],
        margin: [0, 12, 0, 12]
      });
      i += 1;
      continue;
    }

    if (t.type === 'image') {
      const src = t.attrGet('src') || '';
      if (src.startsWith('data:image')) {
        currentListTarget().push({ image: src, width: 380, margin: [0, 6, 0, 10] });
      }
      i += 1;
      continue;
    }

    i += 1; // token non géré (softbreak isolé, etc.) : on avance sans planter
  }

  return content;
}

// ---------- Palette "Style Word/Office" — fixe, indépendante du thème actif ----------
function getOfficePalette() {
  return {
    accent: '#2e5395',   // bleu Word classique
    bg: '#ffffff',
    text: '#1a1a1a',
    muted: '#595959',
    codeBg: '#f2f2f2',
    isDark: false
  };
}

async function exportAsOfficePdf(source, title, onStatusChange) {
  onStatusChange?.('Analyse du document…');
  const palette = getOfficePalette();

  const tokens = md.parse(source, {});
  numberHeadingTokens(tokens);
  const tocEntries = collectToc(tokens);
  const body = tokensToPdfContent(tokens, palette);

  const tocContent = tocEntries.length >= 2 ? [
    { text: 'Sommaire', fontSize: 13, bold: true, color: palette.accent, margin: [0, 0, 0, 8] },
    ...tocEntries.map((e) => ({
      text: e.text,
      fontSize: 9.5 + (4 - e.level),
      color: palette.muted,
      margin: [(e.level - 2) * 14, 1, 0, 1]
    })),
    { text: '', pageBreak: 'after' }
  ] : [];

  onStatusChange?.('Génération du PDF…');

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [70, 70, 70, 60], // marges larges, classiques d'un document Word/administratif
    header: (currentPage) => currentPage === 1 ? null : {
      text: title || 'document',
      fontSize: 8,
      color: palette.muted,
      alignment: 'right',
      margin: [0, 24, 70, 0]
    },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} sur ${pageCount}`,
      fontSize: 8.5,
      color: palette.muted,
      alignment: 'center',
      margin: [0, 0, 0, 0]
    }),
    content: [
      { text: title || 'Document', fontSize: 22, bold: true, color: palette.accent, alignment: 'center', margin: [0, 0, 0, 2] },
      { text: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), fontSize: 9.5, color: palette.muted, alignment: 'center', margin: [0, 0, 0, 24] },
      ...tocContent,
      ...body
    ],
    defaultStyle: {
      font: 'Roboto',
      color: palette.text
    }
  };

  try {
    window.pdfMake.createPdf(docDefinition).download(`${title || 'document'}.pdf`);
  } finally {
    onStatusChange?.(null);
  }
}

async function exportAsVectorPdf(source, title, themeName, onStatusChange) {
  onStatusChange?.('Analyse du document…');
  const palette = getThemePalette(themeName);

  const tokens = md.parse(source, {});
  numberHeadingTokens(tokens); // toujours numéroté dans le PDF vectoriel (repère utile à l'impression)
  const tocEntries = collectToc(tokens);
  const body = tokensToPdfContent(tokens, palette);

  const tocContent = tocEntries.length >= 2 ? [
    { text: 'Sommaire', fontSize: 13, bold: true, color: palette.accent, margin: [0, 0, 0, 8] },
    ...tocEntries.map((e) => ({
      text: e.text,
      fontSize: 9.5 + (4 - e.level),
      color: palette.muted,
      margin: [(e.level - 2) * 14, 1, 0, 1]
    })),
    { text: '', pageBreak: 'after' }
  ] : [];

  onStatusChange?.('Génération du PDF…');

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [50, 55, 50, 50],
    background: () => ({
      canvas: [{ type: 'rect', x: 0, y: 0, w: 595, h: 842, color: palette.bg }]
    }),
    header: (currentPage) => currentPage === 1 ? null : {
      canvas: [{ type: 'line', x1: 50, y1: 20, x2: 545, y2: 20, lineWidth: 0.5, lineColor: palette.muted }]
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: title || 'document', fontSize: 7.5, color: palette.muted, margin: [50, 0, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, fontSize: 7.5, color: palette.muted, alignment: 'right', margin: [0, 0, 50, 0] }
      ]
    }),
    content: [
      { text: title || 'Document', fontSize: 22, bold: true, color: palette.accent, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1.5, lineColor: palette.accent }], margin: [0, 0, 0, 16] },
      ...tocContent,
      ...body
    ],
    defaultStyle: {
      font: 'Roboto',
      color: palette.text
    }
  };

  try {
    window.pdfMake.createPdf(docDefinition).download(`${title || 'document'}.pdf`);
  } finally {
    onStatusChange?.(null);
  }
}

// ---------- Mise en page "Lettre" — sobre, sans sommaire ni numérotation ----------
async function exportAsLetterPdf(source, title, themeName, onStatusChange) {
  onStatusChange?.('Analyse du document…');
  const palette = getThemePalette(themeName);

  const tokens = md.parse(source, {}); // pas de numberHeadingTokens : une lettre n'a pas de sections numérotées
  const body = tokensToPdfContent(tokens, palette);
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  onStatusChange?.('Génération du PDF…');

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [72, 80, 72, 64], // marges généreuses, format courrier
    background: () => ({
      canvas: [{ type: 'rect', x: 0, y: 0, w: 595, h: 842, color: palette.bg }]
    }),
    footer: (currentPage, pageCount) => pageCount > 1 ? {
      text: `${currentPage} / ${pageCount}`,
      fontSize: 8,
      color: palette.muted,
      alignment: 'center'
    } : null,
    content: [
      { text: dateStr, fontSize: 9.5, color: palette.muted, alignment: 'right', margin: [0, 0, 0, 28] },
      { text: title || 'Document', fontSize: 16, bold: true, color: palette.accent, margin: [0, 0, 0, 20] },
      ...body
    ],
    defaultStyle: {
      font: 'Roboto',
      color: palette.text,
      lineHeight: 1.4
    }
  };

  try {
    window.pdfMake.createPdf(docDefinition).download(`${title || 'document'}.pdf`);
  } finally {
    onStatusChange?.(null);
  }
}

// ---------- Mise en page "Académique" — page de titre, sommaire, texte justifié ----------
async function exportAsAcademicPdf(source, title, themeName, onStatusChange) {
  onStatusChange?.('Analyse du document…');
  const palette = getThemePalette(themeName);

  const tokens = md.parse(source, {});
  numberHeadingTokens(tokens);
  const tocEntries = collectToc(tokens);
  const body = tokensToPdfContent(tokens, palette);
  // Texte justifié pour un rendu façon article : seuls les paragraphes de type
  // "text" (pas les cellules de tableau/citation, déjà stylées) sont concernés.
  body.forEach((block) => {
    if (block && block.text && Array.isArray(block.text)) block.alignment = 'justify';
  });
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const tocContent = tocEntries.length >= 2 ? [
    { text: 'Sommaire', fontSize: 13, bold: true, color: palette.accent, margin: [0, 0, 0, 8] },
    ...tocEntries.map((e) => ({
      text: e.text,
      fontSize: 9.5 + (4 - e.level),
      color: palette.muted,
      margin: [(e.level - 2) * 14, 1, 0, 1]
    })),
    { text: '', pageBreak: 'after' }
  ] : [];

  onStatusChange?.('Génération du PDF…');

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [60, 70, 60, 55],
    background: () => ({
      canvas: [{ type: 'rect', x: 0, y: 0, w: 595, h: 842, color: palette.bg }]
    }),
    header: (currentPage) => currentPage <= 1 ? null : {
      text: title || 'document',
      fontSize: 8,
      italics: true,
      color: palette.muted,
      alignment: 'center',
      margin: [0, 24, 0, 0]
    },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage}`,
      fontSize: 8.5,
      color: palette.muted,
      alignment: 'center'
    }),
    content: [
      // Page de titre dédiée : titre centré, filet double, date — reste seule sur la page 1
      {
        text: title || 'Document',
        fontSize: 24,
        bold: true,
        color: palette.accent,
        alignment: 'center',
        margin: [0, 160, 0, 8]
      },
      { canvas: [{ type: 'line', x1: 197, y1: 0, x2: 397, y2: 0, lineWidth: 1, lineColor: palette.accent }], margin: [0, 0, 0, 10] },
      { text: dateStr, fontSize: 10.5, color: palette.muted, alignment: 'center' },
      { text: '', pageBreak: 'after' },
      ...tocContent,
      ...body
    ],
    defaultStyle: {
      font: 'Roboto',
      color: palette.text,
      lineHeight: 1.3
    }
  };

  try {
    window.pdfMake.createPdf(docDefinition).download(`${title || 'document'}.pdf`);
  } finally {
    onStatusChange?.(null);
  }
}
