// Test de bout en bout PROFYLE v2 : vrai navigateur (Chromium) -> frontend Vue (vite preview) -> backend NestJS -> MongoDB + PostgreSQL.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.E2E_FRONTEND_URL || 'http://localhost:5173';
const MAILS = path.join(__dirname, '.tmp', 'mails');
const ts = Date.now();
const recruiter = { first: 'Rania', last: 'Recruteuse', email: `rec${ts}@example.com`, role: 'Recruteur' };
const candidate = { first: 'Karim', last: 'Candidat', email: `cand${ts}@example.com`, role: 'Candidat' };
const PASSWORD = 'Str0ng!Passw0rd';
const JOB_TITLE = `Ingénieur DevOps ${ts}`;

function decodeQP(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
async function verificationToken(email) {
  for (let i = 0; i < 40; i++) {
    const files = fs.existsSync(MAILS) ? fs.readdirSync(MAILS).sort() : [];
    for (const f of files.reverse()) {
      const raw = decodeQP(fs.readFileSync(path.join(MAILS, f), 'utf8'));
      if (raw.toLowerCase().includes(email.toLowerCase())) {
        const m = raw.match(/verify-email\?token=([0-9a-f]{64})/i);
        if (m) return m[1];
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Pas d'e-mail de vérification reçu pour ${email}`);
}

async function signupVerifyLogin(page, u) {
  await page.goto(`${BASE}/signup`);
  await page.getByText(u.role, { exact: true }).click();
  await page.getByLabel(/^Prénom/).fill(u.first);
  await page.getByLabel(/^Nom\s*\*?$/).fill(u.last);
  await page.getByLabel(/^Adresse e-mail/).fill(u.email);
  await page.getByLabel(/^Mot de passe/).fill(PASSWORD);
  await page.getByLabel(/^Confirmer le mot de passe/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  const token = await verificationToken(u.email);
  await page.goto(`${BASE}/verify-email?token=${token}`);
  await expect(page.getByText(/vérifiée|vérifié|verified/i).first()).toBeVisible({ timeout: 15000 });
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/^Adresse e-mail/).fill(u.email);
  await page.getByLabel(/^Mot de passe/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

async function noTokenInWebStorage(page) {
  const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(dump, 'aucun jeton JWT ne doit être stocké dans localStorage/sessionStorage').not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
}

test('parcours complet recruteur + candidat + chat temps réel', async ({ browser }) => {
  test.setTimeout(240000);
  const recCtx = await browser.newContext();
  const candCtx = await browser.newContext();
  const rec = await recCtx.newPage();
  const cand = await candCtx.newPage();

  // --- Recruteur : compte, société, offre
  await signupVerifyLogin(rec, recruiter);
  await rec.goto(`${BASE}/recruiter/company`);
  await rec.getByLabel(/^Nom de la société/).fill(`Société Test ${ts}`);
  await rec.getByLabel(/^Description/).fill('Société de test pour le parcours de bout en bout.');
  await rec.getByLabel(/^Localisation/).fill('Rabat');
  await rec.getByRole('button', { name: 'Créer la société' }).click();
  await expect(rec.getByRole('heading', { name: 'Ma société' })).toBeVisible({ timeout: 15000 });

  await rec.goto(`${BASE}/recruiter/jobs/new`);
  await rec.getByLabel(/^Intitulé du poste/).fill(JOB_TITLE);
  await rec.getByLabel(/^Description/).fill('Administration de clusters, pipelines CI/CD et supervision des infrastructures.');
  await rec.getByLabel(/^Lieu/).fill('Rabat');
  await rec.getByRole('button', { name: /Ajouter une exigence/ }).click();
  await rec.getByPlaceholder(/Ex\. : 2 ans/).first().fill('Docker et CI/CD');
  await rec.getByRole('button', { name: /Publier l.offre/ }).click();
  await expect(rec).not.toHaveURL(/\/recruiter\/jobs\/new/, { timeout: 15000 });
  await noTokenInWebStorage(rec);

  // --- Candidat : compte, offre visible, favori, candidature
  await signupVerifyLogin(cand, candidate);
  await cand.goto(`${BASE}/jobs`);
  await cand.getByText(JOB_TITLE).first().click();
  await expect(cand.getByRole('heading', { name: JOB_TITLE })).toBeVisible({ timeout: 15000 });
  await cand.getByRole('button', { name: /Enregistrer en favori/ }).click();
  await expect(cand.getByRole('button', { name: /Enregistrée dans vos favoris/ })).toBeVisible();
  await cand.getByLabel(/Années d.expérience/).fill('2');
  await cand.getByRole('button', { name: 'Envoyer ma candidature' }).click();
  await expect(cand.getByText('Vous avez déjà postulé à cette offre.')).toBeVisible({ timeout: 15000 });
  const jobUrl = cand.url();

  await cand.goto(`${BASE}/saved`);
  await expect(cand.getByText(JOB_TITLE).first()).toBeVisible();
  await cand.goto(`${BASE}/applications`);
  await expect(cand.getByText('En attente').first()).toBeVisible();
  await noTokenInWebStorage(cand);

  // Rechargement de page : la session est restaurée par le cookie httpOnly (refresh silencieux)
  await cand.reload();
  await expect(cand).toHaveURL(/\/applications/);
  await expect(cand.getByText(JOB_TITLE).first()).toBeVisible({ timeout: 15000 });

  // --- Recruteur : accepte la candidature
  const jobId = jobUrl.split('/jobs/')[1].split(/[?#]/)[0];
  await rec.goto(`${BASE}/recruiter/jobs/${jobId}/applications`);
  await expect(rec.getByText(`${candidate.first} ${candidate.last}`).first()).toBeVisible({ timeout: 15000 });
  await rec.getByRole('button', { name: 'Accepter' }).click();
  await expect(rec.getByText('Acceptée').first()).toBeVisible({ timeout: 15000 });
  await cand.goto(`${BASE}/applications`);
  await expect(cand.getByText('Acceptée').first()).toBeVisible({ timeout: 15000 });

  // --- Chat temps réel : le candidat contacte le recruteur, le recruteur répond
  await cand.goto(jobUrl);
  await cand.getByRole('link', { name: 'Contacter le recruteur' }).click();
  await expect(cand).toHaveURL(/\/chat/);
  const candBox = cand.getByPlaceholder('Écrire un message…');
  await candBox.fill('Bonjour, merci pour votre retour !');
  await cand.getByRole('button', { name: 'Envoyer' }).click();
  await expect(cand.getByRole('log').getByText('Bonjour, merci pour votre retour !')).toBeVisible({ timeout: 15000 });

  await rec.goto(`${BASE}/chat`);
  await rec.getByRole('list', { name: 'Conversations' }).getByText(new RegExp(candidate.first)).first().click();
  await expect(rec.getByRole('log').getByText('Bonjour, merci pour votre retour !')).toBeVisible({ timeout: 15000 });
  await rec.getByPlaceholder('Écrire un message…').fill('Avec plaisir, à bientôt pour l’entretien.');
  await rec.getByRole('button', { name: 'Envoyer' }).click();
  // Reçu côté candidat SANS rechargement (Socket.io)
  await expect(cand.getByRole('log').getByText('Avec plaisir, à bientôt pour l’entretien.')).toBeVisible({ timeout: 15000 });

  await recCtx.close();
  await candCtx.close();
});

test('une route recruteur est refusée à un visiteur non connecté', async ({ page }) => {
  await page.goto(`${BASE}/recruiter/jobs/new`);
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
});
