import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataAnalysisController } from './data-analysis.controller';
import { DataAnalysisService } from './data-analysis.service';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataSession, DataTableSchema, FieldAnnotation]),
  ],
  controllers: [DataAnalysisController],
  providers: [DataAnalysisService],
  exports: [DataAnalysisService],
})
export class DataAnalysisModule {}