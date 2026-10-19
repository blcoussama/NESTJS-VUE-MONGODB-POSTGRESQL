import { BadRequestException } from '@nestjs/common';
import { normalizeSalary } from './salary.rules';
import { SalaryType } from './job.enums';

describe('normalizeSalary', () => {
  it('range: requires min and max', () => {
    expect(() => normalizeSalary(SalaryType.RANGE, { min: 1000 })).toThrow(
      BadRequestException,
    );
    expect(() => normalizeSalary(SalaryType.RANGE, undefined)).toThrow(
      BadRequestException,
    );
  });

  it('range: requires min ≤ max', () => {
    expect(() =>
      normalizeSalary(SalaryType.RANGE, { min: 3000, max: 2000 }),
    ).toThrow('salary.min must be less than or equal to salary.max');
  });

  it('range: keeps min, max and currency', () => {
    expect(
      normalizeSalary(SalaryType.RANGE, { min: 1, max: 2, currency: 'MAD' }),
    ).toEqual({ min: 1, max: 2, currency: 'MAD' });
  });

  it('fixed: requires the amount (min) and stores min = max', () => {
    expect(() => normalizeSalary(SalaryType.FIXED, {})).toThrow(
      BadRequestException,
    );
    expect(normalizeSalary(SalaryType.FIXED, { min: 9000 })).toEqual({
      min: 9000,
      max: 9000,
    });
  });

  it('fixed: rejects a different max', () => {
    expect(() =>
      normalizeSalary(SalaryType.FIXED, { min: 9000, max: 10000 }),
    ).toThrow(BadRequestException);
  });

  it('negotiable: no amount allowed, stored as null', () => {
    expect(normalizeSalary(SalaryType.NEGOTIABLE, undefined)).toBeNull();
    expect(
      normalizeSalary(SalaryType.NEGOTIABLE, { currency: 'MAD' }),
    ).toBeNull();
    expect(() => normalizeSalary(SalaryType.NEGOTIABLE, { min: 1 })).toThrow(
      BadRequestException,
    );
  });
});
