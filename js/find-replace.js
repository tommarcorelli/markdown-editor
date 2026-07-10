// find-replace.js — panneau de recherche/remplacement, ancré en haut du
// volet éditeur (pas une modale plein écran : on doit voir le document
// pendant qu'on cherche).
(function () {
  const editorMount = document.getElementById('editor-mount');
  if (!editorMount) return;

  const panel = document.createElement('div');
  panel.className = 'fr-panel';
  panel.innerHTML = `
    <div class="fr-row">
      <input type="text" class="fr-input fr-find" placeholder="Rechercher…" autocomplete="off" spellcheck="false" aria-label="Rechercher">
      <span class="fr-count">0/0</span>
      <button type="button" class="fr-btn fr-prev" title="Précédent (Shift+Entrée)" aria-label="Précédent">↑</button>
      <button type="button" class="fr-btn fr-next" title="Suivant (Entrée)" aria-label="Suivant">↓</button>
      <label class="fr-case"><input type="checkbox" class="fr-case-check"> Aa</label>
      <button type="button" class="fr-btn fr-toggle-replace" title="Afficher le remplacement" aria-label="Afficher le remplacement">⇄</button>
      <button type="button" class="fr-btn fr-close" title="Fermer (Échap)" aria-label="Fermer">✕</button>
    </div>
    <div class="fr-row fr-replace-row" hidden>
      <input type="text" class="fr-input fr-replace" placeholder="Remplacer par…" autocomplete="off" spellcheck="false" aria-label="Remplacer par">
      <button type="button" class="fr-btn fr-replace-one">Remplacer</button>
      <button type="button" class="fr-btn fr-replace-all">Tout remplacer</button>
    </div>
  `;
  editorMount.style.position = editorMount.style.position || 'relative';
  editorMount.appendChild(panel);

  const findInput = panel.querySelector('.fr-find');
  const replaceInput = panel.querySelector('.fr-replace');
  const countEl = panel.querySelector('.fr-count');
  const caseCheck = panel.querySelector('.fr-case-check');
  const replaceRow = panel.querySelector('.fr-replace-row');

  function api() { return window.mdEditor; }

  function updateCount() {
    if (!api()) return;
    const q = findInput.value;
    if (!q) { countEl.textContent = '0/0'; return; }
    const { index, total } = api().matchInfo(q, caseCheck.checked);
    countEl.textContent = total ? `${index >= 0 ? index + 1 : 1}/${total}` : '0/0';
  }

  function open(withReplace) {
    panel.classList.add('open');
    if (withReplace) { replaceRow.hidden = false; }
    const selectedText = api() && api().getView ? '' : ''; // pas de sélection exposée, on repart du champ existant
    setTimeout(() => { findInput.focus(); findInput.select(); }, 20);
    updateCount();
  }
  function close() {
    panel.classList.remove('open');
    if (api()) api().focus();
  }

  findInput.addEventListener('input', updateCount);
  caseCheck.addEventListener('change', updateCount);

  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!api() || !findInput.value) return;
      if (e.shiftKey) api().findPrev(findInput.value, caseCheck.checked);
      else api().findNext(findInput.value, caseCheck.checked);
      updateCount();
    } else if (e.key === 'Escape') {
      close();
    }
  });
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doReplaceOne(); }
    else if (e.key === 'Escape') { close(); }
  });

  panel.querySelector('.fr-next').addEventListener('click', () => { if (findInput.value) { api().findNext(findInput.value, caseCheck.checked); updateCount(); } findInput.focus(); });
  panel.querySelector('.fr-prev').addEventListener('click', () => { if (findInput.value) { api().findPrev(findInput.value, caseCheck.checked); updateCount(); } findInput.focus(); });
  panel.querySelector('.fr-close').addEventListener('click', close);
  panel.querySelector('.fr-toggle-replace').addEventListener('click', () => {
    replaceRow.hidden = !replaceRow.hidden;
    if (!replaceRow.hidden) replaceInput.focus();
  });

  function doReplaceOne() {
    if (!api() || !findInput.value) return;
    api().replaceCurrent(findInput.value, replaceInput.value, caseCheck.checked);
    updateCount();
    findInput.focus();
  }
  function doReplaceAll() {
    if (!api() || !findInput.value) return;
    const n = api().replaceAll(findInput.value, replaceInput.value, caseCheck.checked);
    countEl.textContent = n ? `0/${n} remplacé${n > 1 ? 's' : ''}` : '0/0';
    findInput.focus();
  }
  panel.querySelector('.fr-replace-one').addEventListener('click', doReplaceOne);
  panel.querySelector('.fr-replace-all').addEventListener('click', doReplaceAll);

  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      open(false);
    } else if (mod && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      open(true);
    } else if (e.key === 'Escape' && panel.classList.contains('open') && document.activeElement !== findInput && document.activeElement !== replaceInput) {
      close();
    }
  });

  window.openFindReplace = open;
})();
