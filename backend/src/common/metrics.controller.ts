import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('observability')
@Controller('metrics')
export class MetricsController {
  constructor(private metrics: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'JSON metrics snapshot' })
  json() {
    return this.metrics.snapshot();
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Prometheus text format for scraping' })
  prometheus() {
    return this.metrics.prometheusFormat();
  }
}
