import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSessionController } from './data-session.controller';
import { DataSessionService } from './data-session.service';
import {
  DataSession,
  FetchConfig,
  FieldAnnotation,
  ChartConfig,
  DataTableSchema,
} from '../../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataSession,
      FetchConfig,
      FieldAnnotation,
      ChartConfig,
      DataTableSchema,
    ]),
  ],
  controllers: [DataSessionController],
  providers: [DataSessionService],
  exports: [DataSessionService],
})
export class DataSessionModule {}