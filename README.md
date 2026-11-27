# Suivi repas et entraînement

Page de suivi nutrition + musculation, publiée sur GitHub Pages :
**https://2jh7gnpt6h-netizen.github.io/Suivientrainement/**

À chaque ouverture, la page récupère dans un dossier Dropbox le fichier `.database`
(sauvegarde GymBook) et le fichier `.rtf` (export Santé) les plus récents
(`server_modified`), puis les lit dans le navigateur. Les données ne sont prises
qu'à partir du 20/10/2026 (`FROM_DATE`).

Aucune donnée n'est dans ce dépôt : uniquement le code. Les données circulent
seulement de Dropbox vers le navigateur et restent sur l'appareil (localStorage).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page. Configuration (`APP_CONFIG`) tout en haut. |
| `glass.css` | Apparence « liquid glass » (verre, couleurs claires et sombres). |
| `motion.js` | Mouvement : entrées animées, compteurs, balayage gauche/droite pour changer de période. |
| `dropbox-sync.js` | Connexion OAuth 2 PKCE, `files/list_folder`, `files/download`, renouvellement du token. |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil (PWA). |
| `sw.js` | Mode hors ligne : la page s'ouvre sans réseau avec les dernières données. |
| `.github/workflows/pages.yml` | Publication sur GitHub Pages à chaque push sur `main` (seuls les fichiers de l'app sont publiés). |

## Configurer l'app Dropbox

1. Va sur https://www.dropbox.com/developers/apps et clique **Create app**.
2. **Choose an API** : *Scoped access*.
3. **Choose the type of access** : *App folder* (accès limité à un seul dossier,
   `Applications/<nom de l'app>` dans ton Dropbox).
4. Donne un nom (ex. `Suivi entrainement`) puis **Create app**.
5. Onglet **Permissions** : coche `files.metadata.read` et `files.content.read`,
   puis **Submit** en bas de page. (Fais-le *avant* de te connecter depuis la page.)
6. Onglet **Settings** :
   - **OAuth 2 → Redirect URIs** : ajoute exactement
     `https://2jh7gnpt6h-netizen.github.io/Suivientrainement/` puis **Add**.
   - **Allow public clients (Implicit Grant & PKCE)** : *Allow*.
   - Copie l'**App key** (pas besoin de l'App secret, ne le partage pas).
7. Place tes exports dans `Applications/<nom de l'app>/` (ou un sous-dossier).

Puis, dans `index.html` :

```js
window.APP_CONFIG = {
  DROPBOX_APP_KEY: "ton_app_key",
  DROPBOX_FOLDER: "/Data Entrainement", // accès complet : chemin depuis la racine du Dropbox
  FROM_DATE: "2026-10-20",
  REDIRECT_URI: ""             // vide = adresse de la page
};
```

## iPhone (écran d'accueil)

Ouvre l'URL dans Safari → Partager → **Sur l'écran d'accueil**. L'app s'ouvre en
plein écran. Connecte Dropbox **depuis l'app installée** (son stockage est séparé
de celui de Safari). Si, après l'autorisation Dropbox, tu te retrouves dans Safari
ou si la connexion ne se finalise pas, utilise **Connexion par code** : Dropbox
affiche un code que tu colles dans l'app.

## Mettre à jour la page

Toute modification poussée sur `main` est republiée automatiquement par GitHub Pages
(Settings → Pages → Source : GitHub Actions) en une à deux minutes.

## Séances : prochaine séance en direct

- **Prochaine séance** (en tête de l'onglet Séances, résumée dans le Bilan) : pour
  chaque exercice, série par série, la dernière fois → l'objectif (une rep de plus
  sur une série, ou la charge à monter quand toutes les séries à la charge max ont
  atteint le plafond de reps réglé), record en vue, plateau, repos. Chaque exercice
  se coche pendant la séance ; les coches restent sur l'appareil jusqu'à minuit et
  la séance en cours revient à la réouverture.
- **Journal des séances** : verdict par exercice par rapport à la fois d'avant
  (+5 kg, +2 reps, pareil…) et séries fléchées en vert ou en rouge.
- Records regroupés par exercice, progression par exercice lisible au téléphone.

## Version test (`/beta/`)

Un espace de test reste publié à part, pour essayer des changements avant de les
mettre sur la page principale : **https://2jh7gnpt6h-netizen.github.io/Suivientrainement/beta/**
(pour l'instant, la même version que la page principale).

- Dans un même navigateur, la version test et la page principale partagent les
  données et la connexion Dropbox (même site).
- Pour se connecter à Dropbox depuis la version test dans un navigateur où l'on
  n'est pas encore connecté : soit « Connexion par code », soit ajouter
  `https://2jh7gnpt6h-netizen.github.io/Suivientrainement/beta/` dans les
  Redirect URIs de l'app Dropbox.
- Pas de service worker propre : celui de la page principale couvre ce dossier.
- Passer la version test en principal : copier `beta/index.html` vers `index.html`
  en retirant la pastille « Version test » et le « (test) » du titre, et en
  remplaçant `../icons/` par `icons/` ; copier `beta/glass.css` et `beta/motion.js`
  à la racine ; garder le `dropbox-sync.js` de la racine (il enregistre le service
  worker) ; changer `VERSION` dans `sw.js` pour renouveler le cache hors ligne.
