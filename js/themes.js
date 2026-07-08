// themes.js — changement du thème de rendu du preview
const THEME_STORAGE_KEY = 'md-editor:theme';

function applyTheme(themeName) {
  const link = document.getElementById('preview-theme');
  link.href = `css/themes/${themeName}.css`;
  safeSet(THEME_STORAGE_KEY, themeName);
}

function initTheme() {
  const select = document.getElementById('theme-select');
  const saved = safeGet(THEME_STORAGE_KEY) || 'github';
  select.value = saved;
  applyTheme(saved);

  select.addEventListener('change', () => applyTheme(select.value));
}
