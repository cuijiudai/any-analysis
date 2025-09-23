import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  DataSession,
  FetchConfig,
  DataTableSchema,
  FieldAnnotation,
  ChartConfig,
  User,
  MarketSession,
} from '../entities';

@Injectable()
export class PostgresLocalDatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'cuijiudai', // 使用你的用户名
      password: process.env.DB_PASSWORD || '', // 通常本地PostgreSQL不需要密码
      database: process.env.DB_DATABASE || 'data_fetch_analysis',
      entities: [
        DataSession,
        FetchConfig,
        DataTableSchema,
        FieldAnnotation,
        ChartConfig,
        User,
        MarketSession,
      ],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      ssl: false, // 本地开发不需要SSL
    };
  }
}
