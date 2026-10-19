-- One company per recruiter (enforced by the database, not only by the service)
DROP INDEX "companies_ownerId_idx";
CREATE UNIQUE INDEX "companies_ownerId_key" ON "companies"("ownerId");

-- Public job listing: WHERE "isOpen" = true ORDER BY "createdAt"
DROP INDEX "jobs_isOpen_idx";
CREATE INDEX "jobs_isOpen_createdAt_idx" ON "jobs"("isOpen", "createdAt");

-- Daily purge of withdrawn applications: WHERE "expiresAt" < now()
CREATE INDEX "applications_expiresAt_idx" ON "applications"("expiresAt");

-- Defence in depth: the API validates these values, the database refuses
-- anything else (Prisma does not model CHECK constraints, they live here)
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_jobType_check"
  CHECK ("jobType" IN ('full-time', 'part-time', 'internship', 'contract', 'freelance'));
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_experienceLevel_check"
  CHECK ("experienceLevel" IN ('entry', 'junior', 'mid', 'senior', 'lead'));
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salaryType_check"
  CHECK ("salaryType" IN ('fixed', 'range', 'negotiable'));
ALTER TABLE "applications" ADD CONSTRAINT "applications_experienceLevel_check"
  CHECK ("experienceLevel" IN ('entry', 'junior', 'mid', 'senior', 'lead'));
ALTER TABLE "applications" ADD CONSTRAINT "applications_experienceYears_check"
  CHECK ("experienceYears" >= 0);
