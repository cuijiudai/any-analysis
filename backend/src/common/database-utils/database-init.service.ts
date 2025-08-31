import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { InitialDataSeed } from '../../seeds/initial-data.seed';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      // 检查数据库连接
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      console.log('数据库连接成功');

      // 运行迁移（如果需要）
      if (process.env.NODE_ENV !== 'production') {
        await this.runMigrations();
      }

      // 运行种子数据
      await this.runSeeds();
    } catch (error) {
      console.error('数据库初始化失败:', error);
    }
  }

  private async runMigrations() {
    try {
      const pendingMigrations = await this.dataSource.showMigrations();
      if (pendingMigrations) {
        console.log('运行数据库迁移...');
        await this.dataSource.runMigrations();
        console.log('数据库迁移完成');
      }
    } catch (error) {
      console.error('运行迁移失败:', error);
    }
  }

  private async runSeeds() {
    try {
      console.log('检查种子数据...');
      await InitialDataSeed.run(this.dataSource);
    } catch (error) {
      console.error('运行种子数据失败:', error);
    }
  }

  /**
   * 获取数据源实例
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * 检查数据库连接状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('数据库连接检查失败:', error);
      return false;
    }
  }
}