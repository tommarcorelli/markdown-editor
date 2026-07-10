// themes.js — changement du thème de rendu du preview
const THEME_STORAGE_KEY = 'md-editor:theme';

function applyTheme(themeName) {
  const link = document.getElementById('preview-theme');
  link.href = `css/themes/${themeName}.css`;
  safeSet(THEME_STORAGE_KEY, themeName);
}

function initTheme() {
  const select = document.getElementById('theme-select');
  const stored = safeGet(THEME_STORAGE_KEY);
  // Premier lancement (aucun choix explicite en mémoire) : on part du thème
  // sombre/clair du système plutôt que d'imposer "github" à tout le monde.
  // Un choix explicite ultérieur de l'utilisateur reste toujours prioritaire.
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = stored || (prefersDark ? 'nuit' : 'github');
  select.value = saved;
  applyTheme(saved);

  select.addEventListener('change', () => applyTheme(select.value));
}
