import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { FieldDefinitions } from '../../entities/data-table-schema.entity';

export class DynamicTableUtil {
  /**
   * 根据会话ID生成动态表名
   */
  static generateTableName(sessionId: string): string {
    return `data_${sessionId.replace(/-/g, '_')}`;
  }

  /**
   * 获取安全的字段名（避免与系统字段冲突）
   */
  static getSafeFieldName(fieldName: string): string {
    const systemFields = ['id', 'session_id', 'page_number', 'data_index', 'data_hash', 'created_at'];
    return systemFields.includes(fieldName.toLowerCase()) 
      ? `data_${fieldName}` 
      : fieldName;
  }

  /**
   * 生成数据内容的哈希值，用于去重
   */
  static generateDataHash(data: any): string {
    // 创建一个稳定的数据表示，排除系统字段
    const systemFields = ['id', 'session_id', 'page_number', 'data_index', 'data_hash', 'created_at'];
    const cleanData: any = {};
    
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (!systemFields.includes(key.toLowerCase())) {
          cleanData[key] = data[key];
        }
      });
    } else {
      cleanData.value = data;
    }
    
    // 按键名排序以确保哈希的一致性
    const sortedKeys = Object.keys(cleanData).sort();
    const sortedData: any = {};
    sortedKeys.forEach(key => {
      sortedData[key] = cleanData[key];
    });
    
    const dataString = JSON.stringify(sortedData);
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * 构建字段名映射（原始字段名 -> 安全字段名）
   */
  static buildFieldMapping(originalFields: string[]): { [originalField: string]: string } {
    const mapping: { [originalField: string]: string } = {};
    originalFields.forEach(fieldName => {
      mapping[fieldName] = this.getSafeFieldName(fieldName);
    });
    return mapping;
  }

  /**
   * 验证和清理数据值，确保符合MySQL字段类型要求
   */
  static validateAndCleanValue(value: any, fieldName: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    // 处理对象类型
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (error) {
        console.warn(`字段 ${fieldName} JSON序列化失败:`, error);
        return String(value);
      }
    }

    // 处理数值类型
    if (typeof value === 'number') {
      // 检查是否为有效数值
      if (!Number.isFinite(value)) {
        console.warn(`字段 ${fieldName} 包含非有限数值: ${value}`);
        return null;
      }

      // 检查数值范围
      if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
        console.warn(`字段 ${fieldName} 数值超出安全范围: ${value}，转换为字符串`);
        return String(value);
      }

      return value;
    }

    // 处理字符串类型
    if (typeof value === 'string') {
      // 移除控制字符
      const cleanedValue = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // 限制长度
      if (cleanedValue.length > 65535) {
        console.warn(`字段 ${fieldName} 字符串过长 (${cleanedValue.length} 字符)，截断到65535字符`);
        return cleanedValue.substring(0, 65535);
      }
      
      return cleanedValue;
    }

    // 处理布尔类型
    if (typeof value === 'boolean') {
      return value;
    }

    // 其他类型转换为字符串
    try {
      const stringValue = String(value);
      return stringValue.length > 65535 ? stringValue.substring(0, 65535) : stringValue;
    } catch (error) {
      console.warn(`字段 ${fieldName} 类型转换失败:`, error);
      return null;
    }
  }

  /**
   * 推断JavaScript值的MySQL数据类型
   */
  static inferMySQLType(value: any): string {
    if (value === null || value === undefined) {
      return 'TEXT';
    }

    const type = typeof value;
    
    switch (type) {
      case 'boolean':
        return 'BOOLEAN';
      case 'number':
        // 对于所有数值，统一使用DOUBLE类型，避免范围问题
        return 'DOUBLE';
      case 'string':
        // 对于字符串，使用TEXT类型，避免长度限制
        return 'TEXT';
      case 'object':
        if (value instanceof Date) {
          return 'DATETIME';
        } else if (Array.isArray(value)) {
          return 'JSON';
        } else {
          return 'JSON';
        }
      default:
        return 'TEXT';
    }
  }

  /**
   * 分析数据样本并生成字段定义
   */
  static analyzeDataStructure(dataArray: any[]): FieldDefinitions {
    if (!dataArray || dataArray.length === 0) {
      return {};
    }

    const fieldDefinitions: FieldDefinitions = {};
    const fieldTypes: { [key: string]: Set<string> } = {};

    // 分析所有数据项的字段
    dataArray.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach((fieldName) => {
          if (!fieldTypes[fieldName]) {
            fieldTypes[fieldName] = new Set();
          }
          
          const value = item[fieldName];
          const mysqlType = this.inferMySQLType(value);
          fieldTypes[fieldName].add(mysqlType);
        });
      }
    });

    // 为每个字段选择最合适的类型
    Object.keys(fieldTypes).forEach((fieldName) => {
      const types = Array.from(fieldTypes[fieldName]);
      
      // 选择最宽泛的类型
      let finalType = 'TEXT';
      
      if (types.length === 1) {
        finalType = types[0];
      } else {
        // 简化的类型优先级：JSON > TEXT > DOUBLE > DATETIME > BOOLEAN
        if (types.includes('JSON')) {
          finalType = 'JSON';
        } else if (types.includes('TEXT')) {
          finalType = 'TEXT';
        } else if (types.includes('DOUBLE')) {
          finalType = 'DOUBLE';
        } else if (types.includes('DATETIME')) {
          finalType = 'DATETIME';
        } else if (types.includes('BOOLEAN')) {
          finalType = 'BOOLEAN';
        } else {
          finalType = 'TEXT'; // 默认使用TEXT
        }
      }

      fieldDefinitions[fieldName] = {
        type: finalType,
        nullable: true, // 默认允许NULL
      };
    });

    return fieldDefinitions;
  }

  /**
   * 创建动态数据表
   */
  static async createDynamicTable(
    dataSource: DataSource,
    tableName: string,
    fieldDefinitions: FieldDefinitions,
    sessionId: string,
  ): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 构建CREATE TABLE语句
      const columns = [
        '`id` BIGINT AUTO_INCREMENT PRIMARY KEY',
        '`session_id` VARCHAR(36) NOT NULL',
        '`page_number` INT NOT NULL',
        '`data_index` INT NOT NULL',
        '`data_hash` VARCHAR(64) NOT NULL COMMENT \'数据内容的哈希值，用于去重\'',
      ];

      // 添加动态字段，避免与系统字段冲突
      Object.entries(fieldDefinitions).forEach(([fieldName, definition]) => {
        const nullableStr = definition.nullable ? 'NULL' : 'NOT NULL';
        const defaultStr = definition.default !== undefined ? 
          `DEFAULT ${typeof definition.default === 'string' ? `'${definition.default}'` : definition.default}` : '';
        
        // 使用统一的安全字段名方法
        const safeFieldName = this.getSafeFieldName(fieldName);
        
        columns.push(`\`${safeFieldName}\` ${definition.type} ${nullableStr} ${defaultStr}`.trim());
      });

      columns.push('`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${tableName}\` (
          ${columns.join(',\n          ')},
          UNIQUE KEY \`unique_session_data\` (\`session_id\`, \`data_hash\`),
          INDEX \`idx_session_page\` (\`session_id\`, \`page_number\`),
          INDEX \`idx_created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      await queryRunner.query(createTableSQL);
      await queryRunner.commitTransaction();

      console.log(`动态表 ${tableName} 创建成功`);
      console.log('创建的SQL:', createTableSQL);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`创建动态表 ${tableName} 失败:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 删除动态数据表
   */
  static async dropDynamicTable(
    dataSource: DataSource,
    tableName: string,
  ): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      console.log(`动态表 ${tableName} 删除成功`);
    } catch (error) {
      console.error(`删除动态表 ${tableName} 失败:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 批量插入数据到动态表
   */
  static async insertDataBatch(
    dataSource: DataSource,
    tableName: string,
    data: any[],
    sessionId: string,
    pageNumber: number,
  ): Promise<void> {
    if (!data || data.length === 0) {
      return;
    }

    const queryRunner = dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 系统保留字段
      const systemFields = ['id', 'session_id', 'page_number', 'data_index', 'data_hash', 'created_at'];
      
      // 获取原始数据字段名（排除系统字段）
      const originalDataFields = Object.keys(data[0]).filter(field => !systemFields.includes(field));
      
      // 构建安全的字段名映射（与创建表时的逻辑保持一致）
      const safeFieldMapping = this.buildFieldMapping(originalDataFields);
      const safeFields = originalDataFields.map(field => safeFieldMapping[field]);
      
      // 构建INSERT IGNORE语句，使用安全的字段名，包含data_hash字段
      const allFields = ['session_id', 'page_number', 'data_index', 'data_hash', ...safeFields];
      const placeholders = allFields.map(() => '?').join(', ');
      
      const insertSQL = `
        INSERT IGNORE INTO \`${tableName}\` (\`${allFields.join('`, `')}\`)
        VALUES (${placeholders})
      `;

      // 批量插入数据
      let insertedCount = 0;
      let duplicateCount = 0;
      
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const dataHash = this.generateDataHash(item);
        
        const values = [
          sessionId,
          pageNumber,
          i,
          dataHash,
          ...originalDataFields.map(field => {
            const value = item[field];
            return this.validateAndCleanValue(value, field);
          }),
        ];

        try {
          const result = await queryRunner.query(insertSQL, values);
          // 检查是否实际插入了数据（INSERT IGNORE 在重复时不会插入）
          if (result.affectedRows > 0) {
            insertedCount++;
          } else {
            duplicateCount++;
          }
        } catch (insertError) {
          console.error(`插入第 ${i + 1} 条数据失败:`, {
            error: insertError.message,
            sql: insertSQL,
            values: values,
            item: item
          });
          
          // 如果是数据范围错误，尝试将所有数值转换为字符串重试
          if (insertError.message.includes('Out of range') || insertError.message.includes('Data too long')) {
            console.log(`尝试将数值字段转换为字符串后重试...`);
            
            const safeValues = [
              sessionId,
              pageNumber,
              i,
              dataHash,
              ...originalDataFields.map(field => {
                const value = item[field];
                // 将所有非null值转换为字符串
                if (value === null || value === undefined) {
                  return null;
                }
                return String(value);
              }),
            ];
            
            try {
              const retryResult = await queryRunner.query(insertSQL, safeValues);
              if (retryResult.affectedRows > 0) {
                insertedCount++;
                console.log(`第 ${i + 1} 条数据重试插入成功`);
              } else {
                duplicateCount++;
                console.log(`第 ${i + 1} 条数据为重复数据，已跳过`);
              }
            } catch (retryError) {
              console.error(`第 ${i + 1} 条数据重试插入仍然失败:`, retryError.message);
              throw retryError;
            }
          } else {
            throw insertError;
          }
        }
      }

      await queryRunner.commitTransaction();
      console.log(`数据插入完成 - 表: ${tableName}, 新增: ${insertedCount} 条, 重复跳过: ${duplicateCount} 条, 总处理: ${data.length} 条`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`插入数据到表 ${tableName} 失败:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}