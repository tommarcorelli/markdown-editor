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

## 💡 Proposé, pas encore fait — et pourquoi

- **Polices custom dans le PDF vectoriel** : bloqué dans cet environnement précisément — embarquer une police dans pdfmake nécessite ses fichiers binaires (TTF/OTF), donc un accès réseau pour les télécharger, indisponible ici.
- **Éditeur de thème visuel (color picker en direct) + import/export de thème custom** : volontairement pas fait cette fois. C'est un vrai chantier à part entière (interface de color picker, mapping de chaque variable vers un aperçu live, gestion de la validation/export d'un format de thème) plutôt qu'une amélioration ponctuelle — mérite sa propre session de travail dédiée plutôt qu'être casé à la fin de celle-ci.

## Notes techniques

- Le bundle CodeMirror embarqué (`js/vendor/codemirror.min.js`) n'inclut pas `@codemirror/search` ; la recherche/remplacement a été reconstruite au-dessus des primitives déjà présentes (`EditorSelection`, `view.dispatch`) plutôt que d'ajouter une dépendance.
- Toute évolution du stockage passe par `js/idb-storage.js` (IndexedDB, source de vérité) avec repli sur `js/storage.js` (localStorage, mode "un seul document" si IndexedDB est indisponible).
- Schéma IndexedDB v2 : magasin `doc` (un enregistrement par document), `versions` (indexé par `docId`), `meta` (document actif). La migration depuis le schéma v1 (document unique, id fixe `'current'`) se fait dans `onupgradeneeded` et a été testée : le document existant devient simplement le premier document du mode multi-doc, ses anciennes versions sont rattachées à son id.
