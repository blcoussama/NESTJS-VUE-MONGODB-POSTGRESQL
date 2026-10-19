#!/bin/bash
# Lance la pile PROFYLE complète pour les tests navigateur :
#   faux SMTP local (récupère les e-mails de vérification) -> backend NestJS (dist) -> frontend Vue (vite preview).
# Les bases ne sont JAMAIS vidées : chaque test crée des comptes uniques. Utilisez des bases dédiées aux tests.
#
#   E2E_MONGODB_URI   (défaut mongodb://127.0.0.1:27017/profyle_e2e)
#   E2E_DATABASE_URL  (défaut postgresql://postgres:postgres@127.0.0.1:5432/profyle_e2e — la base doit exister)
#
# Exemple : docker compose up -d mongo postgres  puis  createdb profyle_e2e  puis  npm run stack && npm test
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
TMP="$HERE/.tmp"
mkdir -p "$TMP"

export MONGODB_URI="${E2E_MONGODB_URI:-mongodb://127.0.0.1:27017/profyle_e2e}"
export DATABASE_URL="${E2E_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/profyle_e2e}"
case "$MONGODB_URI$DATABASE_URL" in
  *e2e*|*test*) ;;
  *) echo "Refus : les noms de bases doivent contenir « e2e » ou « test »."; exit 1 ;;
esac

# Arrête une pile e2e précédente (processus enregistrés dans .tmp/pids)
if [ -f "$TMP/pids" ]; then xargs -r kill < "$TMP/pids" 2>/dev/null || true; rm -f "$TMP/pids"; sleep 2; fi

(cd "$ROOT/backend" && npx prisma migrate deploy > "$TMP/migrate.log" 2>&1) || { echo "Migrations KO"; tail -5 "$TMP/migrate.log"; exit 1; }
(cd "$ROOT/backend" && npm run build > "$TMP/backend-build.log" 2>&1) || { echo "Build backend KO"; tail -5 "$TMP/backend-build.log"; exit 1; }

rm -rf "$TMP/mails"
nohup python3 -I "$HERE/smtp_sink.py" "$TMP/mails" > "$TMP/smtp.log" 2>&1 &
echo $! >> "$TMP/pids"

# Variables factices : aucun secret réel, aucun appel AWS ni envoi d'e-mail réel
export NODE_ENV=development PORT=3000 CLIENT_URL=http://localhost:5173 COOKIE_SECURE=false TRUST_PROXY=false
export JWT_ACCESS_SECRET="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
export JWT_REFRESH_SECRET="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
export JWT_ACCESS_EXPIRY=15m JWT_REFRESH_EXPIRY=7d
export AWS_REGION=eu-west-3 AWS_ACCESS_KEY_ID=AKIAFAKEE2ETEST00000 AWS_SECRET_ACCESS_KEY=fake-e2e-secret-key-not-used-anywhere AWS_BUCKET_NAME=profyle-e2e-fake
export EMAIL_HOST=127.0.0.1 EMAIL_PORT=2525 EMAIL_USER=e2e EMAIL_PASS=e2e EMAIL_FROM=no-reply@example.com
(cd "$ROOT/backend" && nohup node dist/main > "$TMP/backend.log" 2>&1 & echo $! >> "$TMP/pids")

(cd "$ROOT/frontend" && VITE_API_URL=http://localhost:3000/api npx vite build --outDir "$TMP/dist-ui" --emptyOutDir > "$TMP/frontend-build.log" 2>&1) \
  || { echo "Build frontend KO"; tail -5 "$TMP/frontend-build.log"; exit 1; }
(cd "$ROOT/frontend" && nohup npx vite preview --outDir "$TMP/dist-ui" --port 5173 --strictPort > "$TMP/preview.log" 2>&1 & echo $! >> "$TMP/pids")

for _ in $(seq 1 60); do
  b=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || true)
  f=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:5173/ || true)
  if [ "$b" = "200" ] && [ "$f" = "200" ]; then echo "Pile prête : backend http://localhost:3000/api, frontend http://localhost:5173"; exit 0; fi
  sleep 2
done
echo "Délai dépassé (backend=$b, frontend=$f)"; tail -15 "$TMP/backend.log"; exit 2
