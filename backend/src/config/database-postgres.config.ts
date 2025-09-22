import { Injectable } from "@nestjs/common";
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from "@nestjs/typeorm";
import {
  DataSession,
  FetchConfig,
  DataTableSchema,
  FieldAnnotation,
  ChartConfig,
  User,
  MarketSession,
} from "../entities";

@Injectable()
export class PostgresDatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: [
        DataSession,
        FetchConfig,
        DataTableSchema,
        FieldAnnotation,
        ChartConfig,
        User,
        MarketSession,
      ],
      synchronize: process.env.NODE_ENV === "development",
      logging: process.env.NODE_ENV === "development",
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      // Vercel 无服务器环境优化
      extra: {
        connectionLimit: process.env.NODE_ENV === "production" ? 5 : 10,
        acquireTimeout: 60000,
        timeout: 60000,
        // 连接池优化
        idleTimeoutMillis: 30000,
        max: 5,
        statement_timeout: 30000,
        query_timeout: 30000,
      },
    };
  }
}
