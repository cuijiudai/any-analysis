import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  DataSession,
  FetchConfig,
  DataTableSchema,
  FieldAnnotation,
  ChartConfig,
} from '../entities';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'data_fetch_analysis',
      entities: [
        DataSession,
        FetchConfig,
        DataTableSchema,
        FieldAnnotation,
        ChartConfig,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
      timezone: '+08:00',
      // 支持大数据包
      extra: {
        connectionLimit: 10,
      },
    };
  }
}