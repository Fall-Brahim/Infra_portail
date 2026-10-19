# Selam Infra — Dashboard (Angular)

Portail d'administration du cluster **Proxmox VE** `pve-cluster`.
Ce projet est le client du backend Django REST Framework situé dans
`../selam_infra` (API : `/api/...`).

## Fonctionnalités

- **Connexion** JWT (login / mot de passe) avec stockage de session et
  rafraîchissement automatique du jeton d'accès.
- **Tableau de bord** : santé du cluster, quorum, nœuds en ligne / hors ligne,
  agrégats CPU / mémoire / stockage, compteurs VMs et conteneurs LXC.
  Rafraîchissement automatique toutes les 15 s (désactivable).
- **Graphiques d'historique** (chart.js) :
  - Cluster : courbes CPU, RAM et réseau avec sélecteur **1 h / 24 h / 7 j**,
    anneau de répartition des VMs, barres CPU/RAM par nœud avec seuils de
    couleur (orange > 75 %, rouge > 90 %), bandeau d'alerte si des nœuds sont
    hors ligne.
  - Détail d'une VM : courbes CPU et RAM, réseau (entrant/sortant) et E/S
    disque.
  - Journal : barres des actions par jour (succès / échecs), sur 7 ou 30 jours.
  - L'historique est rafraîchi **toutes les 60 s** ; le reste toutes les 15 s.
  - Skeletons de chargement et message « aucune donnée » quand la série est vide.
- **VMs** : liste unifiée qemu + lxc, recherche, filtres (état, type, nœud,
  pool, templates), pagination, actions `start` / `stop` / `shutdown` / `reboot`.
- **Actions en direct** : au clic, la ligne passe en état « en cours »
  (badge + spinner, boutons désactivés), le portail suit la tâche Proxmox
  (1er appel après 1 s, puis toutes les 2 s, arrêt à la fin, timeout 60 s) puis
  recharge **uniquement la VM concernée** et affiche le résultat final
  (« xtp-preprod arrêtée »). En cas d'échec ou de timeout, un message d'erreur
  clair est affiché et la liste est rechargée. Plusieurs actions simultanées
  sur des VMs différentes sont gérées, et tout le polling est arrêté à la
  destruction du composant.
- **Détail d'une VM** : configuration (cœurs, RAM, disques, réseau, OS),
  statut courant, adresse IP (best effort), ticket de console noVNC.
- **Journal d'audit** : historique filtrable des actions (lecture seule).
- **Locale française** : dates au format `jj/MM/aaaa hh:mm`, filtres en
  `jj/mm/aaaa`.

## Installation

```bash
npm install
```

## Lancement

Le backend Django doit tourner sur `http://127.0.0.1:8000` :

```bash
cd ../selam_infra
source ../.infra/bin/activate
python manage.py runserver 127.0.0.1:8000
```

Puis, dans ce dossier :

```bash
npm start          # http://localhost:4200
```

Le proxy de développement (`proxy.conf.json`) transmet `/api/**` au backend
Django : aucune configuration CORS n'est nécessaire en développement.

### Comptes de test côté backend

```bash
cd ../selam_infra
python manage.py init_roles
# créer un technicien
python manage.py createsuperuser     # rôle admin
```

## Configuration

| Élément | Valeur | Où |
|---|---|---|
| URL de l'API | `/api` (même origine) | `src/app/core/api.config.ts` — `API_BASE_URL` |
| Cible du proxy de dev | `http://127.0.0.1:8000` | `proxy.conf.json` |
| Origine CORS (si API distante) | `http://localhost:4200` | `.env` du backend : `CORS_ALLOWED_ORIGINS` |

Pour appeler une API sur une autre origine, fournissez `API_BASE_URL` :

```ts
{ provide: API_BASE_URL, useValue: 'http://192.168.1.10:8000/api' }
```

## Architecture

```
src/app/
├── core/                     # socle transverse
│   ├── api.config.ts         # token d'injection API_BASE_URL
│   ├── auth.service.ts       # session JWT (signaux + localStorage)
│   ├── auth.interceptor.ts   # Bearer + refresh sur 401
│   ├── auth.guard.ts         # authGuard / guestGuard
│   ├── cluster.service.ts
│   ├── vm.service.ts         # VMs + taskStatus()
│   ├── task.service.ts       # suivi des tâches Proxmox (polling)
│   ├── log.service.ts
│   ├── models.ts             # contrats TypeScript de l'API
│   └── format.ts             # octets, durées, dates, libellés
├── shared/                   # composants réutilisables
│   ├── line-chart.ts         # <app-line-chart>
│   ├── bar-chart.ts          # <app-bar-chart>
│   ├── donut-chart.ts        # <app-donut-chart>
│   └── chart-theme.ts        # thème sombre, seuils, formatage
└── features/
    ├── login/                # page de connexion
    ├── layout/               # charpente (en-tête, navigation)
    ├── dashboard/            # cluster + graphiques
    ├── vms/                  # liste + détail (+ graphiques)
    └── logs/                 # journal d'audit + statistiques
```

- Angular 22, **composants standalone** (pas de NgModule), **zoneless**,
  signaux partout, nouvelle syntaxe de contrôle de flux (`@if` / `@for`).
- Routes **chargées à la demande** (`loadComponent`) : chart.js reste dans un
  chunk lazy et le bundle initial reste à ~97 ko (transfert).
- Graphiques : `chart.js` 4.5 + `ng2-charts` 11 (peer dependency :
  `@angular/cdk`). Aucune autre dépendance ajoutée.

## Tests

```bash
npm test -- --watch=false
```

Les tests (vitest) couvrent le service d'authentification (connexion,
persistance, expiration, rafraîchissement), les formateurs d'affichage, le
rendu du tableau de bord (nœud hors ligne, bandeau d'alerte, sélecteur de
période, message « aucune donnée ») et le cycle de vie d'une action sur une VM
(attente, badge « Arrêt… », suivi de la tâche, mise à jour de la ligne, échec,
actions simultanées).

> Note : le rendu des graphiques n'est pas vérifié en test unitaire — jsdom ne
> fournit pas de contexte canvas. Les assertions portent sur l'état du
> composant (séries, labels, messages).

## Build

```bash
npm run build
```

## Points à connaître

- **Rendu client** : l'application est un portail protégé par JWT ; le
  rendu serveur est désactivé (`RenderMode.Client` dans
  `src/app/app.routes.server.ts`) car le jeton vit dans le navigateur.
- **Console noVNC** : le backend renvoie bien le ticket et le port, mais
  l'affichage de la console nécessite le proxy WebSocket nginx, prévu lors
  d'une prochaine étape. L'écran de détail affiche le ticket obtenu.
- **Arrêt forcé** : le bouton « Forcer » appelle `stop` (arrêt brutal),
  distinct de « Arrêter » (`shutdown`, arrêt orderly).
- **Compte technicien** : le journal d'audit ne contient que ses propres
  entrées (restriction appliquée côté backend).
