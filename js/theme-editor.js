// theme-editor.js — éditeur de thème visuel pour le thème "Personnalisé"
// (css/themes/personnalise.css). Contrairement aux 22 autres thèmes, qui
// sont des feuilles de style figées, celui-ci est piloté par des variables
// CSS (--ct-*) modifiables en direct depuis cette interface, sans toucher
// à un seul fichier CSS.
(function () {
  const CUSTOM_THEME_KEY = 'md-editor:custom-theme';
  const VAR_STYLE_ID = 'custom-theme-vars';

  // Ordre d'affichage dans l'éditeur + mapping vers les variables CSS
  // consommées par personnalise.css.
  const FIELDS = [
    { key: 'bg', varName: '--ct-bg', label: 'Fond de page', fallback: '#ffffff' },
    { key: 'text', varName: '--ct-text', label: 'Texte', fallback: '#2b2720' },
    { key: 'heading', varName: '--ct-heading', label: 'Titres', fallback: '#16130f' },
    { key: 'link', varName: '--ct-link', label: 'Liens', fallback: '#0969da' },
    { key: 'codeBg', varName: '--ct-code-bg', label: 'Fond du code inline', fallback: '#f6f8fa' },
    { key: 'codeText', varName: '--ct-code-text', label: 'Texte du code inline', fallback: '#c8393a' },
    { key: 'preBg', varName: '--ct-pre-bg', label: 'Fond des blocs de code', fallback: '#0d1117' },
    { key: 'preText', varName: '--ct-pre-text', label: 'Texte des blocs de code', fallback: '#e6edf3' },
    { key: 'quoteBorder', varName: '--ct-quote-border', label: 'Bordure de citation', fallback: '#d0d7de' },
    { key: 'quoteText', varName: '--ct-quote-text', label: 'Texte de citation', fallback: '#57606a' },
    { key: 'tableBorder', varName: '--ct-table-border', label: 'Bordures de tableau', fallback: '#d0d7de' }
  ];

  function defaultValues() {
    const v = {};
    FIELDS.forEach((f) => { v[f.key] = f.fallback; });
    return v;
  }

  // Réglages de départ cohérents, pour éviter de se retrouver avec un fond
  // et un texte mal assortis en ne changeant qu'une seule couleur.
  const PRESETS = {
    clair: { bg: '#ffffff', text: '#2b2720', heading: '#16130f', link: '#0969da', codeBg: '#f6f8fa', codeText: '#c8393a', preBg: '#0d1117', preText: '#e6edf3', quoteBorder: '#d0d7de', quoteText: '#57606a', tableBorder: '#d0d7de' },
    sombre: { bg: '#181a1f', text: '#dcdfe4', heading: '#f5f3ee', link: '#7dd3fc', codeBg: '#22262e', codeText: '#ffb86b', preBg: '#0d0f13', preText: '#e6edf3', quoteBorder: '#343a44', quoteText: '#9aa1ac', tableBorder: '#343a44' },
    sepia: { bg: '#f4ecd8', text: '#4a3f2f', heading: '#2e2517', link: '#8a5a2b', codeBg: '#e8dcc0', codeText: '#9c4221', preBg: '#3a2f22', preText: '#f0e6d2', quoteBorder: '#cbb994', quoteText: '#6b5c43', tableBorder: '#cbb994' }
  };

  function loadValues() {
    try {
      const raw = safeGet(CUSTOM_THEME_KEY);
      if (!raw) return defaultValues();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultValues(), parsed);
    } catch (e) {
      return defaultValues();
    }
  }

  function saveValues(values) {
    safeSet(CUSTOM_THEME_KEY, JSON.stringify(values));
  }

  function cssVarsBlock(values) {
    const decls = FIELDS.map((f) => `  ${f.varName}: ${values[f.key] || f.fallback};`).join('\n');
    return `:root {\n${decls}\n}`;
  }

  function applyValues(values) {
    let styleEl = document.getElementById(VAR_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = VAR_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = cssVarsBlock(values);
  }

  let currentValues = loadValues();
  applyValues(currentValues); // toujours injecté, même si le thème actif n'est pas "personnalise"

  // Exposé pour js/export.js : un export HTML doit embarquer les vraies
  // valeurs choisies, pas seulement les var(--ct-*, fallback) du template
  // (qui ne résoudraient qu'aux couleurs par défaut sans ce bloc).
  window.getCustomThemeCSSVarsBlock = () => cssVarsBlock(currentValues);
  window.getCustomThemeValues = () => Object.assign({}, currentValues);

  // ---------- UI ----------
  const overlay = document.createElement('div');
  overlay.className = 'cmd-overlay te-overlay';
  overlay.innerHTML = `<div class="cmd-modal te-modal" role="dialog" aria-modal="true" aria-label="Éditeur de thème personnalisé">
    <div class="vh-header">
      <span>Personnaliser le thème</span>
      <div class="vh-header-actions">
        <button type="button" class="te-reset" title="Réinitialiser aux valeurs par défaut">Réinitialiser</button>
        <button type="button" class="te-export" title="Exporter en JSON">Exporter</button>
        <button type="button" class="te-import" title="Importer un JSON">Importer</button>
        <button type="button" class="vh-close" aria-label="Fermer">✕</button>
      </div>
    </div>
    <div class="te-body">
      <p class="te-hint">Les couleurs s'appliquent en direct à l'aperçu. Le thème "🎨 Personnalisé" est sélectionné automatiquement pour que tu voies le résultat.</p>
      <div class="te-presets">
        <span class="te-presets-label">Point de départ :</span>
        <button type="button" class="te-preset-btn" data-preset="clair">Clair</button>
        <button type="button" class="te-preset-btn" data-preset="sombre">Sombre</button>
        <button type="button" class="te-preset-btn" data-preset="sepia">Sépia</button>
      </div>
      <div class="te-fields"></div>
    </div>
    <input type="file" class="te-import-input" accept="application/json" hidden>
  </div>`;
  document.body.appendChild(overlay);

  const fieldsWrap = overlay.querySelector('.te-fields');
  const closeBtn = overlay.querySelector('.vh-close');
  const resetBtn = overlay.querySelector('.te-reset');
  const exportBtn = overlay.querySelector('.te-export');
  const importBtn = overlay.querySelector('.te-import');
  const importInput = overlay.querySelector('.te-import-input');
  let lastFocused = null;

  function renderFields() {
    fieldsWrap.innerHTML = FIELDS.map((f) => `
      <label class="te-field">
        <input type="color" class="te-color" data-key="${f.key}" value="${currentValues[f.key] || f.fallback}">
        <span>${f.label}</span>
      </label>
    `).join('');
  }
  renderFields();

  function ensurePersonnaliseThemeActive() {
    const select = document.getElementById('theme-select');
    if (select && select.value !== 'personnalise') {
      select.value = 'personnalise';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  fieldsWrap.addEventListener('input', (e) => {
    const input = e.target.closest('.te-color');
    if (!input) return;
    currentValues[input.dataset.key] = input.value;
    applyValues(currentValues);
    ensurePersonnaliseThemeActive();
  });
  fieldsWrap.addEventListener('change', (e) => {
    if (!e.target.closest('.te-color')) return;
    saveValues(currentValues);
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Réinitialiser toutes les couleurs personnalisées aux valeurs par défaut ?')) return;
    currentValues = defaultValues();
    applyValues(currentValues);
    saveValues(currentValues);
    renderFields();
  });

  overlay.querySelectorAll('.te-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = PRESETS[btn.dataset.preset];
      if (!preset) return;
      currentValues = Object.assign({}, preset);
      applyValues(currentValues);
      saveValues(currentValues);
      renderFields();
      ensurePersonnaliseThemeActive();
    });
  });

  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentValues, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme-personnalise.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      currentValues = Object.assign(defaultValues(), parsed);
      applyValues(currentValues);
      saveValues(currentValues);
      renderFields();
      ensurePersonnaliseThemeActive();
    } catch (e) {
      alert('Fichier de thème invalide : impossible de le lire comme JSON.');
    }
  });

  function open() {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    renderFields();
    setTimeout(() => closeBtn.focus(), 30);
  }
  function close() {
    overlay.classList.remove('open');
    if (lastFocused && document.body.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const openBtn = document.getElementById('theme-editor-btn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const parentMenu = openBtn.closest('.menu');
      if (parentMenu) parentMenu.classList.remove('open');
      open();
    });
  }

  window.openThemeEditor = open;
})();
