-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "applicantId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "ownerId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "recruiterId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "saved_jobs" ALTER COLUMN "userId" SET DATA TYPE TEXT;
