import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseConfig } from "./config/database.config";
import { DatabaseInitService } from "./common/database-utils";
import { DataSessionModule } from "./modules/data-session/data-session.module";
import { DataFetchModule } from "./modules/data-fetch/data-fetch.module";
import { FieldAnnotationModule } from "./modules/field-annotation/field-annotation.module";
import { DataAnalysisModule } from "./modules/data-analysis/data-analysis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { MarketModule } from "./modules/market/market.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    DataSessionModule,
    DataFetchModule,
    FieldAnnotationModule,
    DataAnalysisModule,
    AuthModule,
    MarketModule,
  ],
  controllers: [HealthController],
  providers: [DatabaseInitService],
})
export class AppModule {}
