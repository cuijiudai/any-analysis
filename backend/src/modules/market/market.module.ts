import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketSession } from '../../entities/market-session.entity';
import { DataSession } from '../../entities/data-session.entity';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { DataFetchModule } from '../data-fetch/data-fetch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketSession, DataSession, FetchConfig]),
    forwardRef(() => DataFetchModule),
  ],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}