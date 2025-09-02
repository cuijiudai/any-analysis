import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataAnalysisController } from './data-analysis.controller';
import { DataAnalysisService } from './data-analysis.service';
import { ChartDataService } from './chart-data.service';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { ChartConfig } from '../../entities/chart-config.entity';
import { DataSessionModule } from '../data-session/data-session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataSession, DataTableSchema, FieldAnnotation, ChartConfig]),
    DataSessionModule,
  ],
  controllers: [DataAnalysisController],
  providers: [DataAnalysisService, ChartDataService],
  exports: [DataAnalysisService, ChartDataService],
})
export class DataAnalysisModule {}