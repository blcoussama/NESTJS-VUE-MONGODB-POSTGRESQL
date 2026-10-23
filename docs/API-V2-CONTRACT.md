# PROFYLE v2 — Contrat d'API (source commune backend / frontend)

> Base : `http://localhost:3000/api` (préfixe global `api`). JSON partout. Auth : `Authorization: Bearer <accessToken>` ; refresh token = cookie httpOnly (déjà en place).
> Rôles : `candidate` | `recruiter` (enum `UserRole`). Erreurs : `{ statusCode, message, error }` (format NestJS).
> Pagination : `?page=1&limit=10` → `{ items, total, page, limit, totalPages }`.
> Les ids d'utilisateur sont des ObjectId Mongo (string 24 hex) ; ceux de Company/Job/Application/SavedJob sont des UUID (PostgreSQL).

## Existant (à conserver, ne pas casser)
`POST /auth/signup {firstName,lastName,email,password,role}` · `POST /auth/verify-email` · `POST /auth/login → {accessToken, user:{id,firstName,lastName,email,role,…}}` · `POST /auth/refresh → {accessToken}` · `POST /auth/logout` · `POST /auth/forgot-password` · `POST /auth/reset-password`
`GET|PATCH /users/me` · `POST|DELETE /users/me/avatar` · `POST|DELETE /users/me/cv` · `GET /users/me/cv-url`
`POST /companies` (recruiter) · `GET /companies` · `GET /companies/:id` · `PATCH|DELETE /companies/:id` (propriétaire) · `POST|DELETE /companies/:id/logo`
À AJOUTER sur companies : `GET /companies/mine` (recruiter : sa société ou 404).

## Jobs (PostgreSQL) — module `jobs`
| Route | Qui | Détail |
|---|---|---|
| `POST /jobs` | recruiter propriétaire de la société | body `{ title, description, location, jobType, experienceLevel, requirements: string[], salaryType, salary?: {min?,max?,currency?}, companyId }` ; `recruiterId` = utilisateur courant ; 403 si la société n'est pas la sienne |
| `GET /jobs` | public | filtres `search` (titre/description), `location`, `jobType`, `experienceLevel`, `companyId`, `page`, `limit` (max 50), `sort=recent|oldest` ; seulement `isOpen=true` ; chaque item inclut `company {id,name,logoUrl}` |
| `GET /jobs/mine` | recruiter | ses offres, ouvertes ET fermées, avec `applicationsCount` |
| `GET /jobs/:id` | public | détail + `company` ; si l'utilisateur est candidat connecté : `isSaved`, `hasApplied` (optionnel) |
| `PATCH /jobs/:id` | recruiter propriétaire | champs partiels dont `isOpen` |
| `DELETE /jobs/:id` | recruiter propriétaire | cascade (applications, saved) |
Valeurs : `jobType` ∈ `full-time|part-time|internship|contract|freelance` ; `experienceLevel` ∈ `entry|junior|mid|senior|lead` ; `salaryType` ∈ `fixed|range|negotiable`.

## Applications — module `applications`
| Route | Qui | Détail |
|---|---|---|
| `POST /jobs/:jobId/applications` | candidate | body `{ experienceYears: int ≥0, experienceLevel }` ; 404 si offre absente ou fermée ; 409 si déjà postulé (contrainte unique) ; 201 |
| `GET /applications/mine` | candidate | ses candidatures + résumé de l'offre (`job {id,title,company{name,logoUrl}}`) |
| `GET /jobs/:jobId/applications` | recruiter propriétaire de l'offre | liste + candidat (`applicant {id,firstName,lastName,email,avatarUrl,hasCv}`) |
| `PATCH /applications/:id/status` | recruiter propriétaire de l'offre | body `{ status: "ACCEPTED"|"REJECTED" }` ; seulement depuis `PENDING` (sinon 409) ; dans une transaction |
| `PATCH /applications/:id/withdraw` | candidate propriétaire | `PENDING` → `WITHDRAWN`, `withdrawnAt=now`, `expiresAt=now+30j` ; tâche planifiée quotidienne qui supprime les candidatures dont `expiresAt` est dépassé |
| `GET /applications/:id/cv-url` | recruiter propriétaire de l'offre | URL présignée (S3) du CV du candidat |

## Offres sauvegardées
`POST /jobs/:id/save` (candidate, idempotent) · `DELETE /jobs/:id/save` · `GET /saved-jobs` (candidate, liste avec résumé d'offre)

## Chat (MongoDB + Socket.io) — module `chat`
Collection Mongo `messages` : `{ _id, from: ObjectId, to: ObjectId, text (≤ 2000), createdAt, readAt|null }`, index `(from,to,createdAt)`.
Message JSON : `{ id, from, to, text, createdAt, readAt }`.
**Règle métier (serveur)** : un échange n'est autorisé qu'entre un RECRUITER et un CANDIDATE reliés par une candidature (le candidat a postulé à une offre de ce recruteur, quel que soit le statut). Sinon 403 / erreur d'ack.
REST :
- `GET /chat/conversations` → `[{ user:{id,firstName,lastName,avatarUrl}, lastMessage:{text,createdAt,from}, unreadCount }]` (tri par dernier message)
- `GET /chat/messages/:otherUserId?cursor=<messageId>&limit=30` → `{ items: Message[] (du plus récent au plus ancien), nextCursor|null }`
- `POST /chat/messages { to, text }` (secours REST) → Message
- `PATCH /chat/messages/:otherUserId/read` → `{ updated: n }`
Socket.io (même serveur, namespace `/chat`) :
- Connexion : `io(BASE, { path:'/socket.io', auth:{ token: <accessToken> } })` sur le namespace `/chat`. Le serveur vérifie le JWT d'accès à la connexion ; invalide/absent → déconnexion immédiate. L'utilisateur rejoint la salle `user:<id>`.
- Client → serveur : `message:send {to,text}` (ack `{ok:true,message}` ou `{ok:false,error}`) · `typing {to,isTyping}` · `message:read {from}`
- Serveur → client : `message:new Message` (au destinataire ET aux autres onglets de l'expéditeur) · `typing {from,isTyping}` · `presence {userId,online}`
- Limites : 20 messages / 10 s par socket (au-delà : ack `{ok:false,error:'rate_limited'}`) ; origine CORS = `CLIENT_URL`.

## Frontend (Vue 3 + Pinia + Vue Router + TypeScript, dossier `frontend/`)
Pages : `/login` `/signup` `/verify-email` `/forgot-password` `/reset-password` · `/jobs` (liste + filtres + pagination) · `/jobs/:id` · `/profile` (candidat/recruteur, avatar, CV) · `/saved` (candidat) · `/applications` (candidat) · `/recruiter/company` · `/recruiter/jobs` · `/recruiter/jobs/new` · `/recruiter/jobs/:id/applications` · `/chat`.
Stores Pinia : `auth` (accessToken **en mémoire**, refresh silencieux via cookie, jamais de token dans localStorage), `jobs`, `applications`, `chat` (socket), `ui`. Garde de routes par rôle. Variable `VITE_API_URL`.

## Tests
Voir la section « Tests et CI » du README racine (bases jetables pour les e2e backend, suite chat sur les mêmes bases suffixées `_chat`, tests navigateur dans `e2e/`).
