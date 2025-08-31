import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { SchemaAnalysisResult, FieldAnalysis } from '../utils/schema-analysis.service';

export interface TableCreationResult {
  tableName: string;
  created: boolean;
  fieldsCreated: number;
  error?: string;
}

export interface TableInfo {
  tableName: string;
  exists: boolean;
  fields: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

@Injectable()
export class DynamicTableService {
  private readonly logger = new Logger(DynamicTableService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * 根据结构分析结果创建动态表
   */
  async createTableFromSchema(schemaResult: SchemaAnalysisResult): Promise<TableCreationResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 检查表是否已存在
      const tableExists = await this.checkTableExists(queryRunner, schemaResult.tableName);
      
      if (tableExists) {
        this.logger.warn(`表 ${schemaResult.tableName} 已存在，将删除重建`);
        await this.dropTable(queryRunner, schemaResult.tableName);
      }

      // 创建表
      const createTableSQL = this.generateCreateTableSQL(schemaResult);
      this.logger.debug(`创建表SQL: ${createTableSQL}`);
      
      await queryRunner.query(createTableSQL);

      // 创建索引
      await this.createIndexes(queryRunner, schemaResult);

      await queryRunner.commitTransaction();

      this.logger.log(`成功创建表 ${schemaResult.tableName}，包含 ${schemaResult.fields.length} 个字段`);

      return {
        tableName: schemaResult.tableName,
        created: true,
        fieldsCreated: schemaResult.fields.length,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`创建表失败: ${error.message}`, error.stack);
      
      return {
        tableName: schemaResult.tableName,
        created: false,
        fieldsCreated: 0,
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 批量插入数据到动态表
   */
  async insertDataToTable(tableName: string, data: any[]): Promise<number> {
    if (!data || data.length === 0) {
      return 0;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 扁平化数据
      const flattenedData = data.map(item => this.flattenObjectForInsert(item));
      
      // 获取表结构
      const tableInfo = await this.getTableInfo(queryRunner, tableName);
      if (!tableInfo.exists) {
        throw new Error(`表 ${tableName} 不存在`);
      }

      // 准备插入数据
      const fieldNames = tableInfo.fields.map(f => f.name);
      const insertData = flattenedData.map(item => {
        const row: any = {};
        fieldNames.forEach(fieldName => {
          row[fieldName] = item[fieldName] || null;
        });
        return row;
      });

      // 批量插入
      const batchSize = 1000;
      let totalInserted = 0;

      for (let i = 0; i < insertData.length; i += batchSize) {
        const batch = insertData.slice(i, i + batchSize);
        const insertSQL = this.generateInsertSQL(tableName, fieldNames, batch);
        
        await queryRunner.query(insertSQL.sql, insertSQL.parameters);
        totalInserted += batch.length;
        
        this.logger.debug(`已插入 ${totalInserted}/${insertData.length} 条记录到表 ${tableName}`);
      }

      await queryRunner.commitTransaction();
      
      this.logger.log(`成功插入 ${totalInserted} 条记录到表 ${tableName}`);
      return totalInserted;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`插入数据失败: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取表信息
   */
  async getTableInfo(queryRunner: QueryRunner, tableName: string): Promise<TableInfo> {
    try {
      const exists = await this.checkTableExists(queryRunner, tableName);
      
      if (!exists) {
        return {
          tableName,
          exists: false,
          fields: [],
        };
      }

      // 获取字段信息
      const columns = await queryRunner.query(`
        SELECT 
          COLUMN_NAME as name,
          DATA_TYPE as type,
          IS_NULLABLE as nullable
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);

      const fields = columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
      }));

      return {
        tableName,
        exists: true,
        fields,
      };

    } catch (error) {
      this.logger.error(`获取表信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除动态表
   */
  async dropTable(queryRunner: QueryRunner, tableName: string): Promise<void> {
    try {
      const exists = await this.checkTableExists(queryRunner, tableName);
      
      if (exists) {
        await queryRunner.query(`DROP TABLE \`${tableName}\``);
        this.logger.log(`已删除表 ${tableName}`);
      }
    } catch (error) {
      this.logger.error(`删除表失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查表是否存在
   */
  private async checkTableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const result = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
    `, [tableName]);

    return result[0].count > 0;
  }

  /**
   * 生成创建表的SQL
   */
  private generateCreateTableSQL(schemaResult: SchemaAnalysisResult): string {
    const { tableName, fields } = schemaResult;
    
    const columnDefinitions = fields.map(field => {
      const nullable = field.nullable ? 'NULL' : 'NOT NULL';
      return `\`${field.name}\` ${field.mysqlType} ${nullable}`;
    });

    // 添加主键ID和时间戳字段
    const allColumns = [
      '`id` BIGINT AUTO_INCREMENT PRIMARY KEY',
      '`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      '`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ...columnDefinitions,
    ];

    return `
      CREATE TABLE \`${tableName}\` (
        ${allColumns.join(',\n        ')}
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
  }

  /**
   * 创建索引
   */
  private async createIndexes(queryRunner: QueryRunner, schemaResult: SchemaAnalysisResult): Promise<void> {
    const { tableName, fields } = schemaResult;

    // 为常见的查询字段创建索引
    const indexableFields = fields.filter(field => 
      ['integer', 'date', 'email'].includes(field.type) && 
      !field.nullable
    );

    for (const field of indexableFields.slice(0, 5)) { // 最多创建5个索引
      try {
        const indexName = `idx_${tableName}_${field.name}`;
        await queryRunner.query(`
          CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`${field.name}\`)
        `);
        this.logger.debug(`创建索引 ${indexName}`);
      } catch (error) {
        this.logger.warn(`创建索引失败: ${error.message}`);
      }
    }

    // 为时间戳字段创建索引
    try {
      await queryRunner.query(`
        CREATE INDEX \`idx_${tableName}_created_at\` ON \`${tableName}\` (\`created_at\`)
      `);
    } catch (error) {
      this.logger.warn(`创建时间戳索引失败: ${error.message}`);
    }
  }

  /**
   * 扁平化对象用于插入
   */
  private flattenObjectForInsert(obj: any, prefix: string = ''): any {
    const result: any = {};
    
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      const value = obj[key];

      if (value === null || value === undefined) {
        result[fullKey] = null;
      } else if (Array.isArray(value)) {
        result[fullKey] = JSON.stringify(value);
      } else if (typeof value === 'object') {
        Object.assign(result, this.flattenObjectForInsert(value, fullKey));
      } else {
        result[fullKey] = value;
      }
    });

    return result;
  }

  /**
   * 生成插入SQL
   */
  private generateInsertSQL(tableName: string, fieldNames: string[], data: any[]): {
    sql: string;
    parameters: any[];
  } {
    const columns = fieldNames.map(name => `\`${name}\``).join(', ');
    const placeholders = fieldNames.map(() => '?').join(', ');
    const valueRows = data.map(() => `(${placeholders})`).join(', ');
    
    const sql = `INSERT INTO \`${tableName}\` (${columns}) VALUES ${valueRows}`;
    
    const parameters: any[] = [];
    data.forEach(row => {
      fieldNames.forEach(fieldName => {
        parameters.push(row[fieldName]);
      });
    });

    return { sql, parameters };
  }

  /**
   * 清理会话相关的表
   */
  async cleanupSessionTables(sessionId: string): Promise<void> {
    const tableName = `data_${sessionId.replace(/-/g, '_')}`;
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await this.dropTable(queryRunner, tableName);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取表的数据统计
   */
  async getTableStats(tableName: string): Promise<{
    totalRows: number;
    tableSize: string;
    created: Date | null;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      
      // 获取行数
      const countResult = await queryRunner.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      const totalRows = countResult[0].count;

      // 获取表大小和创建时间
      const statsResult = await queryRunner.query(`
        SELECT 
          ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS size_mb,
          CREATE_TIME as created
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
      `, [tableName]);

      const stats = statsResult[0] || {};

      return {
        totalRows,
        tableSize: stats.size_mb ? `${stats.size_mb} MB` : '0 MB',
        created: stats.created || null,
      };

    } finally {
      await queryRunner.release();
    }
  }
}