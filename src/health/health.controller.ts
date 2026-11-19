import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

interface Health {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: 'up' | 'down';
}

/**
 * What a process manager, uptime check or load balancer polls.
 *
 * Public, because something that needs a token cannot answer "are you alive?"
 * when auth is what broke. It reports no versions, hostnames or configuration —
 * an unauthenticated endpoint should give an attacker nothing to work with.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check(): Promise<Health> {
    const databaseUp = await this.isDatabaseUp();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      database: databaseUp ? 'up' : 'down',
    };
  }

  /** A real round trip: `isInitialized` stays true after the server goes away. */
  private async isDatabaseUp(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');

      return true;
    } catch {
      return false;
    }
  }
}
