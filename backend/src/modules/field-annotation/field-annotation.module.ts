import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldAnnotationController } from './field-annotation.controller';
import { FieldAnnotationService } from './field-annotation.service';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { DataSession } from '../../entities/data-session.entity';
import { SchemaAnalysisService } from '../../common/utils/schema-analysis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FieldAnnotation, DataSession]),
  ],
  controllers: [FieldAnnotationController],
  providers: [FieldAnnotationService, SchemaAnalysisService],
  exports: [FieldAnnotationService],
})
export class FieldAnnotationModule {}