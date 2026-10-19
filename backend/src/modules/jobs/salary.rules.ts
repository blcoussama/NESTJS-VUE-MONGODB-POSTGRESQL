import { BadRequestException } from '@nestjs/common';
import { SalaryType } from './job.enums';
import { SalaryDto } from './dto/salary.dto';

export interface StoredSalary {
  min?: number;
  max?: number;
  currency?: string;
}

/**
 * Cross-field rules between `salaryType` and `salary`:
 * - range      → min and max required, min ≤ max
 * - fixed      → min required (the amount); max, if given, must equal min
 * - negotiable → no amount (stored as NULL)
 * Returns the value to store (null = SQL NULL).
 */
export function normalizeSalary(
  salaryType: SalaryType,
  salary: SalaryDto | StoredSalary | null | undefined,
): StoredSalary | null {
  const min = salary?.min;
  const max = salary?.max;
  const currency = salary?.currency;

  switch (salaryType) {
    case SalaryType.NEGOTIABLE:
      if (min !== undefined || max !== undefined) {
        throw new BadRequestException(
          'salary.min and salary.max must be empty when salaryType is "negotiable"',
        );
      }
      return null;

    case SalaryType.FIXED:
      if (min === undefined) {
        throw new BadRequestException(
          'salary.min (the amount) is required when salaryType is "fixed"',
        );
      }
      if (max !== undefined && max !== min) {
        throw new BadRequestException(
          'salary.max must equal salary.min when salaryType is "fixed"',
        );
      }
      return withCurrency({ min, max: min }, currency);

    case SalaryType.RANGE:
      if (min === undefined || max === undefined) {
        throw new BadRequestException(
          'salary.min and salary.max are required when salaryType is "range"',
        );
      }
      if (min > max) {
        throw new BadRequestException(
          'salary.min must be less than or equal to salary.max',
        );
      }
      return withCurrency({ min, max }, currency);

    default:
      throw new BadRequestException('Invalid salaryType');
  }
}

function withCurrency(
  amounts: { min: number; max: number },
  currency: string | undefined,
): StoredSalary {
  return currency ? { ...amounts, currency } : amounts;
}
