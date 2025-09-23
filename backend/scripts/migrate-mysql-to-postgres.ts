import { DataSource } from 'typeorm';
import {
  DataSession,
  FetchConfig,
  DataTableSchema,
  FieldAnnotation,
  ChartConfig,
  User,
  MarketSession,
} from '../src/entities';

// MySQL 数据源配置
const mysqlDataSource = new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USERNAME || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'data_fetch_analysis',
  entities: [DataSession, FetchConfig, DataTableSchema, FieldAnnotation, ChartConfig, User, MarketSession],
  synchronize: false,
  logging: true,
});

// PostgreSQL 数据源配置
const postgresDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'cuijiudai',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'data_fetch_analysis',
  entities: [DataSession, FetchConfig, DataTableSchema, FieldAnnotation, ChartConfig, User, MarketSession],
  synchronize: false,
  logging: true,
  ssl: false,
});

class DataMigrator {
  private mysqlSource: DataSource;
  private postgresSource: DataSource;

  constructor() {
    this.mysqlSource = mysqlDataSource;
    this.postgresSource = postgresDataSource;
  }

  async initialize() {
    console.log('🔌 连接到 MySQL 数据库...');
    await this.mysqlSource.initialize();
    console.log('✅ MySQL 连接成功');

    console.log('🔌 连接到 PostgreSQL 数据库...');
    await this.postgresSource.initialize();
    console.log('✅ PostgreSQL 连接成功');
  }

  async clearAllTables() {
    console.log('\n🗑️  清空 PostgreSQL 表...');
    
    // 按依赖关系逆序清空表
    const entities = [
      MarketSession,
      ChartConfig,
      FieldAnnotation,
      DataTableSchema,
      FetchConfig,
      DataSession,
      User,
    ];

    for (const entity of entities) {
      try {
        const repo = this.postgresSource.getRepository(entity);
        await repo.clear();
        console.log(`✅ 清空表: ${entity.name}`);
      } catch (error) {
        console.log(`⚠️  清空表 ${entity.name} 失败: ${error.message}`);
      }
    }
  }

  async migrateUsers() {
    console.log('\n👥 迁移用户数据...');
    
    const mysqlUserRepo = this.mysqlSource.getRepository(User);
    const postgresUserRepo = this.postgresSource.getRepository(User);

    const users = await mysqlUserRepo.find();
    console.log(`📊 找到 ${users.length} 个用户`);

    if (users.length === 0) {
      console.log('⚠️  没有用户数据需要迁移');
      return;
    }

    for (const user of users) {
      try {
        await postgresUserRepo.save(user);
        console.log(`✅ 迁移用户: ${user.username}`);
      } catch (error) {
        console.error(`❌ 迁移用户 ${user.username} 失败:`, error.message);
      }
    }
  }

  async migrateDataSessions() {
    console.log('\n📊 迁移数据会话...');
    
    const mysqlSessionRepo = this.mysqlSource.getRepository(DataSession);
    const postgresSessionRepo = this.postgresSource.getRepository(DataSession);

    const sessions = await mysqlSessionRepo.find();
    console.log(`📊 找到 ${sessions.length} 个数据会话`);

    if (sessions.length === 0) {
      console.log('⚠️  没有数据会话需要迁移');
      return;
    }

    // 数据会话表已在 clearAllTables 中清空

    for (const session of sessions) {
      try {
        await postgresSessionRepo.save(session);
        console.log(`✅ 迁移会话: ${session.name}`);
      } catch (error) {
        console.error(`❌ 迁移会话 ${session.name} 失败:`, error.message);
      }
    }
  }

  async migrateFetchConfigs() {
    console.log('\n⚙️  迁移拉取配置...');
    
    const mysqlConfigRepo = this.mysqlSource.getRepository(FetchConfig);
    const postgresConfigRepo = this.postgresSource.getRepository(FetchConfig);

    const configs = await mysqlConfigRepo.find();
    console.log(`📊 找到 ${configs.length} 个拉取配置`);

    if (configs.length === 0) {
      console.log('⚠️  没有拉取配置需要迁移');
      return;
    }

    // 配置表已在 clearAllTables 中清空

    for (const config of configs) {
      try {
        await postgresConfigRepo.save(config);
        console.log(`✅ 迁移配置: ${config.apiUrl}`);
      } catch (error) {
        console.error(`❌ 迁移配置失败:`, error.message);
      }
    }
  }

  async migrateFieldAnnotations() {
    console.log('\n🏷️  迁移字段注释...');
    
    const mysqlAnnotationRepo = this.mysqlSource.getRepository(FieldAnnotation);
    const postgresAnnotationRepo = this.postgresSource.getRepository(FieldAnnotation);

    const annotations = await mysqlAnnotationRepo.find();
    console.log(`📊 找到 ${annotations.length} 个字段注释`);

    if (annotations.length === 0) {
      console.log('⚠️  没有字段注释需要迁移');
      return;
    }

    // 注释表已在 clearAllTables 中清空

    for (const annotation of annotations) {
      try {
        await postgresAnnotationRepo.save(annotation);
        console.log(`✅ 迁移注释: ${annotation.fieldName}`);
      } catch (error) {
        console.error(`❌ 迁移注释 ${annotation.fieldName} 失败:`, error.message);
      }
    }
  }

  async migrateChartConfigs() {
    console.log('\n📈 迁移图表配置...');
    
    const mysqlChartRepo = this.mysqlSource.getRepository(ChartConfig);
    const postgresChartRepo = this.postgresSource.getRepository(ChartConfig);

    const charts = await mysqlChartRepo.find();
    console.log(`📊 找到 ${charts.length} 个图表配置`);

    if (charts.length === 0) {
      console.log('⚠️  没有图表配置需要迁移');
      return;
    }

    // 图表表已在 clearAllTables 中清空

    for (const chart of charts) {
      try {
        await postgresChartRepo.save(chart);
        console.log(`✅ 迁移图表: ${chart.name}`);
      } catch (error) {
        console.error(`❌ 迁移图表 ${chart.name} 失败:`, error.message);
      }
    }
  }

  async migrateDataTableSchemas() {
    console.log('\n🗂️  迁移数据表结构...');
    
    const mysqlSchemaRepo = this.mysqlSource.getRepository(DataTableSchema);
    const postgresSchemaRepo = this.postgresSource.getRepository(DataTableSchema);

    const schemas = await mysqlSchemaRepo.find();
    console.log(`📊 找到 ${schemas.length} 个数据表结构`);

    if (schemas.length === 0) {
      console.log('⚠️  没有数据表结构需要迁移');
      return;
    }

    // 表结构表已在 clearAllTables 中清空

    for (const schema of schemas) {
      try {
        await postgresSchemaRepo.save(schema);
        console.log(`✅ 迁移表结构: ${schema.tableName}`);
      } catch (error) {
        console.error(`❌ 迁移表结构 ${schema.tableName} 失败:`, error.message);
      }
    }
  }

  async migrateMarketSessions() {
    console.log('\n🏪 迁移市场会话...');
    
    const mysqlMarketRepo = this.mysqlSource.getRepository(MarketSession);
    const postgresMarketRepo = this.postgresSource.getRepository(MarketSession);

    const marketSessions = await mysqlMarketRepo.find();
    console.log(`📊 找到 ${marketSessions.length} 个市场会话`);

    if (marketSessions.length === 0) {
      console.log('⚠️  没有市场会话需要迁移');
      return;
    }

    // 市场会话表已在 clearAllTables 中清空

    for (const marketSession of marketSessions) {
      try {
        await postgresMarketRepo.save(marketSession);
        console.log(`✅ 迁移市场会话: ${marketSession.title}`);
      } catch (error) {
        console.error(`❌ 迁移市场会话 ${marketSession.title} 失败:`, error.message);
      }
    }
  }

  async getDataCounts() {
    console.log('\n📊 数据统计:');
    
    // MySQL 统计
    console.log('\n🔸 MySQL 数据库:');
    const mysqlUserCount = await this.mysqlSource.getRepository(User).count();
    const mysqlSessionCount = await this.mysqlSource.getRepository(DataSession).count();
    const mysqlConfigCount = await this.mysqlSource.getRepository(FetchConfig).count();
    const mysqlAnnotationCount = await this.mysqlSource.getRepository(FieldAnnotation).count();
    const mysqlChartCount = await this.mysqlSource.getRepository(ChartConfig).count();
    const mysqlSchemaCount = await this.mysqlSource.getRepository(DataTableSchema).count();
    const mysqlMarketCount = await this.mysqlSource.getRepository(MarketSession).count();

    console.log(`  用户: ${mysqlUserCount}`);
    console.log(`  数据会话: ${mysqlSessionCount}`);
    console.log(`  拉取配置: ${mysqlConfigCount}`);
    console.log(`  字段注释: ${mysqlAnnotationCount}`);
    console.log(`  图表配置: ${mysqlChartCount}`);
    console.log(`  数据表结构: ${mysqlSchemaCount}`);
    console.log(`  市场会话: ${mysqlMarketCount}`);

    // PostgreSQL 统计
    console.log('\n🔹 PostgreSQL 数据库:');
    const pgUserCount = await this.postgresSource.getRepository(User).count();
    const pgSessionCount = await this.postgresSource.getRepository(DataSession).count();
    const pgConfigCount = await this.postgresSource.getRepository(FetchConfig).count();
    const pgAnnotationCount = await this.postgresSource.getRepository(FieldAnnotation).count();
    const pgChartCount = await this.postgresSource.getRepository(ChartConfig).count();
    const pgSchemaCount = await this.postgresSource.getRepository(DataTableSchema).count();
    const pgMarketCount = await this.postgresSource.getRepository(MarketSession).count();

    console.log(`  用户: ${pgUserCount}`);
    console.log(`  数据会话: ${pgSessionCount}`);
    console.log(`  拉取配置: ${pgConfigCount}`);
    console.log(`  字段注释: ${pgAnnotationCount}`);
    console.log(`  图表配置: ${pgChartCount}`);
    console.log(`  数据表结构: ${pgSchemaCount}`);
    console.log(`  市场会话: ${pgMarketCount}`);
  }

  async migrate() {
    try {
      await this.initialize();
      
      console.log('\n🚀 开始数据迁移...');
      
      // 先清空所有表
      await this.clearAllTables();
      
      // 按依赖关系顺序迁移
      await this.migrateUsers();
      await this.migrateDataSessions();
      await this.migrateFetchConfigs();
      await this.migrateFieldAnnotations();
      await this.migrateChartConfigs();
      await this.migrateDataTableSchemas();
      await this.migrateMarketSessions();

      await this.getDataCounts();
      
      console.log('\n🎉 数据迁移完成！');
      
    } catch (error) {
      console.error('❌ 迁移过程中出现错误:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async close() {
    if (this.mysqlSource.isInitialized) {
      await this.mysqlSource.destroy();
      console.log('🔌 MySQL 连接已关闭');
    }
    
    if (this.postgresSource.isInitialized) {
      await this.postgresSource.destroy();
      console.log('🔌 PostgreSQL 连接已关闭');
    }
  }
}

// 命令行执行
async function main() {
  const migrator = new DataMigrator();
  
  try {
    await migrator.migrate();
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}