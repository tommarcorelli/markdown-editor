// documents.js — panneau "Mes documents", alimenté par idb-storage.js.
// Complète le passage au multi-documents : avant, "Nouveau"/"Ouvrir"
// écrasaient le document courant ; maintenant chaque document est un
// enregistrement distinct et ce panneau permet de naviguer entre eux.
(function () {
  const overlay = document.createElement('div');
  overlay.className = 'cmd-overlay dc-overlay';
  overlay.innerHTML = `<div class="cmd-modal vh-modal" role="dialog" aria-modal="true" aria-label="Mes documents">
    <div class="vh-header">
      <span>Mes documents</span>
      <div class="vh-header-actions">
        <button type="button" class="dc-new">+ Nouveau</button>
        <button type="button" class="vh-close" aria-label="Fermer">✕</button>
      </div>
    </div>
    <div class="vh-list dc-list"></div>
  </div>`;
  document.body.appendChild(overlay);

  const list = overlay.querySelector('.dc-list');
  const closeBtn = overlay.querySelector('.vh-close');
  const newBtn = overlay.querySelector('.dc-new');
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function startRename(id) {
    const titleEl = list.querySelector(`.dc-title[data-id="${id}"]`);
    if (!titleEl || titleEl.querySelector('input')) return; // déjà en cours d'édition
    const currentTitle = titleEl.dataset.title || 'sans-titre';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dc-rename-input';
    input.value = currentTitle;
    titleEl.textContent = '';
    titleEl.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    async function commit() {
      if (done) return;
      done = true;
      const newTitle = input.value.trim() || 'sans-titre';
      if (newTitle !== currentTitle && window.mdEditor) {
        await window.mdEditor.renameDocument(id, newTitle);
      }
      renderList();
    }
    function cancel() {
      if (done) return;
      done = true;
      renderList();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  async function renderList() {
    if (!window.mdEditor || typeof window.mdEditor.listDocuments !== 'function') {
      list.innerHTML = '<div class="vh-empty">Le multi-documents nécessite IndexedDB, indisponible dans ce navigateur.</div>';
      return;
    }
    const docs = await window.mdEditor.listDocuments();
    const activeId = window.mdEditor.getActiveDocId();
    if (!docs.length) {
      list.innerHTML = '<div class="vh-empty">Aucun document pour l\'instant.</div>';
      return;
    }
    list.innerHTML = docs.map((d) => `
      <div class="vh-item dc-item ${d.id === activeId ? 'dc-active' : ''}" data-id="${d.id}">
        <div class="vh-item-main">
          <div class="dc-title-row">
            <span class="vh-item-title dc-title" data-id="${d.id}" data-title="${escapeHtml(d.title || 'sans-titre')}">${escapeHtml(d.title || 'sans-titre')}</span>${d.id === activeId ? ' <span class="dc-current-tag">actuel</span>' : ''}
          </div>
          <span class="vh-item-meta">${relativeTime(d.updatedAt)} · ${d.words} mot${d.words > 1 ? 's' : ''}</span>
        </div>
        <div class="vh-item-actions">
          ${d.id === activeId ? '' : '<button type="button" class="vh-restore dc-open" data-id="' + d.id + '">Ouvrir</button>'}
          <button type="button" class="fr-btn dc-rename" data-id="${d.id}" title="Renommer" aria-label="Renommer">✏️</button>
          <button type="button" class="fr-btn dc-dup" data-id="${d.id}" title="Dupliquer" aria-label="Dupliquer">⧉</button>
          <button type="button" class="vh-delete dc-del" data-id="${d.id}" title="Supprimer" aria-label="Supprimer">🗑</button>
        </div>
      </div>
    `).join('');
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

  newBtn.addEventListener('click', async () => {
    if (!window.mdEditor) return;
    await window.mdEditor.newDocument();
    close();
  });

  list.addEventListener('click', async (e) => {
    if (!window.mdEditor) return;

    const openBtn = e.target.closest('.dc-open');
    if (openBtn) {
      await window.mdEditor.switchDocument(openBtn.dataset.id);
      close();
      return;
    }

    const dupBtn = e.target.closest('.dc-dup');
    if (dupBtn) {
      await window.mdEditor.duplicateDocument(dupBtn.dataset.id);
      renderList();
      return;
    }

    const renameBtn = e.target.closest('.dc-rename');
    if (renameBtn) {
      startRename(renameBtn.dataset.id);
      return;
    }

    const delBtn = e.target.closest('.dc-del');
    if (delBtn) {
      if (!confirm('Supprimer ce document ainsi que tout son historique de versions ? Cette action est définitive.')) return;
      await window.mdEditor.deleteDocument(delBtn.dataset.id);
      renderList();
      return;
    }
  });

  const docsBtn = document.getElementById('documents-btn');
  if (docsBtn) {
    docsBtn.addEventListener('click', () => {
      const parentMenu = docsBtn.closest('.menu');
      if (parentMenu) parentMenu.classList.remove('open');
      open();
    });
  }

  window.openDocuments = open;
})();
