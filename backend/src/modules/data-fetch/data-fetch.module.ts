import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DataFetchController } from './data-fetch.controller';
import { DataFetchService } from './data-fetch.service';
import { DataFetchExecutorService } from './data-fetch-executor.service';
import { ProgressMonitorService } from './progress-monitor.service';
import { ProgressGateway } from './progress.gateway';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { HttpClientModule } from '../../common/http-client';
import { CurlParserService, SchemaAnalysisService } from '../../common/utils';
import { DynamicTableService } from '../../common/database-utils';
import { DataSessionModule } from '../data-session/data-session.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FetchConfig, DataSession, DataTableSchema]),
    HttpClientModule,
    DataSessionModule,
    AuthModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [DataFetchController],
  providers: [
    DataFetchService, 
    DataFetchExecutorService,
    ProgressMonitorService,
    ProgressGateway,
    CurlParserService,
    SchemaAnalysisService,
    DynamicTableService,
  ],
  exports: [DataFetchService, DataFetchExecutorService, ProgressMonitorService],
})
export class DataFetchModule {}