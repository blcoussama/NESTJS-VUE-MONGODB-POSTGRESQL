import { randomUUID } from 'crypto';
import { UserRole } from '../src/modules/users/schemas/user.schema';
import { ApplicationsCleanupService } from '../src/modules/applications/applications-cleanup.service';
import {
  client,
  createE2eApp,
  E2eContext,
  PDF_BYTES,
  registerUser,
  TestUser,
} from './utils/e2e-app';

interface Company {
  id: string;
  name: string;
  ownerId: string;
}
interface Job {
  id: string;
  title: string;
  isOpen: boolean;
  recruiterId: string;
  company: { id: string; name: string; logoUrl: string | null };
  applicationsCount?: number;
  isSaved?: boolean;
  hasApplied?: boolean;
  applicationStatus?: string | null;
}
interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
interface Application {
  id: string;
  status: string;
  jobId: string;
  applicantId: string;
  withdrawnAt: string | null;
  expiresAt: string | null;
  applicant?: Record<string, unknown> | null;
  job?: { id: string; title: string; company: { name: string } };
}

const OBJECT_ID = '6710f0c2a1b2c3d4e5f60718';

function jobBody(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: 'Backend Developer NestJS',
    description: 'Build REST APIs with NestJS, PostgreSQL and MongoDB.',
    location: 'Tanger, Maroc',
    jobType: 'full-time',
    experienceLevel: 'junior',
    requirements: ['TypeScript', 'NestJS'],
    salaryType: 'range',
    salary: { min: 8000, max: 12000, currency: 'MAD' },
    companyId,
    ...overrides,
  };
}

describe('Recruitment flow (e2e) — companies, jobs, applications, saved jobs', () => {
  let ctx: E2eContext;
  let recruiter: TestUser;
  let otherRecruiter: TestUser;
  let candidate: TestUser;
  let otherCandidate: TestUser;
  let company: Company;
  let otherCompany: Company;
  let job: Job;
  let application: Application;
  const suffix = randomUUID().slice(0, 6);

  beforeAll(async () => {
    ctx = await createE2eApp();
    [recruiter, otherRecruiter, candidate, otherCandidate] = await Promise.all([
      registerUser(ctx, UserRole.RECRUITER, 'rec'),
      registerUser(ctx, UserRole.RECRUITER, 'rec2'),
      registerUser(ctx, UserRole.CANDIDATE, 'cand'),
      registerUser(ctx, UserRole.CANDIDATE, 'cand2'),
    ]);
  });

  afterAll(async () => {
    await ctx.close();
  });

  // ─── Companies ──────────────────────────────────────────────────────────────

  describe('companies', () => {
    it('GET /companies/mine → 404 before creating one', async () => {
      await recruiter.api
        .get('/api/companies/mine')
        .set('Authorization', recruiter.bearer)
        .expect(404);
    });

    it('a candidate cannot create a company (403), anonymous gets 401', async () => {
      await candidate.api
        .post('/api/companies')
        .set('Authorization', candidate.bearer)
        .send({ name: `Candidate Corp ${suffix}` })
        .expect(403);
      await client(ctx.http)
        .post('/api/companies')
        .send({ name: 'Anonymous Corp' })
        .expect(401);
    });

    it('a recruiter creates ONE company; ownerId cannot be injected', async () => {
      await recruiter.api
        .post('/api/companies')
        .set('Authorization', recruiter.bearer)
        .send({ name: `ALTEN ${suffix}`, ownerId: otherRecruiter.id })
        .expect(400);

      const res = await recruiter.api
        .post('/api/companies')
        .set('Authorization', recruiter.bearer)
        .send({ name: `ALTEN ${suffix}`, location: 'Rabat' })
        .expect(201);
      company = res.body as Company;
      expect(company.ownerId).toBe(recruiter.id);

      await recruiter.api
        .post('/api/companies')
        .set('Authorization', recruiter.bearer)
        .send({ name: `Second ${suffix}` })
        .expect(400);
    });

    it('company names are unique (case-insensitive) → 409', async () => {
      await otherRecruiter.api
        .post('/api/companies')
        .set('Authorization', otherRecruiter.bearer)
        .send({ name: `alten ${suffix}`.toUpperCase() })
        .expect(409);

      const res = await otherRecruiter.api
        .post('/api/companies')
        .set('Authorization', otherRecruiter.bearer)
        .send({ name: `Other Co ${suffix}` })
        .expect(201);
      otherCompany = res.body as Company;
    });

    it('GET /companies/mine returns the own company; 403 for a candidate', async () => {
      const res = await recruiter.api
        .get('/api/companies/mine')
        .set('Authorization', recruiter.bearer)
        .expect(200);
      expect((res.body as Company).id).toBe(company.id);

      await candidate.api
        .get('/api/companies/mine')
        .set('Authorization', candidate.bearer)
        .expect(403);
    });

    it('only the owner can update / delete; a Mongo ObjectId is not a UUID (400)', async () => {
      await otherRecruiter.api
        .patch(`/api/companies/${company.id}`)
        .set('Authorization', otherRecruiter.bearer)
        .send({ location: 'Hacked' })
        .expect(403);
      await otherRecruiter.api
        .delete(`/api/companies/${company.id}`)
        .set('Authorization', otherRecruiter.bearer)
        .expect(403);
      await client(ctx.http).get(`/api/companies/${OBJECT_ID}`).expect(400);
      await client(ctx.http).get(`/api/companies/${randomUUID()}`).expect(404);

      await recruiter.api
        .patch(`/api/companies/${company.id}`)
        .set('Authorization', recruiter.bearer)
        .send({ location: 'Tanger' })
        .expect(200);
    });
  });

  // ─── Jobs ───────────────────────────────────────────────────────────────────

  describe('jobs', () => {
    it('a recruiter publishes a job for HIS company (201, with company summary)', async () => {
      const res = await recruiter.api
        .post('/api/jobs')
        .set('Authorization', recruiter.bearer)
        .send(jobBody(company.id))
        .expect(201);
      job = res.body as Job;

      expect(job.recruiterId).toBe(recruiter.id);
      expect(job.company).toEqual({
        id: company.id,
        name: company.name,
        logoUrl: null,
      });
    });

    it("403 when posting for another recruiter's company; 403 for a candidate", async () => {
      await otherRecruiter.api
        .post('/api/jobs')
        .set('Authorization', otherRecruiter.bearer)
        .send(jobBody(company.id))
        .expect(403);
      await candidate.api
        .post('/api/jobs')
        .set('Authorization', candidate.bearer)
        .send(jobBody(company.id))
        .expect(403);
    });

    it.each([
      ['an unknown jobType', { jobType: 'FULL_TIME' }],
      ['an unknown experienceLevel', { experienceLevel: 'expert' }],
      ['min > max', { salary: { min: 9000, max: 1000 } }],
      ['a range without max', { salary: { min: 9000 } }],
      ['a negotiable job with an amount', { salaryType: 'negotiable' }],
      ['an ObjectId as companyId', { companyId: OBJECT_ID }],
      ['a forbidden recruiterId field', { recruiterId: OBJECT_ID }],
      ['a numeric string salary', { salary: { min: '1', max: '2' } }],
    ])('400 for %s', async (_label, overrides) => {
      await recruiter.api
        .post('/api/jobs')
        .set('Authorization', recruiter.bearer)
        .send(jobBody(company.id, overrides))
        .expect(400);
    });

    it('GET /jobs (public) filters, paginates, sorts and hides closed jobs', async () => {
      const post = (overrides: Record<string, unknown>) =>
        recruiter.api
          .post('/api/jobs')
          .set('Authorization', recruiter.bearer)
          .send(jobBody(company.id, overrides))
          .expect(201);
      await post({
        title: `Stage React ${suffix}`,
        jobType: 'internship',
        salaryType: 'negotiable',
        salary: undefined,
      });
      await post({
        title: `Senior Java ${suffix}`,
        experienceLevel: 'senior',
        location: 'Casablanca',
      });
      const closed = await post({ title: `Closed Role ${suffix}` });
      await recruiter.api
        .patch(`/api/jobs/${(closed.body as Job).id}`)
        .set('Authorization', recruiter.bearer)
        .send({ isOpen: false })
        .expect(200);

      const all = await client(ctx.http)
        .get(`/api/jobs?companyId=${company.id}&limit=2`)
        .expect(200);
      const page = all.body as Page<Job>;
      expect(page.total).toBe(3);
      expect(page.items).toHaveLength(2);
      expect(page.totalPages).toBe(2);
      expect(page.items[0].company.name).toBe(company.name);

      const oldest = await client(ctx.http)
        .get(`/api/jobs?companyId=${company.id}&sort=oldest&limit=1`)
        .expect(200);
      expect((oldest.body as Page<Job>).items[0].id).toBe(job.id);

      const search = await client(ctx.http)
        .get(`/api/jobs?search=stage%20REACT%20${suffix}`)
        .expect(200);
      expect((search.body as Page<Job>).items.map((j) => j.title)).toEqual([
        `Stage React ${suffix}`,
      ]);

      const filtered = await client(ctx.http)
        .get(
          `/api/jobs?companyId=${company.id}&experienceLevel=senior&location=casa`,
        )
        .expect(200);
      expect((filtered.body as Page<Job>).total).toBe(1);

      const closedSearch = await client(ctx.http)
        .get(`/api/jobs?search=Closed%20Role%20${suffix}`)
        .expect(200);
      expect((closedSearch.body as Page<Job>).total).toBe(0);
    });

    it('GET /jobs rejects limit > 50, page 0 and unknown filters', async () => {
      await client(ctx.http).get('/api/jobs?limit=51').expect(400);
      await client(ctx.http).get('/api/jobs?page=0').expect(400);
      await client(ctx.http).get('/api/jobs?jobType=boss').expect(400);
      await client(ctx.http).get('/api/jobs?isOpen=false').expect(400);
    });

    it('PATCH /jobs/:id: owner only, companyId cannot be moved', async () => {
      await otherRecruiter.api
        .patch(`/api/jobs/${job.id}`)
        .set('Authorization', otherRecruiter.bearer)
        .send({ title: 'Hacked title' })
        .expect(403);
      await recruiter.api
        .patch(`/api/jobs/${job.id}`)
        .set('Authorization', recruiter.bearer)
        .send({ companyId: otherCompany.id })
        .expect(400);
      await recruiter.api
        .patch(`/api/jobs/${job.id}`)
        .set('Authorization', recruiter.bearer)
        .send({ isOpen: 'false' })
        .expect(400);
      await client(ctx.http).patch(`/api/jobs/${OBJECT_ID}`).expect(401);
    });
  });

  // ─── Applications ───────────────────────────────────────────────────────────

  describe('applications', () => {
    it('a candidate applies (201); a second time → 409; a recruiter → 403', async () => {
      const res = await candidate.api
        .post(`/api/jobs/${job.id}/applications`)
        .set('Authorization', candidate.bearer)
        .send({ experienceYears: 1, experienceLevel: 'junior' })
        .expect(201);
      application = res.body as Application;
      expect(application).toMatchObject({
        status: 'PENDING',
        applicantId: candidate.id,
        jobId: job.id,
      });

      await candidate.api
        .post(`/api/jobs/${job.id}/applications`)
        .set('Authorization', candidate.bearer)
        .send({ experienceYears: 1, experienceLevel: 'junior' })
        .expect(409);
      await recruiter.api
        .post(`/api/jobs/${job.id}/applications`)
        .set('Authorization', recruiter.bearer)
        .send({ experienceYears: 1, experienceLevel: 'junior' })
        .expect(403);
    });

    it('400 for invalid bodies, 404 for unknown or closed jobs', async () => {
      const apply = (jobId: string, body: object) =>
        otherCandidate.api
          .post(`/api/jobs/${jobId}/applications`)
          .set('Authorization', otherCandidate.bearer)
          .send(body);

      await apply(job.id, {
        experienceYears: -1,
        experienceLevel: 'junior',
      }).expect(400);
      await apply(job.id, {
        experienceYears: '3',
        experienceLevel: 'junior',
      }).expect(400);
      await apply(job.id, {
        experienceYears: 3,
        experienceLevel: 'guru',
      }).expect(400);
      await apply(randomUUID(), {
        experienceYears: 3,
        experienceLevel: 'mid',
      }).expect(404);

      const closed = await client(ctx.http)
        .get(`/api/jobs?companyId=${company.id}`)
        .expect(200);
      const openIds = new Set(
        (closed.body as Page<Job>).items.map((j) => j.id),
      );
      const mine = await recruiter.api
        .get('/api/jobs/mine')
        .set('Authorization', recruiter.bearer)
        .expect(200);
      const closedJob = (mine.body as Job[]).find((j) => !openIds.has(j.id))!;
      await apply(closedJob.id, {
        experienceYears: 3,
        experienceLevel: 'mid',
      }).expect(404);
    });

    it('GET /jobs/:id personalises the detail for a candidate only', async () => {
      const anonymous = await client(ctx.http)
        .get(`/api/jobs/${job.id}`)
        .expect(200);
      expect(anonymous.body).not.toHaveProperty('hasApplied');

      const asCandidate = await candidate.api
        .get(`/api/jobs/${job.id}`)
        .set('Authorization', candidate.bearer)
        .expect(200);
      expect(asCandidate.body).toMatchObject({
        hasApplied: true,
        isSaved: false,
        applicationStatus: 'PENDING',
      });

      // An invalid token on a public route = anonymous, not an error
      const badToken = await client(ctx.http)
        .get(`/api/jobs/${job.id}`)
        .set('Authorization', 'Bearer not-a-token')
        .expect(200);
      expect(badToken.body).not.toHaveProperty('hasApplied');
    });

    it('GET /applications/mine lists the candidate applications with a job summary', async () => {
      const res = await candidate.api
        .get('/api/applications/mine')
        .set('Authorization', candidate.bearer)
        .expect(200);
      const list = res.body as Application[];

      expect(list).toHaveLength(1);
      expect(list[0].job).toMatchObject({
        id: job.id,
        title: job.title,
        company: { name: company.name },
      });

      await recruiter.api
        .get('/api/applications/mine')
        .set('Authorization', recruiter.bearer)
        .expect(403);
    });

    it('GET /jobs/:jobId/applications: owner sees applicants (hasCv, no CV key); others 403', async () => {
      await candidate.api
        .post('/api/users/me/cv')
        .set('Authorization', candidate.bearer)
        .attach('file', PDF_BYTES, {
          filename: 'cv.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const res = await recruiter.api
        .get(`/api/jobs/${job.id}/applications`)
        .set('Authorization', recruiter.bearer)
        .expect(200);
      const list = res.body as Application[];
      expect(list).toHaveLength(1);
      expect(list[0].applicant).toEqual({
        id: candidate.id,
        firstName: 'Test',
        lastName: 'cand',
        email: candidate.email,
        avatarUrl: null,
        hasCv: true,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/cvKey|cvs\//);

      await otherRecruiter.api
        .get(`/api/jobs/${job.id}/applications`)
        .set('Authorization', otherRecruiter.bearer)
        .expect(403);
      await candidate.api
        .get(`/api/jobs/${job.id}/applications`)
        .set('Authorization', candidate.bearer)
        .expect(403);
    });

    it('GET /applications/:id/cv-url: presigned URL for the owner recruiter only', async () => {
      const res = await recruiter.api
        .get(`/api/applications/${application.id}/cv-url`)
        .set('Authorization', recruiter.bearer)
        .expect(200);
      const body = res.body as { url: string; expiresIn: number };
      expect(body.expiresIn).toBe(900);
      expect(body.url).toMatch(/\/cvs\/[0-9a-f-]{36}\.pdf\?/);
      expect(body.url).toContain('X-Amz-Expires=900');

      await otherRecruiter.api
        .get(`/api/applications/${application.id}/cv-url`)
        .set('Authorization', otherRecruiter.bearer)
        .expect(403);
      await candidate.api
        .get(`/api/applications/${application.id}/cv-url`)
        .set('Authorization', candidate.bearer)
        .expect(403);
    });

    it('GET /jobs/mine includes open AND closed jobs with applicationsCount', async () => {
      const res = await recruiter.api
        .get('/api/jobs/mine')
        .set('Authorization', recruiter.bearer)
        .expect(200);
      const jobs = res.body as Job[];

      expect(jobs).toHaveLength(4);
      expect(jobs.some((j) => !j.isOpen)).toBe(true);
      expect(jobs.find((j) => j.id === job.id)?.applicationsCount).toBe(1);
    });

    it('PATCH /applications/:id/status: owner only, PENDING only (409 afterwards)', async () => {
      await otherRecruiter.api
        .patch(`/api/applications/${application.id}/status`)
        .set('Authorization', otherRecruiter.bearer)
        .send({ status: 'ACCEPTED' })
        .expect(403);
      await recruiter.api
        .patch(`/api/applications/${application.id}/status`)
        .set('Authorization', recruiter.bearer)
        .send({ status: 'WITHDRAWN' })
        .expect(400);
      await recruiter.api
        .patch(`/api/applications/${randomUUID()}/status`)
        .set('Authorization', recruiter.bearer)
        .send({ status: 'ACCEPTED' })
        .expect(404);

      const res = await recruiter.api
        .patch(`/api/applications/${application.id}/status`)
        .set('Authorization', recruiter.bearer)
        .send({ status: 'ACCEPTED' })
        .expect(200);
      expect((res.body as Application).status).toBe('ACCEPTED');

      await recruiter.api
        .patch(`/api/applications/${application.id}/status`)
        .set('Authorization', recruiter.bearer)
        .send({ status: 'REJECTED' })
        .expect(409);
      // An accepted application can no longer be withdrawn
      await candidate.api
        .patch(`/api/applications/${application.id}/withdraw`)
        .set('Authorization', candidate.bearer)
        .expect(409);
    });

    it('concurrent decisions: exactly one wins, the other gets 409', async () => {
      const res = await otherCandidate.api
        .post(`/api/jobs/${job.id}/applications`)
        .set('Authorization', otherCandidate.bearer)
        .send({ experienceYears: 4, experienceLevel: 'mid' })
        .expect(201);
      const id = (res.body as Application).id;

      const results = await Promise.all(
        ['ACCEPTED', 'REJECTED'].map((status) =>
          recruiter.api
            .patch(`/api/applications/${id}/status`)
            .set('Authorization', recruiter.bearer)
            .send({ status }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('withdraw → WITHDRAWN + expiresAt (30 days), hidden from the recruiter, purged by the daily job', async () => {
      const other = await recruiter.api
        .post('/api/jobs')
        .set('Authorization', recruiter.bearer)
        .send(jobBody(company.id, { title: `Withdraw Test ${suffix}` }))
        .expect(201);
      const otherJobId = (other.body as Job).id;
      const applied = await candidate.api
        .post(`/api/jobs/${otherJobId}/applications`)
        .set('Authorization', candidate.bearer)
        .send({ experienceYears: 2, experienceLevel: 'junior' })
        .expect(201);
      const id = (applied.body as Application).id;

      await otherCandidate.api
        .patch(`/api/applications/${id}/withdraw`)
        .set('Authorization', otherCandidate.bearer)
        .expect(403);

      const res = await candidate.api
        .patch(`/api/applications/${id}/withdraw`)
        .set('Authorization', candidate.bearer)
        .expect(200);
      const withdrawn = res.body as Application;
      expect(withdrawn.status).toBe('WITHDRAWN');
      const retention =
        new Date(withdrawn.expiresAt!).getTime() -
        new Date(withdrawn.withdrawnAt!).getTime();
      expect(retention).toBe(30 * 24 * 60 * 60 * 1000);

      await candidate.api
        .patch(`/api/applications/${id}/withdraw`)
        .set('Authorization', candidate.bearer)
        .expect(409);

      const forRecruiter = await recruiter.api
        .get(`/api/jobs/${otherJobId}/applications`)
        .set('Authorization', recruiter.bearer)
        .expect(200);
      expect(forRecruiter.body).toEqual([]);
      await recruiter.api
        .get(`/api/applications/${id}/cv-url`)
        .set('Authorization', recruiter.bearer)
        .expect(403);

      // Not expired yet: the daily job keeps it
      const cleanup = ctx.app.get(ApplicationsCleanupService);
      await cleanup.handleCron();
      expect(await ctx.prisma.application.count({ where: { id } })).toBe(1);

      // Expired: purged
      await ctx.prisma.application.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await cleanup.handleCron();
      expect(await ctx.prisma.application.count({ where: { id } })).toBe(0);
    });
  });

  // ─── Saved jobs ─────────────────────────────────────────────────────────────

  describe('saved jobs', () => {
    it('save is idempotent, list has a job summary, delete is idempotent', async () => {
      const save = () =>
        candidate.api
          .post(`/api/jobs/${job.id}/save`)
          .set('Authorization', candidate.bearer)
          .expect(200);
      const first = await save();
      const second = await save();
      expect((second.body as { id: string }).id).toBe(
        (first.body as { id: string }).id,
      );

      const list = await candidate.api
        .get('/api/saved-jobs')
        .set('Authorization', candidate.bearer)
        .expect(200);
      const saved = list.body as { jobId: string; job: Job }[];
      expect(saved).toHaveLength(1);
      expect(saved[0].job).toMatchObject({
        id: job.id,
        company: { name: company.name },
      });

      const detail = await candidate.api
        .get(`/api/jobs/${job.id}`)
        .set('Authorization', candidate.bearer)
        .expect(200);
      expect((detail.body as Job).isSaved).toBe(true);

      for (let i = 0; i < 2; i++) {
        await candidate.api
          .delete(`/api/jobs/${job.id}/save`)
          .set('Authorization', candidate.bearer)
          .expect(200);
      }
      const empty = await candidate.api
        .get('/api/saved-jobs')
        .set('Authorization', candidate.bearer)
        .expect(200);
      expect(empty.body).toEqual([]);
    });

    it('404 for an unknown job, 403 for a recruiter, 400 for a non-UUID id', async () => {
      await candidate.api
        .post(`/api/jobs/${randomUUID()}/save`)
        .set('Authorization', candidate.bearer)
        .expect(404);
      await recruiter.api
        .post(`/api/jobs/${job.id}/save`)
        .set('Authorization', recruiter.bearer)
        .expect(403);
      await candidate.api
        .post(`/api/jobs/${OBJECT_ID}/save`)
        .set('Authorization', candidate.bearer)
        .expect(400);
    });
  });

  // ─── Cascades ───────────────────────────────────────────────────────────────

  describe('deletions cascade', () => {
    it('DELETE /jobs/:id removes its applications and saved entries', async () => {
      await candidate.api
        .post(`/api/jobs/${job.id}/save`)
        .set('Authorization', candidate.bearer)
        .expect(200);

      await otherRecruiter.api
        .delete(`/api/jobs/${job.id}`)
        .set('Authorization', otherRecruiter.bearer)
        .expect(403);
      await recruiter.api
        .delete(`/api/jobs/${job.id}`)
        .set('Authorization', recruiter.bearer)
        .expect(200);

      expect(
        await ctx.prisma.application.count({ where: { jobId: job.id } }),
      ).toBe(0);
      expect(
        await ctx.prisma.savedJob.count({ where: { jobId: job.id } }),
      ).toBe(0);
      await client(ctx.http).get(`/api/jobs/${job.id}`).expect(404);
    });

    it('DELETE /companies/:id removes its jobs', async () => {
      await recruiter.api
        .delete(`/api/companies/${company.id}`)
        .set('Authorization', recruiter.bearer)
        .expect(200);

      expect(
        await ctx.prisma.job.count({ where: { companyId: company.id } }),
      ).toBe(0);
      await recruiter.api
        .get('/api/companies/mine')
        .set('Authorization', recruiter.bearer)
        .expect(404);
    });
  });
});
