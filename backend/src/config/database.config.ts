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
export class DatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const dbType = process.env.DB_TYPE || 'mysql';
    
    if (dbType === 'postgres') {
      return {
        type: "postgres",
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || "cuijiudai",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_DATABASE || "data_fetch_analysis",
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
        ssl: process.env.DB_HOST?.includes('localhost') || process.env.DB_HOST?.includes('127.0.0.1') 
          ? false 
          : { rejectUnauthorized: false },
        extra: {
          connectionLimit: process.env.NODE_ENV === "production" ? 5 : 10,
          acquireTimeout: 60000,
          timeout: 60000,
        },
      };
    } else {
      // MySQL 配置
      return {
        type: "mysql",
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT) || 3306,
        username: process.env.DB_USERNAME || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_DATABASE || "data_fetch_analysis",
        entities: [
          DataSession,
          FetchConfig,
          DataTableSchema,
          FieldAnnotation,
          ChartConfig,
          User,
          MarketSession,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === "development",
        charset: "utf8mb4",
        timezone: "+08:00",
        extra: {
          connectionLimit: process.env.NODE_ENV === "production" ? 5 : 10,
          acquireTimeout: 60000,
          timeout: 60000,
          ...(process.env.NODE_ENV === "production" && {
            ssl:
              process.env.DB_SSL === "true"
                ? { rejectUnauthorized: false }
                : false,
          }),
        },
      };
    }
  }
}
