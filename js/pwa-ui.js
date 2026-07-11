// pwa-ui.js — deux détails d'expérience PWA identifiés comme manquants :
// un indicateur "hors ligne" visible (jusqu'ici invisible : l'app continue
// de fonctionner offline grâce au service worker, mais rien ne le signalait)
// et un bouton d'installation explicite (jusqu'ici uniquement accessible via
// le menu natif, caché, du navigateur).
(function () {
  // ---------- Indicateur hors ligne ----------
  const badge = document.getElementById('offline-badge');
  function updateOnlineStatus() {
    if (!badge) return;
    badge.hidden = navigator.onLine;
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // ---------- Bouton "Installer" ----------
  const installBtn = document.getElementById('install-btn');
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Le navigateur affiche par défaut sa propre mini-infobar ; on la
    // remplace par un bouton dans l'UI, plus visible et cohérent avec le
    // reste de l'interface.
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      installBtn.hidden = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
    deferredPrompt = null;
  });
})();
