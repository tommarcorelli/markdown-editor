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
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <span class="cs-swatch" id="cs-current-swatch"></span>
    <span id="cs-current-label"></span>
    <svg class="cs-trigger-arrow" viewBox="0 0 10 6" width="10" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
  `;

  const panel = document.createElement('div');
  panel.className = 'cs-panel';
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('tabindex', '-1');
  panel.innerHTML = options.map((o) => `
    <div class="cs-option" role="option" tabindex="-1" data-value="${o.value}">
      <span class="cs-swatch" style="background:${swatchColor(o.value)}"></span>
      <span>${o.label}</span>
    </div>
  `).join('');

  wrap.appendChild(trigger);
  wrap.appendChild(panel);

  let activeOptIdx = 0;

  function syncTriggerLabel() {
    const current = options.find((o) => o.value === nativeSelect.value) || options[0];
    trigger.querySelector('#cs-current-label').textContent = current ? current.label : '';
    trigger.querySelector('#cs-current-swatch').style.background = swatchColor(current ? current.value : '');
    trigger.setAttribute('aria-label', 'Thème de rendu : ' + (current ? current.label : ''));
    panel.querySelectorAll('.cs-option').forEach((el, i) => {
      const isSelected = el.dataset.value === nativeSelect.value;
      el.classList.toggle('selected', isSelected);
      el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      if (isSelected) activeOptIdx = i;
    });
  }

  function closePanel() {
    panel.classList.remove('open');
    trigger.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function openPanel() {
    panel.classList.add('open');
    trigger.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    setActiveOption(activeOptIdx);
  }

  function setActiveOption(idx) {
    const opts = panel.querySelectorAll('.cs-option');
    if (!opts.length) return;
    activeOptIdx = Math.max(0, Math.min(opts.length - 1, idx));
    opts.forEach((el, i) => el.classList.toggle('active', i === activeOptIdx));
    opts[activeOptIdx].scrollIntoView({ block: 'nearest' });
  }

  function chooseOption(idx) {
    const opt = options[idx];
    if (!opt) return;
    nativeSelect.value = opt.value;
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    syncTriggerLabel();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  trigger.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      if (!panel.classList.contains('open')) openPanel();
      else if (e.key === 'Enter' || e.key === ' ') { chooseOption(activeOptIdx); closePanel(); }
      if (e.key === 'ArrowDown') setActiveOption(activeOptIdx + 1);
      if (e.key === 'ArrowUp') setActiveOption(activeOptIdx - 1);
    } else if (e.key === 'Escape' && panel.classList.contains('open')) {
      e.preventDefault();
      closePanel();
    }
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveOption(activeOptIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveOption(activeOptIdx - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseOption(activeOptIdx); closePanel(); trigger.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePanel(); trigger.focus(); }
    else if (e.key === 'Tab') { closePanel(); }
  });

  panel.addEventListener('mousemove', (e) => {
    const opt = e.target.closest('.cs-option');
    if (!opt) return;
    const idx = Array.from(panel.children).indexOf(opt);
    if (idx !== -1) setActiveOption(idx);
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.cs-option');
    if (!opt) return;
    const idx = Array.from(panel.children).indexOf(opt);
    chooseOption(idx);
    closePanel();
    trigger.focus();
  });

  document.addEventListener('click', closePanel);

  // Si initTheme() (app.js) change select.value par ailleurs (ex: chargement
  // depuis localStorage), on reste synchro.
  nativeSelect.addEventListener('change', syncTriggerLabel);

  syncTriggerLabel();
})();
