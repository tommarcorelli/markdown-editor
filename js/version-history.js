// version-history.js — panneau d'historique de versions, alimenté par
// idb-storage.js. Complète l'autosave (qui n'a qu'un seul état courant) par
// des instantanés successifs dans lesquels on peut revenir.
(function () {
  const overlay = document.createElement('div');
  overlay.className = 'cmd-overlay vh-overlay';
  overlay.innerHTML = `<div class="cmd-modal vh-modal" role="dialog" aria-modal="true" aria-label="Historique des versions">
    <div class="vh-header">
      <span>Historique des versions</span>
      <button type="button" class="vh-close" aria-label="Fermer">✕</button>
    </div>
    <div class="vh-list"></div>
  </div>`;
  document.body.appendChild(overlay);

  const list = overlay.querySelector('.vh-list');
  const closeBtn = overlay.querySelector('.vh-close');
  let lastFocused = null;

  function relativeTime(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const min = Math.round(diff / 60000);
    if (min < 1) return 'à l\'instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.round(h / 24);
    return `il y a ${d} j`;
  }

  function formatAbsolute(ts) {
    return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function renderList() {
    if (typeof idbListVersions !== 'function') {
      list.innerHTML = '<div class="vh-empty">Historique indisponible dans ce navigateur.</div>';
      return;
    }
    const versions = await idbListVersions();
    if (!versions.length) {
      list.innerHTML = '<div class="vh-empty">Pas encore d\'instantané. Un enregistrement automatique est pris toutes les 90 secondes environ pendant la frappe.</div>';
      return;
    }
    list.innerHTML = versions.map((v) => `
      <div class="vh-item" data-id="${v.id}">
        <div class="vh-item-main">
          <span class="vh-item-title">${escapeHtml(v.title || 'sans-titre')}</span>
          <span class="vh-item-meta">${relativeTime(v.ts)} · ${formatAbsolute(v.ts)} · ${v.words} mot${v.words > 1 ? 's' : ''}</span>
        </div>
        <button type="button" class="vh-restore" data-id="${v.id}">Restaurer</button>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function open() {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    renderList();
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

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vh-restore');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const version = await idbGetVersion(id);
    if (!version) return;
    const currentValue = window.mdEditor ? window.mdEditor.getValue() : '';
    const currentTitle = window.mdEditor ? window.mdEditor.getTitle() : '';
    if (currentValue && !confirm('Restaurer cette version ? Le contenu actuel sera remplacé (il reste lui-même récupérable si un instantané récent existe).')) return;
    // On prend un instantané du contenu courant avant d'écraser, pour rester réversible.
    if (typeof idbAddVersion === 'function' && currentValue) idbAddVersion(currentValue, currentTitle, true);
    if (window.mdEditor) window.mdEditor.loadDocument(version.content, version.title || 'sans-titre');
    close();
  });

  const historyBtn = document.getElementById('version-history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      const parentMenu = historyBtn.closest('.menu');
      if (parentMenu) parentMenu.classList.remove('open');
      open();
    });
  }

  window.openVersionHistory = open;
})();
