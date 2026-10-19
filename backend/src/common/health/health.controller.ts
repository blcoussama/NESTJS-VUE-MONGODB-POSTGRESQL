import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness probe for Docker HEALTHCHECK / load balancers.
 * Public, never rate limited, and returns no configuration or secrets.
 */
@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        uptime: 12.34,
        timestamp: '2026-10-19T12:00:00.000Z',
      },
    },
  })
  check() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }
}
