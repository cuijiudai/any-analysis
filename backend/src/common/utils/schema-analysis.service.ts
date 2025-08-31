import { Injectable } from '@nestjs/common';

export interface FieldAnalysis {
  name: string;
  type: string;
  mysqlType: string;
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  sampleValues: any[];
}

export interface SchemaAnalysisResult {
  fields: FieldAnalysis[];
  totalFields: number;
  tableName: string;
}

@Injectable()
export class SchemaAnalysisService {
  /**
   * 分析数据数组的结构，推断字段类型
   */
  analyzeDataStructure(data: any[], sessionId: string): SchemaAnalysisResult {
    if (!data || data.length === 0) {
      throw new Error('数据为空，无法分析结构');
    }

    // 收集所有字段
    const fieldMap = new Map<string, any[]>();
    
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        this.flattenObject(item, '', fieldMap);
      }
    });

    // 分析每个字段
    const fields: FieldAnalysis[] = [];
    fieldMap.forEach((values, fieldName) => {
      const analysis = this.analyzeField(fieldName, values);
      fields.push(analysis);
    });

    // 按字段名排序
    fields.sort((a, b) => a.name.localeCompare(b.name));

    return {
      fields,
      totalFields: fields.length,
      tableName: this.generateTableName(sessionId),
    };
  }

  /**
   * 扁平化嵌套对象
   */
  private flattenObject(obj: any, prefix: string, fieldMap: Map<string, any[]>): void {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      const value = obj[key];

      if (value === null || value === undefined) {
        // 处理空值
        if (!fieldMap.has(fullKey)) {
          fieldMap.set(fullKey, []);
        }
        fieldMap.get(fullKey)!.push(value);
      } else if (Array.isArray(value)) {
        // 数组类型：存储为JSON字符串
        if (!fieldMap.has(fullKey)) {
          fieldMap.set(fullKey, []);
        }
        fieldMap.get(fullKey)!.push(JSON.stringify(value));
      } else if (typeof value === 'object') {
        // 嵌套对象：递归扁平化
        this.flattenObject(value, fullKey, fieldMap);
      } else {
        // 基础类型
        if (!fieldMap.has(fullKey)) {
          fieldMap.set(fullKey, []);
        }
        fieldMap.get(fullKey)!.push(value);
      }
    });
  }

  /**
   * 分析单个字段的类型
   */
  private analyzeField(fieldName: string, values: any[]): FieldAnalysis {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);
    const nullable = nonNullValues.length < values.length;
    
    // 收集样本值（最多5个）
    const sampleValues = [...new Set(nonNullValues)].slice(0, 5);

    if (nonNullValues.length === 0) {
      // 全部为空值
      return {
        name: fieldName,
        type: 'unknown',
        mysqlType: 'TEXT',
        nullable: true,
        sampleValues: [null],
      };
    }

    // 分析数据类型
    const typeAnalysis = this.inferDataType(nonNullValues);
    const mysqlType = this.mapToMySQLType(typeAnalysis);

    return {
      name: fieldName,
      type: typeAnalysis.type,
      mysqlType,
      nullable,
      maxLength: typeAnalysis.maxLength,
      precision: typeAnalysis.precision,
      scale: typeAnalysis.scale,
      sampleValues,
    };
  }

  /**
   * 推断数据类型
   */
  private inferDataType(values: any[]): {
    type: string;
    maxLength?: number;
    precision?: number;
    scale?: number;
  } {
    const types = new Set<string>();
    let maxLength = 0;
    let maxPrecision = 0;
    let maxScale = 0;

    values.forEach(value => {
      const valueType = this.getValueType(value);
      types.add(valueType);

      if (typeof value === 'string') {
        maxLength = Math.max(maxLength, value.length);
      } else if (typeof value === 'number') {
        const str = value.toString();
        const parts = str.split('.');
        maxPrecision = Math.max(maxPrecision, str.replace('.', '').length);
        if (parts.length > 1) {
          maxScale = Math.max(maxScale, parts[1].length);
        }
      }
    });

    // 如果有多种类型，优先级：string > number > boolean
    if (types.has('string')) {
      return { type: 'string', maxLength };
    } else if (types.has('number')) {
      return { 
        type: 'number', 
        precision: Math.min(maxPrecision, 65), // MySQL DECIMAL 最大精度
        scale: Math.min(maxScale, 30) // MySQL DECIMAL 最大小数位
      };
    } else if (types.has('integer')) {
      return { type: 'integer' };
    } else if (types.has('boolean')) {
      return { type: 'boolean' };
    } else if (types.has('date')) {
      return { type: 'date' };
    } else if (types.has('email')) {
      return { type: 'email', maxLength };
    } else if (types.has('url')) {
      return { type: 'url', maxLength };
    } else {
      return { type: 'string', maxLength };
    }
  }

  /**
   * 获取值的具体类型
   */
  private getValueType(value: any): string {
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    
    if (typeof value === 'string') {
      // 检查是否为日期
      if (this.isDateString(value)) {
        return 'date';
      }
      
      // 检查是否为邮箱
      if (this.isEmail(value)) {
        return 'email';
      }
      
      // 检查是否为URL
      if (this.isUrl(value)) {
        return 'url';
      }
      
      return 'string';
    }
    
    return 'string';
  }

  /**
   * 映射到MySQL数据类型
   */
  private mapToMySQLType(typeInfo: {
    type: string;
    maxLength?: number;
    precision?: number;
    scale?: number;
  }): string {
    switch (typeInfo.type) {
      case 'boolean':
        return 'BOOLEAN';
        
      case 'integer':
        return 'BIGINT';
        
      case 'number':
        if (typeInfo.precision && typeInfo.scale !== undefined) {
          return `DECIMAL(${typeInfo.precision},${typeInfo.scale})`;
        }
        return 'DECIMAL(10,2)';
        
      case 'date':
        return 'DATETIME';
        
      case 'email':
      case 'url':
        const length = Math.max(typeInfo.maxLength || 0, 255);
        return length <= 255 ? `VARCHAR(${length})` : 'TEXT';
        
      case 'string':
      default:
        if (!typeInfo.maxLength || typeInfo.maxLength <= 255) {
          const length = Math.max(typeInfo.maxLength || 0, 255);
          return `VARCHAR(${length})`;
        } else if (typeInfo.maxLength <= 65535) {
          return 'TEXT';
        } else if (typeInfo.maxLength <= 16777215) {
          return 'MEDIUMTEXT';
        } else {
          return 'LONGTEXT';
        }
    }
  }

  /**
   * 生成表名
   */
  private generateTableName(sessionId: string): string {
    return `data_${sessionId.replace(/-/g, '_')}`;
  }

  /**
   * 检查是否为日期字符串
   */
  private isDateString(value: string): boolean {
    // ISO 8601 格式
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
    if (isoDateRegex.test(value)) {
      return !isNaN(Date.parse(value));
    }
    
    // 其他常见日期格式
    const commonDateRegex = /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/;
    if (commonDateRegex.test(value)) {
      return !isNaN(Date.parse(value));
    }
    
    return false;
  }

  /**
   * 检查是否为邮箱
   */
  private isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * 检查是否为URL
   */
  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}