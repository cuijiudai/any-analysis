import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like' | 'between' | 'is_null' | 'is_not_null';
  value?: any;
  values?: any[]; // 用于 in 和 between 操作符
}

export interface SortCondition {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryOptions {
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  page?: number;
  pageSize?: number;
  fields?: string[]; // 指定要查询的字段
}

export interface QueryResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  fields: Array<{
    name: string;
    label: string;
    type: string;
  }>;
}

export interface AggregationResult {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  value: number;
  groupBy?: string;
  groups?: Array<{
    groupValue: any;
    aggregatedValue: number;
  }>;
}

@Injectable()
export class DataAnalysisService {
  private readonly logger = new Logger(DataAnalysisService.name);

  constructor(
    @InjectRepository(DataSession)
    private readonly sessionRepository: Repository<DataSession>,
    @InjectRepository(DataTableSchema)
    private readonly schemaRepository: Repository<DataTableSchema>,
    @InjectRepository(FieldAnnotation)
    private readonly annotationRepository: Repository<FieldAnnotation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 查询会话数据
   */
  async queryData(sessionId: string, options: QueryOptions = {}): Promise<QueryResult> {
    // 验证会话存在
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    // 获取数据表结构
    const schema = await this.schemaRepository.findOne({
      where: { sessionId },
    });

    if (!schema) {
      throw new NotFoundException(`会话 ${sessionId} 没有数据表结构`);
    }

    // 获取字段标注
    const annotations = await this.annotationRepository.find({
      where: { sessionId },
    });

    const annotationMap = new Map<string, FieldAnnotation>();
    annotations.forEach(annotation => {
      annotationMap.set(annotation.fieldName, annotation);
    });

    // 构建查询
    const tableName = schema.tableName;
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;
    
    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .from(tableName, 'data');

    // 选择字段
    const fieldsToSelect = options.fields || Object.keys(fieldDefinitions);
    fieldsToSelect.forEach(field => {
      queryBuilder.addSelect(`data.${field}`, field);
    });

    // 应用筛选条件
    if (options.filters && options.filters.length > 0) {
      this.applyFilters(queryBuilder, options.filters, fieldDefinitions);
    }

    // 应用排序
    if (options.sorts && options.sorts.length > 0) {
      options.sorts.forEach((sort, index) => {
        if (index === 0) {
          queryBuilder.orderBy(`data.${sort.field}`, sort.direction);
        } else {
          queryBuilder.addOrderBy(`data.${sort.field}`, sort.direction);
        }
      });
    } else {
      // 默认按 ID 排序
      queryBuilder.orderBy('data.id', 'ASC');
    }

    // 分页
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 20, 1000); // 限制最大页面大小
    const skip = (page - 1) * pageSize;

    queryBuilder.skip(skip).take(pageSize);

    // 执行查询
    const [data, total] = await Promise.all([
      queryBuilder.getRawMany(),
      this.getFilteredCount(tableName, options.filters, fieldDefinitions),
    ]);

    // 构建字段信息
    const fields = fieldsToSelect.map(fieldName => {
      const annotation = annotationMap.get(fieldName);
      const fieldDef = fieldDefinitions[fieldName];
      
      return {
        name: fieldName,
        label: annotation?.label || fieldName,
        type: fieldDef?.type || 'string',
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      fields,
    };
  }

  /**
   * 数据聚合查询
   */
  async aggregateData(
    sessionId: string,
    field: string,
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max',
    groupBy?: string,
    filters?: FilterCondition[]
  ): Promise<AggregationResult> {
    // 验证会话和表结构
    const schema = await this.getSessionSchema(sessionId);
    const tableName = schema.tableName;
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;

    // 验证字段存在
    if (!fieldDefinitions[field]) {
      throw new BadRequestException(`字段 ${field} 不存在`);
    }

    if (groupBy && !fieldDefinitions[groupBy]) {
      throw new BadRequestException(`分组字段 ${groupBy} 不存在`);
    }

    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .from(tableName, 'data');

    // 构建聚合查询
    const aggregationMap = {
      sum: `SUM(data.${field})`,
      avg: `AVG(data.${field})`,
      count: `COUNT(data.${field})`,
      min: `MIN(data.${field})`,
      max: `MAX(data.${field})`,
    };

    if (groupBy) {
      queryBuilder
        .select(`data.${groupBy}`, 'groupValue')
        .addSelect(aggregationMap[aggregation], 'aggregatedValue')
        .groupBy(`data.${groupBy}`)
        .orderBy(`data.${groupBy}`, 'ASC');
    } else {
      queryBuilder.select(aggregationMap[aggregation], 'aggregatedValue');
    }

    // 应用筛选条件
    if (filters && filters.length > 0) {
      this.applyFilters(queryBuilder, filters, fieldDefinitions);
    }

    // 执行查询
    const results = await queryBuilder.getRawMany();

    if (groupBy) {
      return {
        field,
        aggregation,
        value: 0, // 分组查询时总值为0
        groupBy,
        groups: results.map(row => ({
          groupValue: row.groupValue,
          aggregatedValue: parseFloat(row.aggregatedValue) || 0,
        })),
      };
    } else {
      return {
        field,
        aggregation,
        value: parseFloat(results[0]?.aggregatedValue) || 0,
      };
    }
  }

  /**
   * 获取字段统计信息
   */
  async getFieldStats(sessionId: string, field: string): Promise<{
    field: string;
    type: string;
    count: number;
    nullCount: number;
    uniqueCount: number;
    min?: any;
    max?: any;
    avg?: number;
    sum?: number;
    topValues?: Array<{ value: any; count: number }>;
  }> {
    const schema = await this.getSessionSchema(sessionId);
    const tableName = schema.tableName;
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;

    if (!fieldDefinitions[field]) {
      throw new BadRequestException(`字段 ${field} 不存在`);
    }

    const fieldType = fieldDefinitions[field]?.type || 'string';

    // 基础统计
    const basicStats = await this.dataSource.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(\`${field}\`) as non_null_count,
        COUNT(*) - COUNT(\`${field}\`) as null_count,
        COUNT(DISTINCT \`${field}\`) as unique_count
      FROM \`${tableName}\`
    `);

    const stats = basicStats[0];
    const result = {
      field,
      type: fieldType,
      count: parseInt(stats.total_count),
      nullCount: parseInt(stats.null_count),
      uniqueCount: parseInt(stats.unique_count),
    };

    // 数值类型的统计
    if (['integer', 'number', 'decimal', 'float'].includes(fieldType)) {
      const numericStats = await this.dataSource.query(`
        SELECT 
          MIN(\`${field}\`) as min_value,
          MAX(\`${field}\`) as max_value,
          AVG(\`${field}\`) as avg_value,
          SUM(\`${field}\`) as sum_value
        FROM \`${tableName}\`
        WHERE \`${field}\` IS NOT NULL
      `);

      if (numericStats[0]) {
        Object.assign(result, {
          min: numericStats[0].min_value,
          max: numericStats[0].max_value,
          avg: parseFloat(numericStats[0].avg_value) || 0,
          sum: parseFloat(numericStats[0].sum_value) || 0,
        });
      }
    }

    // 获取最常见的值（前10个）
    const topValues = await this.dataSource.query(`
      SELECT \`${field}\` as value, COUNT(*) as count
      FROM \`${tableName}\`
      WHERE \`${field}\` IS NOT NULL
      GROUP BY \`${field}\`
      ORDER BY count DESC
      LIMIT 10
    `);

    Object.assign(result, {
      topValues: topValues.map((row: any) => ({
        value: row.value,
        count: parseInt(row.count),
      })),
    });

    return result;
  }

  /**
   * 获取数据概览
   */
  async getDataOverview(sessionId: string): Promise<{
    totalRecords: number;
    fieldsCount: number;
    annotatedFields: number;
    dataTypes: Record<string, number>;
    sampleData: any[];
    createdAt?: string;
  }> {
    const schema = await this.getSessionSchema(sessionId);
    const tableName = schema.tableName;
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;

    // 获取总记录数
    const countResult = await this.dataSource.query(`
      SELECT COUNT(*) as total FROM \`${tableName}\`
    `);
    const totalRecords = parseInt(countResult[0]?.total || 0);

    // 获取字段标注数
    const annotatedFields = await this.annotationRepository.count({
      where: { sessionId },
    });

    // 统计数据类型
    const dataTypes: Record<string, number> = {};
    Object.values(fieldDefinitions).forEach((fieldDef: any) => {
      const type = fieldDef.type || 'string';
      dataTypes[type] = (dataTypes[type] || 0) + 1;
    });

    // 获取样本数据（前5条）
    const sampleData = await this.dataSource.query(`
      SELECT * FROM \`${tableName}\` LIMIT 5
    `);

    return {
      totalRecords,
      fieldsCount: Object.keys(fieldDefinitions).length,
      annotatedFields,
      dataTypes,
      sampleData,
      createdAt: schema.createdAt?.toISOString(),
    };
  }

  /**
   * 应用筛选条件
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<any>,
    filters: FilterCondition[],
    fieldDefinitions: Record<string, any>
  ): void {
    filters.forEach((filter, index) => {
      const { field, operator, value, values } = filter;
      
      // 验证字段存在
      if (!fieldDefinitions[field]) {
        throw new BadRequestException(`筛选字段 ${field} 不存在`);
      }

      const paramName = `filter_${index}`;
      const fieldPath = `data.${field}`;

      switch (operator) {
        case 'eq':
          queryBuilder.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: value });
          break;
        case 'ne':
          queryBuilder.andWhere(`${fieldPath} != :${paramName}`, { [paramName]: value });
          break;
        case 'gt':
          queryBuilder.andWhere(`${fieldPath} > :${paramName}`, { [paramName]: value });
          break;
        case 'gte':
          queryBuilder.andWhere(`${fieldPath} >= :${paramName}`, { [paramName]: value });
          break;
        case 'lt':
          queryBuilder.andWhere(`${fieldPath} < :${paramName}`, { [paramName]: value });
          break;
        case 'lte':
          queryBuilder.andWhere(`${fieldPath} <= :${paramName}`, { [paramName]: value });
          break;
        case 'like':
          queryBuilder.andWhere(`${fieldPath} LIKE :${paramName}`, { [paramName]: `%${value}%` });
          break;
        case 'in':
          if (values && values.length > 0) {
            queryBuilder.andWhere(`${fieldPath} IN (:...${paramName})`, { [paramName]: values });
          }
          break;
        case 'between':
          if (values && values.length === 2) {
            queryBuilder.andWhere(`${fieldPath} BETWEEN :${paramName}_start AND :${paramName}_end`, {
              [`${paramName}_start`]: values[0],
              [`${paramName}_end`]: values[1],
            });
          }
          break;
        case 'is_null':
          queryBuilder.andWhere(`${fieldPath} IS NULL`);
          break;
        case 'is_not_null':
          queryBuilder.andWhere(`${fieldPath} IS NOT NULL`);
          break;
        default:
          throw new BadRequestException(`不支持的操作符: ${operator}`);
      }
    });
  }

  /**
   * 获取筛选后的记录数
   */
  private async getFilteredCount(
    tableName: string,
    filters?: FilterCondition[],
    fieldDefinitions?: Record<string, any>
  ): Promise<number> {
    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .from(tableName, 'data')
      .select('COUNT(*)', 'count');

    if (filters && filters.length > 0 && fieldDefinitions) {
      this.applyFilters(queryBuilder, filters, fieldDefinitions);
    }

    const result = await queryBuilder.getRawOne();
    return parseInt(result?.count || 0);
  }

  /**
   * 获取会话的数据表结构
   */
  private async getSessionSchema(sessionId: string): Promise<DataTableSchema> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    const schema = await this.schemaRepository.findOne({
      where: { sessionId },
    });

    if (!schema) {
      throw new NotFoundException(`会话 ${sessionId} 没有数据表结构`);
    }

    return schema;
  }
}