// Values are part of the public API contract (and of DB CHECK constraints)

export enum JobType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  INTERNSHIP = 'internship',
  CONTRACT = 'contract',
  FREELANCE = 'freelance',
}

export enum ExperienceLevel {
  ENTRY = 'entry',
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
}

export enum SalaryType {
  FIXED = 'fixed',
  RANGE = 'range',
  NEGOTIABLE = 'negotiable',
}

export enum JobSort {
  RECENT = 'recent',
  OLDEST = 'oldest',
}
