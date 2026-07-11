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

## 💡 Proposé, pas encore fait

- **Coloration syntaxique de l'éditeur découplée du thème de rendu** : actuellement liée à une palette fixe ("encre"), indépendante du thème de prévisualisation choisi.
- **Correcteur orthographique** : `spellcheck` est désactivé par défaut sur l'éditeur CodeMirror (comportement natif de CM6) ; un simple toggle dans le menu Options suffirait.
- **Renommage de document depuis le panneau "Mes documents"** : aujourd'hui il faut ouvrir le document puis éditer le champ titre dans la barre du haut.
- **Polices custom dans le PDF vectoriel** : actuellement Roboto uniquement (pdfmake), faute de fichiers de police Times/Calibri embarqués dans son VFS.
- **Éditeur de thème visuel** (color picker en direct) et **import/export de thème custom** : plus gros chantiers côté design.

## Notes techniques

- Le bundle CodeMirror embarqué (`js/vendor/codemirror.min.js`) n'inclut pas `@codemirror/search` ; la recherche/remplacement a été reconstruite au-dessus des primitives déjà présentes (`EditorSelection`, `view.dispatch`) plutôt que d'ajouter une dépendance.
- Toute évolution du stockage passe par `js/idb-storage.js` (IndexedDB, source de vérité) avec repli sur `js/storage.js` (localStorage, mode "un seul document" si IndexedDB est indisponible).
- Schéma IndexedDB v2 : magasin `doc` (un enregistrement par document), `versions` (indexé par `docId`), `meta` (document actif). La migration depuis le schéma v1 (document unique, id fixe `'current'`) se fait dans `onupgradeneeded` et a été testée : le document existant devient simplement le premier document du mode multi-doc, ses anciennes versions sont rattachées à son id.
