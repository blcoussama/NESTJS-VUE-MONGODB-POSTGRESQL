import { applyDecorators } from '@nestjs/common';
import { IsUrl, MaxLength } from 'class-validator';

/**
 * Absolute http(s) URL only — rejects `javascript:`, `data:`, relative URLs…
 * which would become stored XSS once rendered as a link by the frontend.
 */
export function IsHttpUrl(maxLength = 2048) {
  return applyDecorators(
    IsUrl({ protocols: ['http', 'https'], require_protocol: true }),
    MaxLength(maxLength),
  );
}
