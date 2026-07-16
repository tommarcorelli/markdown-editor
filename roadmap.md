# Roadmap — Markdown Editor

Suivi des pistes d'amélioration discutées, classées par état.

## ✅ Fait

- **Palette de commandes** : overlay qui bloquait tout le site quand elle était censée être fermée (`display: none` manquant) — corrigé.
- **Accessibilité de la palette de commandes** : `role="dialog"`, `aria-modal`, focus piégé dans la modale, focus rendu à l'élément d'origine à la fermeture.
- **Sélecteur de thème personnalisé** : navigation clavier complète (flèches, Entrée, Échap, retour de focus).
- **Perte de données à l'ouverture d'un fichier** : confirmation ajoutée avant d'écraser un brouillon non sauvegardé (alignée sur le comportement de "Nouveau").
- **Fermeture d'onglet accidentelle** : avertissement navigateur si l'autosave a échoué (`beforeunload`).
- **Barre du haut redessinée** : logo en badge, voyant d'enregistrement visible en permanence, séparateur + mise en avant du menu "Fichier", repli propre en icônes sur mobile (au lieu de faire disparaître le sélecteur de mode et le titre).
- **Stockage sur IndexedDB** : autosave migré de localStorage (5-10 Mo) vers IndexedDB (bien plus de capacité), avec repli automatique sur localStorage si indisponible.
- **Historique de versions** : instantané automatique toutes les ~90s de frappe, jusqu'à 40 versions conservées, restauration depuis *Fichier → Historique des versions* ou Ctrl+P.
- **Suppression / vidage de l'historique** : suppression d'un instantané individuel, ou vidage complet.
- **Réinitialisation complète** : *Fichier → Réinitialiser* efface document + historique + repli localStorage, avec double confirmation.
- **Recherche / remplacement** : Ctrl+F (recherche), Ctrl+H (recherche + remplacement), suivant/précédent, casse sensible ou non, remplacer un/tout remplacer.
- **Glisser-déposer un fichier `.md`/`.txt`** directement sur l'éditeur pour l'ouvrir (avec la même confirmation d'écrasement que *Fichier → Ouvrir*).
- **Ctrl+S** force un enregistrement immédiat (au lieu d'attendre le debounce) avec un flash visuel de confirmation sur le voyant.
- **Mode focus** (Ctrl/Cmd+Shift+F, déjà présent) : masque barre du haut, barre d'outils et barre de statut ; listé ici car vérifié et relié à la palette de commandes.
- **Thème de preview aligné sur le système** : au tout premier lancement (aucun choix enregistré), le thème sombre "Nuit" est proposé si `prefers-color-scheme: dark`, sinon "Github". Un choix explicite ultérieur reste toujours prioritaire.
- **Export HTML plus robuste hors-ligne** : les piles de polices incluent maintenant de bonnes polices système (ui-monospace, SF Mono, Iowan Old Style…) avant les génériques, pour un rendu soigné même quand `fonts.googleapis.com` n'est pas joignable. (Embarquer les polices elles-mêmes en base64 nécessiterait de télécharger les fichiers binaires, hors de portée sans accès réseau ici.)
- **Multi-documents** : *Fichier → Mes documents* liste tous les documents (IndexedDB), avec bascule, duplication et suppression. "Nouveau" et "Ouvrir un fichier" créent désormais un nouveau document au lieu d'écraser celui en cours — plus besoin de confirmation destructive. L'historique de versions est isolé par document. Migration automatique et testée depuis l'ancien schéma à document unique (les utilisateurs existants retrouvent leur brouillon tel quel, transformé en premier document).
- **Bug corrigé — notes de bas de page** : `js/vendor/markdown-it-footnote.min.js` était chargé mais jamais réellement enregistré auprès de markdown-it (`.use()` manquant) — la syntaxe `[^1]` passait donc telle quelle, non interprétée. Branché + stylé dans `_base.css`, testé.
- **Indicateur hors-ligne** : petit badge ambre "Hors ligne" dans la barre du haut, basé sur `navigator.onLine` + les événements `online`/`offline`.
- **Bouton d'installation PWA explicite** : capte `beforeinstallprompt`, affiche un bouton "Installer" dans la barre du haut plutôt que de compter sur la mini-infobar cachée du navigateur.
- **`README.md` remis à jour** : sa propre section roadmap listait comme "non fait" plusieurs choses déjà implémentées (Mermaid, export DOCX/EPUB) — corrigé, et les vrais points restants y sont maintenant à jour.
- **Coloration syntaxique de l'éditeur découplée du thème d'aperçu** : 4 palettes au choix (Encre/Minimal/Solaire/Forge) dans le menu Options, pilotées par des variables CSS (`--syn-*`) plutôt que des couleurs codées en dur dans `editor-cm.js`. Persisté et appliqué au chargement.
- **Correcteur orthographique** : toggle dans le menu Options (`spellcheck` était désactivé par défaut, comportement natif de CodeMirror 6).
- **Renommage depuis "Mes documents"** : bouton ✏️ par document, édition du titre en ligne (Entrée valide, Échap annule), sans avoir besoin d'ouvrir le document.
- **Bug corrigé — bouton mort** : le menu Options avait un bouton "Réinitialiser l'application…" jamais branché à aucun code JS (probablement un reliquat d'une itération précédente). Retiré ; le "Réinitialiser" du menu Fichier (fonctionnel, testé) couvre déjà ce besoin.
- **Éditeur de thème visuel** : nouveau thème "🎨 Personnalisé" (`css/themes/personnalise.css`, piloté par variables CSS `--ct-*`) + panneau `js/theme-editor.js` avec 11 color pickers, 3 préréglages cohérents (Clair/Sombre/Sépia), export/import JSON, application en direct sur l'aperçu, et prise en compte correcte dans l'export HTML autonome (les vraies couleurs sont embarquées, pas seulement les valeurs par défaut du template).

- **6 nouveaux thèmes de rendu/export HTML** : Bauhaus (géométrique, couleurs primaires), Journal (presse écrite classique, serif), Aurore (pastel doux), Blueprint (plan technique, grille bleu nuit), Terracotta (tons argile/désert), Glacier (bleu glacé épuré). Suivent le même pattern que les thèmes existants : fichier `css/themes/<nom>.css` pour le preview, entrées dans `THEME_CSS`/`THEME_BG`/`THEME_BODY_BG`/`THEME_ACCENT` (js/theme-styles.js) pour l'export HTML autonome, `<option>` dans le sélecteur (index.html — le sélecteur visuel personnalisé de custom-select.js les récupère automatiquement), et ajout au cache `sw.js` (bump v16→v17 pour forcer la mise à jour offline).

- **3 thèmes inspirés de maisons de fiction** : Stark (gris pierre/glace, sobre et froid), Targaryen (noir/rouge/or, feu), Lannister (pourpre/or, héraldique) — palettes de couleurs uniquement, aucun blason ni asset visuel reproduit. Mêmes 4 points de synchronisation que les autres thèmes (css/themes/, theme-styles.js, index.html, sw.js — cache v17→v18).

- **2 nouvelles mises en page PDF vectorielles** (js/export-pdf-vector.js) : **Lettre** (sobre, sans sommaire ni numérotation de sections, marges généreuses façon courrier) et **Académique** (page de titre dédiée, sommaire, texte de corps justifié, en-tête avec titre courant en italique). S'ajoutent aux 2 layouts existants (Rapport = thème actif, Style Word = neutre administratif) — 4 mises en page PDF au total, toutes accessibles depuis le menu Fichier et la palette de commandes. Cache `sw.js` bumpé v18→v19.

- **4 mises en page pour l'export DOCX** (js/enhancements.js) : **Style Word** (existant, Calibri neutre), **Rapport** (couleurs du thème actif via `THEME_ACCENT`, marges resserrées), **Lettre** (serif Cambria, marges généreuses 1.25", date en en-tête), **Académique** (serif Times New Roman, corps de texte justifié, titre + date centrés). Les marges de page varient réellement par mise en page (option `margins` de `htmlDocx.asBlob`, en twips) — pas seulement du CSS cosmétique. Limite connue : `html-docx-js` ne traduit pas les en-têtes/pieds de page dynamiques ni les mises en page à colonnes, donc pas de numérotation de page ou de titre courant côté Word (contrairement au PDF vectoriel). Cache `sw.js` bumpé v19→v20.

## 💡 Proposé, pas encore fait — et pourquoi

- **Polices custom dans le PDF vectoriel** : vraiment tenté cette fois (recherche d'une alternative libre à Times New Roman — "Tinos", licence Apache 2.0, donc légale à embarquer) mais mes outils de récupération web sont conçus pour extraire du texte/HTML, pas des fichiers binaires bruts ; la récupération du `.ttf` réel a échoué (404 même sur l'URL trouvée dans les résultats de recherche). Reste bloqué dans cet environnement précis, pas dans l'absolu — avec un accès réseau normal (`curl`/téléchargement de fichier), ce serait une tâche simple.

## Vérifications de fin de session
Repasse complète du code après la dernière série de changements : tous les fichiers JS syntaxiquement valides, tous les `<script>` de `index.html` correspondent à des fichiers réels (et inversement), la liste de cache de `sw.js` est complète et cohérente avec les thèmes disponibles, le HTML est bien balancé (parseur automatique), aucun id HTML dupliqué, aucune collision de clé `localStorage` entre modules, et un test bout-en-bout combinant notes de bas de page + Ctrl+S + recherche + multi-documents + thème personnalisé + mode focus + historique de versions + persistance après rechargement — tout passe, zéro erreur JS.

## Notes techniques

- Le bundle CodeMirror embarqué (`js/vendor/codemirror.min.js`) n'inclut pas `@codemirror/search` ; la recherche/remplacement a été reconstruite au-dessus des primitives déjà présentes (`EditorSelection`, `view.dispatch`) plutôt que d'ajouter une dépendance.
- Toute évolution du stockage passe par `js/idb-storage.js` (IndexedDB, source de vérité) avec repli sur `js/storage.js` (localStorage, mode "un seul document" si IndexedDB est indisponible).
- Schéma IndexedDB v2 : magasin `doc` (un enregistrement par document), `versions` (indexé par `docId`), `meta` (document actif). La migration depuis le schéma v1 (document unique, id fixe `'current'`) se fait dans `onupgradeneeded` et a été testée : le document existant devient simplement le premier document du mode multi-doc, ses anciennes versions sont rattachées à son id.
