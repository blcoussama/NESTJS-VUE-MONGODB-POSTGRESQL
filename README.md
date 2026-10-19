# PROFYLE v2

Plateforme de recrutement : des recruteurs publient des offres d'emploi, des candidats postulent, gèrent leur profil et (à terme) échangent en temps réel avec les recruteurs.

PROFYLE est un **projet personnel / portfolio technique**, réécrit en v2 (Express/React → NestJS/Vue). Le dépôt est public : il ne contient aucun secret, et l'application n'est **pas déployée** à ce jour.

> Statut : backend v2 complet (auth, profils, sociétés, offres, candidatures, favoris, chat temps réel Socket.io), frontend Vue 3 + Pinia branché sur l'API, tests unitaires, e2e et navigateur verts en local. CI GitHub Actions écrite, **à valider par un premier run GitHub** ; aucun déploiement (voir [État d'avancement](#état-davancement)).

## Sommaire

1. [Stack](#stack)
2. [Architecture](#architecture)
3. [Fonctionnalités](#fonctionnalités)
4. [Démarrage local](#démarrage-local)
5. [Variables d'environnement](#variables-denvironnement)
6. [Scripts](#scripts)
7. [Tests et CI](#tests-et-ci)
8. [Structure du dépôt](#structure-du-dépôt)
9. [API](#api)
10. [Sécurité](#sécurité)
11. [État d'avancement](#état-davancement)
12. [Ancien frontend](#ancien-frontend)
13. [Licence](#licence)

## Stack

| Couche | Technologies |
|---|---|
| Backend | Node.js 22, NestJS 11, TypeScript 5, Passport + JWT, class-validator, Joi (validation de l'environnement), Swagger (OpenAPI), Helmet, Nodemailer, AWS SDK v3 (S3), Socket.io (dépendance installée, chat à faire) |
| Données | PostgreSQL via Prisma 7 (adapter `@prisma/adapter-pg`), MongoDB via Mongoose 9 |
| Frontend | Vue 3 (Composition API), Pinia, Vue Router, TypeScript, Vite, Tailwind CSS 4, Vitest |
| Qualité | ESLint, Prettier, Jest (+ Supertest pour l'e2e), vue-tsc |
| Packaging / CI | Docker (images multi-étapes), Docker Compose, nginx (non-root), GitHub Actions, gitleaks |

Polyglot persistence : **MongoDB** pour les utilisateurs (profils candidat/recruteur au schéma flexible) et les futurs messages ; **PostgreSQL** pour les données relationnelles (sociétés, offres, candidatures, favoris) avec contraintes et suppressions en cascade. Les champs `ownerId`, `recruiterId`, `applicantId`, `userId` côté PostgreSQL sont des `String` qui référencent un `_id` MongoDB (pas de clé étrangère possible entre les deux bases).

## Architecture

```
                       Navigateur
                           |
                           v
              +---------------------------+
              |  frontend  (nginx :8080)  |   SPA Vue 3 (fichiers statiques)
              |  en-têtes de sécurité     |
              +------+-----------+--------+
                     | /api      | /socket.io  (proxy)
                     v           v
              +---------------------------+
              |  backend  (NestJS :3000)  |   préfixe global /api
              |  Swagger : /api/docs      |   Helmet, ValidationPipe, JWT
              +------+-------------+------+
                     |             |         \
                     v             v          v
              +-----------+  +-----------+  +-------------+   +-------------+
              | PostgreSQL|  |  MongoDB  |  |   AWS S3    |   |  SMTP       |
              | (Prisma)  |  | (Mongoose)|  | avatars/logos|  | (Nodemailer)|
              | companies |  | users     |  | CV (URL     |   | vérif. email|
              | jobs ...  |  | messages* |  |  présignées)|   | reset mdp   |
              +-----------+  +-----------+  +-------------+   +-------------+
                                                                  * à venir
```

Au sein du backend : `Controller → Service → PrismaService / modèle Mongoose`. Pas de logique métier dans les contrôleurs.

## Fonctionnalités

- **Comptes** : inscription candidat ou recruteur, vérification d'e-mail (renvoi possible), connexion, session par refresh token rotatif (cookie `httpOnly`), déconnexion, mot de passe oublié / réinitialisation.
- **Profils** : champs propres à chaque rôle (expériences, formations, compétences pour le candidat), avatar, CV PDF sur S3 (CV consulté par URL présignée).
- **Sociétés** : une société par recruteur, logo, gestion par le propriétaire.
- **Offres** : création / modification / fermeture par le recruteur propriétaire, recherche publique avec filtres (texte, lieu, type de contrat, niveau, société), tri et pagination.
- **Candidatures** : postuler (une fois par offre), suivi des statuts, retrait par le candidat (suppression planifiée après 30 jours), acceptation / refus par le recruteur en transaction, accès au CV du candidat.
- **Favoris** : enregistrer / retirer une offre, liste des offres enregistrées.
- **Chat temps réel** : Socket.io authentifié par JWT, autorisé seulement entre un recruteur et un candidat reliés par une candidature ; non-lus, « en train d'écrire », présence, historique paginé.
- **Interface Vue 3** : toutes les pages ci-dessus, gardes de routes par rôle, jeton d'accès gardé en mémoire uniquement (jamais dans `localStorage`).

## Démarrage local

### Prérequis

- Node.js 22 (`^22.18` ou `>=24.12` pour le frontend), npm
- Docker + Docker Compose (pour la stack conteneurisée ou pour les bases seules), ou MongoDB et PostgreSQL installés localement

### Option A : tout avec Docker

```bash
cp .env.example .env
# Renseigner dans .env : MONGO_ROOT_PASSWORD, POSTGRES_PASSWORD (obligatoires),
# JWT_ACCESS_SECRET et JWT_REFRESH_SECRET (openssl rand -hex 32), et les variables AWS_* / EMAIL_*
# (des valeurs factices suffisent tant que vous n'utilisez pas upload S3 / envoi d'email).
docker compose up -d --build
```

- Application : <http://localhost:8080> (nginx sert le frontend et relaie `/api` et `/socket.io` vers le backend)
- Swagger : <http://localhost:8080/api/docs> (ou <http://localhost:3000/api/docs>)
- Le service `migrate` applique `prisma migrate deploy` avant le démarrage du backend (job ponctuel, voir `backend/Dockerfile`, cible `migrate`). Le backend ne lance jamais de migration implicitement.
- Les ports des bases et du backend sont publiés sur `127.0.0.1` uniquement.
- L'image backend tourne avec `NODE_ENV=production` : le cookie de refresh est donc `Secure`. Chromium et Firefox l'acceptent sur `http://localhost` ; ailleurs (et en vrai déploiement) il faut HTTPS.
- Arrêt : `docker compose down` (ajouter `-v` pour supprimer les volumes de données).

### Option B : développement sans conteneur applicatif

Bases de données : soit installées localement, soit via Docker uniquement pour elles :

```bash
cp .env.example .env     # renseigner au moins MONGO_ROOT_PASSWORD et POSTGRES_PASSWORD
docker compose up -d mongo postgres
```

Backend :

```bash
cd backend
npm ci
cp .env.example .env     # puis renseigner les variables (voir tableau ci-dessous)
# Avec les bases de l'option Docker ci-dessus :
#   MONGODB_URI=mongodb://<user>:<mot_de_passe>@127.0.0.1:27017/profyle?authSource=admin
#   DATABASE_URL=postgresql://<user>:<mot_de_passe>@127.0.0.1:5432/profyle
npx prisma generate
npx prisma migrate deploy
npm run start:dev        # http://localhost:3000/api  (Swagger : /api/docs)
```

Frontend (autre terminal) :

```bash
cd frontend
npm ci
npm run dev              # http://localhost:5173 (origine autorisée par défaut par le CORS du backend)
```

Le frontend lit l'URL de l'API dans `VITE_API_URL` (voir `frontend/.env.example`).

## Variables d'environnement

Aucune valeur réelle n'est versionnée. `.env` et `.env.*` sont ignorés par git (sauf `.env.example`).

### Backend (`backend/.env`, validées par Joi au démarrage)

| Variable | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `NODE_ENV` | non | `development` | `development`, `production` ou `test` |
| `PORT` | non | `3000` | Port HTTP |
| `MONGODB_URI` | oui | - | Connexion MongoDB |
| `DATABASE_URL` | oui | - | Connexion PostgreSQL (runtime du client et CLI Prisma via `prisma.config.ts`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | oui | - | Secrets JWT, 32 caractères minimum |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | non | `15m`, `7d` | Durées de vie des tokens |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME` | oui | - | Stockage S3 (clé IAM à moindre privilège) |
| `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | oui | - | SMTP (`EMAIL_FROM` doit être une adresse email) |
| `EMAIL_PORT` | non | `587` | Port SMTP |
| `CLIENT_URL` | non | `http://localhost:5173` | Origine autorisée par le CORS |

### Docker Compose (`.env` à la racine)

Voir `.env.example` : mots de passe des bases (`MONGO_ROOT_PASSWORD`, `POSTGRES_PASSWORD`, obligatoires), les variables backend ci-dessus (le compose construit `MONGODB_URI` et `DATABASE_URL` à partir des identifiants des bases), `CLIENT_URL`, `VITE_API_URL` (par défaut `/api`) et les ports publiés. Utiliser des mots de passe alphanumériques ou hexadécimaux, ils sont insérés dans des URL de connexion.

## Scripts

Backend (`backend/package.json`) :

| Commande | Rôle |
|---|---|
| `npm run start:dev` | Serveur en mode watch |
| `npm run build` | Compilation (`nest build`) |
| `npm run start:prod` | Lance la version compilée (voir remarque ci-dessous) |
| `npm run lint` | ESLint **avec `--fix`** (modifie les fichiers) |
| `npm run format` | Prettier |
| `npm test` / `npm run test:cov` | Tests unitaires Jest / avec couverture |
| `npm run test:e2e` | Tests e2e (exigent MongoDB et PostgreSQL joignables) |

Prisma (depuis `backend/`) : `npx prisma generate`, `npx prisma migrate deploy` (appliquer les migrations), `npx prisma migrate dev --name <nom>` (créer une migration en développement).

Frontend (`frontend/package.json`) : `npm run dev`, `npm run build`, `npm run preview`, `npm run type-check`, `npm run lint` (`--max-warnings=0`), `npm run lint:fix`, `npm test` (Vitest, mode run), `npm run test:watch`.

Remarque : `nest build` produit actuellement `dist/src/main.js` (le fichier `prisma.config.ts` est compilé avec le reste, ce qui décale la racine de sortie) alors que `start:prod` exécute `node dist/main`. L'image Docker contourne cela (son point d'entrée accepte les deux chemins) ; ce décalage est à corriger dans la configuration TypeScript du backend.

## Tests et CI

Résultats mesurés en local (2026-10-19) :

| Suite | Commande | Résultat |
|---|---|---|
| Backend — unitaires (Jest, mocks) | `cd backend && npm test` | 25 suites, **369 tests** verts |
| Backend — e2e (Jest + Supertest + Socket.io, vraies bases MongoDB/PostgreSQL) | `cd backend && npm run test:e2e` | 6 suites, **98 tests** verts |
| Frontend — unitaires (Vitest + @vue/test-utils) | `cd frontend && npm test` | 13 fichiers, **110 tests** verts |
| Navigateur de bout en bout (Playwright, Chromium) | `cd e2e && npm run stack && npm test` | **2 scénarios** verts : recruteur (société, offre, acceptation) + candidat (recherche, favori, candidature, session restaurée) + chat temps réel |

Bases pour les e2e backend : `MONGODB_URI` et `DATABASE_URL` doivent pointer vers des bases **jetables** (elles sont vidées ; leur nom doit contenir `test`). La suite chat utilise automatiquement les mêmes bases suffixées `_chat` (surchargeables par `CHAT_E2E_MONGODB_URI` / `CHAT_E2E_DATABASE_URL`).
Tests navigateur : voir `e2e/run-stack.sh` (bases `E2E_MONGODB_URI` / `E2E_DATABASE_URL`, faux serveur SMTP local pour récupérer les e-mails de vérification, aucune donnée supprimée). Ils ne tournent pas encore dans la CI.
Pas encore de tests de charge (k6) ni de Testcontainers.

Workflow GitHub Actions `.github/workflows/ci.yml` (sur `push` et `pull_request`, permissions `contents: read`, annulation des runs obsolètes) :

| Job | Contenu |
|---|---|
| `backend` | MongoDB + PostgreSQL en services, `npm ci`, `prisma generate`, `prisma migrate deploy`, ESLint (sans `--fix`), build, tests unitaires avec couverture, tests e2e |
| `frontend` | `npm ci`, type-check, lint, tests, build |
| `docker` | Build des images backend (runtime + migrate) et frontend **sans push**, cache GitHub Actions, puis test de fumée `docker compose up` avec des valeurs factices (API, Swagger, SPA, en-têtes, migrations) |
| `security-secrets` | gitleaks sur tout l'historique git (faux positif connu documenté dans `.gitleaksignore`) |
| `security-audit` | `npm audit --omit=dev --audit-level=high` backend et frontend, **non bloquant** (annotations d'avertissement) |

Il n'y a **pas de job de déploiement** : rien n'est déployé. L'ancien workflow en contenait, mais ils ne faisaient qu'afficher du texte ; ils ont été retirés plutôt que reproduits.

## Structure du dépôt

```
PROFYLE/
├── backend/                  API NestJS
│   ├── src/                  config/, database/prisma/, common/, modules/{auth,users,companies,jobs,applications,saved-jobs,chat}
│   ├── prisma/               schema.prisma + migrations/
│   ├── prisma.config.ts      Configuration CLI Prisma 7 (lit DATABASE_URL)
│   ├── test/                 Tests e2e (auth, users, recrutement, chat Socket.io, limitation de débit)
│   ├── Dockerfile            Multi-étapes : runtime, et cible migrate
│   └── .env.example
├── frontend/                 SPA Vue 3 + Vite
│   ├── Dockerfile
│   └── nginx.conf            SPA + proxy /api et /socket.io + en-têtes de sécurité
├── frontend-react-v1/        Ancien frontend React (archivé, voir plus bas)
├── e2e/                      Tests navigateur Playwright (pile complète)
├── .github/workflows/ci.yml  Intégration continue
├── docker-compose.yml        mongo, postgres, migrate, backend, frontend
├── .env.example              Variables de docker compose
├── .gitleaksignore           Faux positifs gitleaks justifiés
└── README.md
```

## API

- Préfixe global : `/api`. Documentation interactive Swagger/OpenAPI : **`/api/docs`**.
- Authentification : `Authorization: Bearer <accessToken>` (15 min) ; le refresh token (7 jours) est dans un cookie `httpOnly`.
- Rôles : `candidate` et `recruiter`. Erreurs au format NestJS `{ statusCode, message, error }`.

Routes (détail et exemples dans Swagger, contrat complet dans `docs/API-V2-CONTRACT.md`) :

| Domaine | Routes |
|---|---|
| Santé | `GET /health` |
| Auth | `POST /auth/signup`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` |
| Utilisateurs | `GET`/`PATCH /users/me`, `POST`/`DELETE /users/me/avatar`, `POST`/`DELETE /users/me/cv`, `GET /users/me/cv-url` |
| Sociétés | `POST /companies` (recruteur), `GET /companies`, `GET /companies/mine`, `GET /companies/:id`, `PATCH`/`DELETE /companies/:id`, `POST`/`DELETE /companies/:id/logo` |
| Offres | `POST /jobs`, `GET /jobs` (filtres + pagination `{ items, total, page, limit, totalPages }`), `GET /jobs/mine`, `GET /jobs/:id`, `PATCH`/`DELETE /jobs/:id` |
| Candidatures | `POST /jobs/:jobId/applications`, `GET /applications/mine`, `GET /jobs/:jobId/applications`, `PATCH /applications/:id/status`, `PATCH /applications/:id/withdraw`, `GET /applications/:id/cv-url` |
| Favoris | `POST`/`DELETE /jobs/:id/save`, `GET /saved-jobs` |
| Chat | `GET /chat/conversations`, `GET /chat/messages/:otherUserId`, `POST /chat/messages`, `PATCH /chat/messages/:otherUserId/read` + Socket.io namespace `/chat` (`message:send`, `typing`, `message:read` / `message:new`, `typing`, `presence`) |

## Sécurité

En place (vérifiable dans le code) :

- En-têtes HTTP : Helmet côté API ; nginx ajoute CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` côté frontend (HSTS à activer derrière un vrai TLS).
- Validation des entrées : `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) sur des DTO class-validator ; variables d'environnement validées par Joi (le backend refuse de démarrer si une variable obligatoire manque).
- Mots de passe hachés avec bcryptjs (coût 12) ; refresh token stocké haché ; cookie de refresh `httpOnly`, `SameSite=Lax`, `Secure` en production.
- CORS limité à `CLIENT_URL`, avec credentials.
- Contrôle d'accès par rôle (`@Roles` + `RolesGuard`) et vérification de propriété sur les sociétés.
- Fichiers : type MIME vérifié, CV privés servis par URL S3 présignée.
- Conteneurs : utilisateurs non-root, `no-new-privileges`, capabilities Linux retirées pour backend et frontend, bases liées à `127.0.0.1`, aucun secret dans les images ni le dépôt (`.dockerignore`, `.gitignore`, gitleaks en CI).

Ajouté lors de la finalisation v2 :

- Limitation de débit (`@nestjs/throttler`) globale + limites strictes par IP et par e-mail sur l'authentification ; `trust proxy` configurable (`TRUST_PROXY`) ; `/api/health` ; arrêt gracieux.
- Sessions : empreinte SHA-256 du refresh token, rotation atomique, rejeu détecté ⇒ révocation de la session ; toutes les sessions révoquées au changement de mot de passe.
- `PATCH /users/me` validé selon le rôle lu en base (aucun champ sensible modifiable) ; uploads limités en taille avant lecture et contrôlés par signature binaire (magic bytes).
- Swagger désactivé en production ; erreurs de base de données traduites en 400/404/409 sans détail interne.
- `npm audit --omit=dev` : **0 vulnérabilité** backend et frontend au 2026-10-19.

Limites connues :

- Le jeton d'accès (15 min) reste valable jusqu'à son expiration après une déconnexion (JWT sans état) ; un socket déjà ouvert n'est pas coupé à l'expiration du jeton.
- Limitation de débit et présence du chat en mémoire : valables pour une seule instance (adaptateur Redis nécessaire pour plusieurs).
- Pas de scan d'images (Trivy) ni de SAST en CI.

## État d'avancement

| Élément | État |
|---|---|
| Backend : configuration, Joi, Mongo + Prisma, Swagger (désactivé en production) | Fait |
| Backend : auth (vérification e-mail, refresh token rotatif avec détection de rejeu, reset, limitation de débit) | Fait, testé (unitaires + e2e) |
| Backend : users (profil par rôle, avatar, CV S3 avec URL présignées, contrôle du type réel des fichiers) | Fait, testé |
| Backend : companies, jobs (filtres, pagination), applications (transactions, retrait, purge planifiée), favoris | Fait, testé |
| Backend : chat (REST + Socket.io authentifié, présence, non-lus, limitation de débit) | Fait, testé (unitaires + e2e Socket.io réels) |
| Backend : rate limiting, health check (`/api/health`) | Fait |
| Frontend Vue 3 + Pinia + Vue Router + TypeScript | Fait (toutes les pages du contrat), testé (Vitest + navigateur) |
| Sécurité : audit de la v2 corrigé, `npm audit --omit=dev` = 0 vulnérabilité (backend et frontend) | Fait |
| Dockerfiles + docker-compose | Écrits, **pas encore validés par un build réel** (Docker indisponible dans l'environnement de développement) |
| CI GitHub Actions | Écrite, **pas encore validée par un run GitHub** |
| GraphQL | Non fait (prévu dans le plan initial, abandonné pour l'instant) |
| Tests de charge k6, Testcontainers | À faire |
| Déploiement (hébergement, TLS, nom de domaine) | À faire, aucun environnement cible aujourd'hui |
| S3 réel | Code prêt ; non testé contre un vrai bucket dans les tests (S3 simulé) |

Tenir ce tableau à jour à chaque fonctionnalité fusionnée.

## Ancien frontend

`frontend-react-v1/` contient l'ancienne interface React (v1, adossée à l'ancien backend Express). Elle est **archivée** : elle ne fonctionne plus avec l'API v2 (routes, authentification et modèles de données différents) et n'est ni construite ni testée par la CI.

## Licence

À définir. Aucun fichier de licence n'est présent à ce jour : en l'absence de licence, tous droits réservés.
