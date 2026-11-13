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
| `dropbox-sync.js` | Connexion OAuth 2 PKCE, `files/list_folder`, `files/download`, renouvellement du token. |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil (PWA). |
| `sw.js` | Mode hors ligne : la page s'ouvre sans réseau avec les dernières données. |
| `.nojekyll` | Publication telle quelle par GitHub Pages (Settings → Pages → Deploy from a branch → main / root). |

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
  DROPBOX_FOLDER: "",          // "" = racine du dossier de l'app, ou "/Exports"
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
