import { DataSource } from 'typeorm';
import { DatabaseConfig } from '../src/config/database.config';
import { InitialDataSeed } from '../src/seeds/initial-data.seed';
import {
  DataSession,
  FetchConfig,
  DataTableSchema,
  FieldAnnotation,
  ChartConfig,
  User,
  MarketSession,
} from '../src/entities';

class DatabaseManager {
  private dataSource: DataSource;

  constructor() {
    const config = new DatabaseConfig();
    const options = config.createTypeOrmOptions();
    
    this.dataSource = new DataSource({
      ...options,
      entities: [DataSession, FetchConfig, DataTableSchema, FieldAnnotation, ChartConfig, User, MarketSession],
      migrations: ['src/migrations/*.ts'],
      migrationsRun: false,
    } as any);
  }

  async initialize() {
    try {
      await this.dataSource.initialize();
      console.log('数据库连接成功');
    } catch (error) {
      console.error('数据库连接失败:', error);
      throw error;
    }
  }

  async createDatabase() {
    try {
      const dbType = process.env.DB_TYPE || 'postgres';
      
      if (dbType === 'postgres') {
        // PostgreSQL 数据库通常由云服务提供商管理，不需要手动创建
        console.log('PostgreSQL 数据库由云服务提供商管理，跳过数据库创建');
        return;
      }
      
      // MySQL 创建数据库逻辑（保留以备后用）
      const tempDataSource = new DataSource({
        type: 'mysql',
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3306,
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        // 不指定数据库名
      });

      await tempDataSource.initialize();
      
      // 创建数据库（如果不存在）
      await tempDataSource.query(`
        CREATE DATABASE IF NOT EXISTS ${process.env.DB_DATABASE || 'data_fetch_analysis'} 
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      
      await tempDataSource.destroy();
      console.log('数据库创建成功');
    } catch (error) {
      console.error('数据库创建失败:', error);
    }
  }

  async runMigrations() {
    try {
      await this.dataSource.runMigrations();
      console.log('迁移执行成功');
    } catch (error) {
      console.error('迁移执行失败:', error);
    }
  }

  async revertMigrations() {
    try {
      await this.dataSource.undoLastMigration();
      console.log('迁移回滚成功');
    } catch (error) {
      console.error('迁移回滚失败:', error);
    }
  }

  async seedData() {
    try {
      await InitialDataSeed.run(this.dataSource);
      console.log('种子数据创建成功');
    } catch (error) {
      console.error('种子数据创建失败:', error);
    }
  }

  async dropDatabase() {
    try {
      await this.dataSource.query(`DROP DATABASE IF EXISTS ${process.env.DB_DATABASE || 'data_fetch_analysis'}`);
      console.log('数据库删除成功');
    } catch (error) {
      console.error('数据库删除失败:', error);
    }
  }

  async close() {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      console.log('数据库连接已关闭');
    }
  }
}

// 命令行工具
async function main() {
  const manager = new DatabaseManager();
  const command = process.argv[2];

  try {
    // 对于创建数据库命令，不需要先初始化
    if (command !== 'create') {
      await manager.initialize();
    }

    switch (command) {
      case 'create':
        await manager.close(); // 先关闭当前连接
        await manager.createDatabase();
        break;
      case 'migrate':
        await manager.runMigrations();
        break;
      case 'revert':
        await manager.revertMigrations();
        break;
      case 'seed':
        await manager.seedData();
        break;
      case 'reset':
        await manager.close();
        await manager.dropDatabase();
        await manager.createDatabase();
        await manager.initialize();
        await manager.runMigrations();
        await manager.seedData();
        break;
      case 'drop':
        await manager.dropDatabase();
        break;
      default:
        console.log('可用命令:');
        console.log('  create  - 创建数据库');
        console.log('  migrate - 运行迁移');
        console.log('  revert  - 回滚迁移');
        console.log('  seed    - 创建种子数据');
        console.log('  reset   - 重置数据库（删除并重新创建）');
        console.log('  drop    - 删除数据库');
    }
  } catch (error) {
    console.error('操作失败:', error);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

if (require.main === module) {
  main();
}