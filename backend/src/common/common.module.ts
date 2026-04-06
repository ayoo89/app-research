import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { AppLogger } from './logger.service';

@Global()
@Module({
  providers: [MetricsService, AppLogger],
  controllers: [MetricsController],
  exports: [MetricsService, AppLogger],
})
export class CommonModule {}
