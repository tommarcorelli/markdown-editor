// custom-select.js — construit un nuancier visuel par-dessus le <select id="theme-select">
// natif (qui reste dans le DOM, fonctionnel, écouté par themes.js). Approche
// additive : aucune modification de themes.js/app.js nécessaire.
(function () {
  const nativeSelect = document.getElementById('theme-select');
  const wrap = document.querySelector('.select-wrap');
  if (!nativeSelect || !wrap) return;

  const options = Array.from(nativeSelect.options).map((o) => ({
    value: o.value,
    label: o.textContent
  }));

  function swatchColor(value) {
    return (typeof THEME_ACCENT !== 'undefined' && THEME_ACCENT[value]) || '#888';
  }

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cs-trigger';
  trigger.innerHTML = `
    <span class="cs-swatch" id="cs-current-swatch"></span>
    <span id="cs-current-label"></span>
    <svg class="cs-trigger-arrow" viewBox="0 0 10 6" width="10" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
  `;

  const panel = document.createElement('div');
  panel.className = 'cs-panel';
  panel.setAttribute('role', 'listbox');
  panel.innerHTML = options.map((o) => `
    <div class="cs-option" role="option" data-value="${o.value}">
      <span class="cs-swatch" style="background:${swatchColor(o.value)}"></span>
      <span>${o.label}</span>
    </div>
  `).join('');

  wrap.appendChild(trigger);
  wrap.appendChild(panel);

  function syncTriggerLabel() {
    const current = options.find((o) => o.value === nativeSelect.value) || options[0];
    trigger.querySelector('#cs-current-label').textContent = current ? current.label : '';
    trigger.querySelector('#cs-current-swatch').style.background = swatchColor(current ? current.value : '');
    panel.querySelectorAll('.cs-option').forEach((el) => {
      el.classList.toggle('selected', el.dataset.value === nativeSelect.value);
    });
  }

  function closePanel() {
    panel.classList.remove('open');
    trigger.classList.remove('open');
  }
  function openPanel() {
    panel.classList.add('open');
    trigger.classList.add('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.cs-option');
    if (!opt) return;
    nativeSelect.value = opt.dataset.value;
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    syncTriggerLabel();
    closePanel();
  });

  document.addEventListener('click', closePanel);

  // Si initTheme() (app.js) change select.value par ailleurs (ex: chargement
  // depuis localStorage), on reste synchro.
  nativeSelect.addEventListener('change', syncTriggerLabel);

  syncTriggerLabel();
})();
