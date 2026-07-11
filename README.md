# MD. — éditeur markdown

Éditeur markdown en direct, style Typora : aperçu live, 21 thèmes, export HTML/PDF/présentation, PWA offline. 100% front, zéro dépendance CDN (tout est vendorisé en local dans `js/vendor/`), fonctionne en `file://` comme en hébergement statique (GitHub Pages).

## Démarrage

Ouvrir `index.html` directement (double-clic) ou héberger le dossier tel quel sur n'importe quel serveur statique. Aucun build, aucune installation.

---

## Architecture — pour qui reprend ce projet (humain ou IA)

Le projet sépare volontairement **design** et **logique**, pour qu'on puisse travailler sur l'un sans toucher l'autre.

### `css/` — tout ce qui est visuel (terrain de jeu design)
- `editor.css` — le *chrome* de l'appli : topbar, barre d'outils, split-pane, menus. C'est l'interface de l'outil lui-même, pas le rendu des documents.
- `themes/*.css` — les 21 thèmes de **rendu de document** (Github, Nuit, Dracula, Sépia...). Chacun stylise `.markdown-body` uniquement. Ajouter un thème = ajouter un fichier ici + l'enregistrer à 3 endroits (voir plus bas).
- `themes/_base.css` — styles partagés par tous les thèmes (anti-débordement, tableaux responsive, sommaire, numérotation, règles d'impression). Ne pas dupliquer ces règles dans un thème individuel.
- `print.css` — spécifique à l'impression navigateur (Ctrl+P / bouton "Imprimer").

### `js/` — toute la logique (ne pas toucher sans comprendre l'enchaînement)
- `renderer.js` — markdown → HTML (markdown-it + DOMPurify + coloration syntaxique + ancres de titres)
- `editor-cm.js` — instance CodeMirror 6, formatage, listes intelligentes, collage d'images
- `doc-features.js` — sommaire (TOC) et numérotation automatique des sections
- `export.js` — export Markdown brut + HTML autonome (image du thème)
- `export-pdf.js` — PDF "fidèle au thème" (capture d'écran via html2canvas + jsPDF)
- `export-pdf-vector.js` — PDF vectoriel (texte sélectionnable, via pdfmake) + variante "style Word"
- `export-slides.js` — export présentation (découpage sur `---`)
- `storage.js` — autosave localStorage avec repli mémoire si indisponible
- `theme-styles.js` — **généré automatiquement**, ne pas éditer à la main (voir plus bas)
- `app.js` — orchestration générale, branchement des événements UI

### Comment ajouter un thème de document
1. Créer `css/themes/mon-theme.css` (copier un thème existant proche comme base)
2. L'ajouter dans `<select id="theme-select">` (`index.html`)
3. L'ajouter dans le script de génération de `theme-styles.js` (voir commentaire en tête de ce fichier — c'est un `node -e "..."` qui lit tous les fichiers CSS et les embarque en JS, pour éviter tout `fetch()` qui échoue en `file://`) : ajouter le nom du thème au tableau `themes`, plus une entrée dans `THEME_BG`, `THEME_BODY_BG`, `THEME_ACCENT`.
4. Régénérer `theme-styles.js` en relançant ce script.

### Vendoring (`js/vendor/`)
Toutes les libs (markdown-it, DOMPurify, highlight.js, CodeMirror 6, jsPDF, html2canvas, pdfmake) sont bundlées en local via esbuild, jamais chargées depuis un CDN. C'est volontaire : un CDN bloqué (réseau d'école, ad-blocker) cassait silencieusement l'app avant ce choix. Si une lib doit être mise à jour, il faut la re-bundler (esbuild) plutôt que de pointer vers un CDN.

---

## Roadmap — idées non implémentées

Classées par proximité avec l'existant (donc par facilité relative), pas par priorité absolue.

### Édition
- [ ] Coloration syntaxique de l'éditeur découplée du thème de rendu du document (actuellement liées à la palette "encre" fixe)
- [ ] Correcteur orthographique (`spellcheck` est désactivé par défaut sur l'éditeur CodeMirror ; un simple toggle dans le menu Options suffirait)
- [ ] Renommage de document directement depuis le panneau "Mes documents" (aujourd'hui il faut ouvrir le document puis éditer le champ titre)

### Export / PDF
- [ ] Polices custom dans le PDF vectoriel (actuellement Roboto uniquement, faute de fichiers de police Times/Calibri embarqués dans le VFS pdfmake)

### Thèmes / design
- [ ] Éditeur de thème visuel (color picker en direct plutôt que fichiers CSS à écrire)
- [ ] Import/export de thème custom (JSON ou CSS uploadable)

### Fait depuis la rédaction de cette liste (à garder synchronisé !)
Recherche/remplacement (Ctrl+F/H), multi-documents (`js/documents.js`, `js/idb-storage.js`), historique de versions par document, Mermaid, export DOCX/EPUB, notes de bas de page (`[^1]`, le plugin était vendorisé mais jamais réellement branché — corrigé dans `renderer.js`), indicateur hors-ligne et bouton d'installation PWA explicites (`js/pwa-ui.js`). Voir `roadmap.md` à la racine pour le détail et l'historique complet des sessions de travail.

---

## Notes pour un travail de design (ex: Emergent, Figma, ou tout outil visuel)

Si le design de l'interface (`css/editor.css` + structure des composants dans `index.html`) est repris par un autre outil :
- La logique JS (`js/`) ne devrait pas avoir besoin de changer pour un restyle — elle cible des `id`/`class` précis (`#preview`, `.markdown-body`, `.mode-btn[aria-pressed]`, etc.). Si ces sélecteurs changent de nom, il faut répercuter le changement dans `app.js` et `editor-cm.js` (recherche des `getElementById`/`querySelector`).
- Les 21 thèmes de **rendu de document** (`css/themes/*.css`) sont un système à part de l'interface de l'outil — un restyle de l'interface ne devrait pas les affecter, et inversement.
- `_base.css` contient des règles fonctionnelles (pas juste esthétiques) : `overflow-wrap`, `break-inside: avoid` pour l'impression, `scroll-margin-top` pour les ancres. À garder même après un restyle.
