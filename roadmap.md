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

## 💡 Proposé, pas encore fait

- **Multi-documents** : une petite liste de documents (sidebar ou menu) plutôt qu'un seul document actif. La structure IndexedDB posée pour l'historique de versions s'y prête déjà — il suffirait de remplacer la clé fixe `'current'` par un id de document.

## Notes techniques

- Le bundle CodeMirror embarqué (`js/vendor/codemirror.min.js`) n'inclut pas `@codemirror/search` ; la recherche/remplacement a été reconstruite au-dessus des primitives déjà présentes (`EditorSelection`, `view.dispatch`) plutôt que d'ajouter une dépendance.
- Toute évolution du stockage passe par `js/idb-storage.js` (IndexedDB, source de vérité) avec repli sur `js/storage.js` (localStorage).
