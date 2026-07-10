// sw.js — cache-first pour l'app shell, pour un fonctionnement 100% hors-ligne
const CACHE_NAME = 'md-editor-v12';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/editor.css',
  './css/print.css',
  './css/vendor/atom-one-dark.min.css',
  './css/themes/_base.css',
  './css/themes/github.css',
  './css/themes/minimal.css',
  './css/themes/academique.css',
  './css/themes/ardoise.css',
  './css/themes/kraft.css',
  './css/themes/sepia.css',
  './css/themes/corail.css',
  './css/themes/rose.css',
  './css/themes/lavande.css',
  './css/themes/solarized.css',
  './css/themes/nord.css',
  './css/themes/foret.css',
  './css/themes/encre.css',
  './css/themes/nuit.css',
  './css/themes/dracula.css',
  './css/themes/gruvbox.css',
  './css/themes/monochrome.css',
  './css/themes/terminal.css',
  './css/themes/synthwave.css',
  './css/themes/neobrutalist.css',
  './css/themes/cyberpunk.css',
  './js/renderer.js',
  './js/storage.js',
  './js/idb-storage.js',
  './js/themes.js',
  './js/theme-styles.js',
  './js/doc-features.js',
  './js/export.js',
  './js/export-slides.js',
  './js/editor-cm.js',
  './js/app.js',
  './js/find-replace.js',
  './js/version-history.js',
  './js/vendor/markdown-it.min.js',
  './js/vendor/purify.min.js',
  './js/vendor/highlight.min.js',
  './js/vendor/codemirror.min.js',
  './js/vendor/pdf-libs.min.js',
  './js/export-pdf.js',
  './js/vendor/pdfmake.min.js',
  './js/vendor/vfs_fonts.js',
  './js/export-pdf-vector.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/custom-select.js',
  './js/enhancements.js',
  './js/vendor/mermaid.min.js',
  './js/vendor/html-docx.min.js',
  './js/vendor/jszip.min.js',
  './js/vendor/markdown-it-footnote.min.js',
  './css/themes/vermillon.css',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first pour tout ce qui est même origine (app shell) ;
// on laisse passer normalement les requêtes externes (ex : Google Fonts).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
