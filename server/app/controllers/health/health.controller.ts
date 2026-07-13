import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
    status: 'ok';
    uptime: number;
}

@Controller('health')
export class HealthController {
    @Get()
    getHealth(): HealthStatus {
        return { status: 'ok', uptime: process.uptime() };
    }
}
