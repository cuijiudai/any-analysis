import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { AggregationType } from '../../entities/chart-config.entity';

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
  aggregation: AggregationType;
  value: number;
  groupBy?: string;
  groups?: Array<{
    groupValue: any;
    aggregatedValue: number;
  }>;
}

export interface ChartDataPoint {
  x: any;
  y: number;
  label?: string;
  category?: string;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  data: ChartDataPoint[];
  categories?: string[];
  aggregation?: AggregationType;
  totalRecords: number;
}

export interface ChartConfigDto {
  sessionId: string;
  chartType: 'line' | 'bar' | 'pie' | 'scatter';
  xAxis: string;
  yAxis: string;
  xAxisAggregation?: 'none' | 'group' | 'date_group' | 'range';
  aggregation?: AggregationType;
  groupBy?: string;
  filters?: FilterCondition[];
  title?: string;
  colorScheme?: string[];
  showLegend?: boolean;
  showDataLabels?: boolean;
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
      // 处理全局搜索
      const globalSearchFilter = options.filters.find(f => f.field === 'all');
      if (globalSearchFilter) {
        this.applyGlobalSearch(queryBuilder, globalSearchFilter.value, fieldDefinitions);
        // 移除全局搜索过滤器，应用其他过滤器
        const otherFilters = options.filters.filter(f => f.field !== 'all');
        if (otherFilters.length > 0) {
          this.applyFilters(queryBuilder, otherFilters, fieldDefinitions);
        }
      } else {
        this.applyFilters(queryBuilder, options.filters, fieldDefinitions);
      }
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
    aggregation: AggregationType,
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
    try {
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
    } catch (error) {
      // 如果没有数据表结构，返回默认值
      const annotatedFields = await this.annotationRepository.count({
        where: { sessionId },
      });
      
      return {
        totalRecords: 0,
        fieldsCount: 0,
        annotatedFields,
        dataTypes: {},
        sampleData: [],
      };
    }
  }

  /**
   * 应用全局搜索
   */
  private applyGlobalSearch(
    queryBuilder: SelectQueryBuilder<any>,
    searchValue: string,
    fieldDefinitions: Record<string, any>
  ): void {
    const searchableFields = Object.keys(fieldDefinitions).filter(field => {
      const fieldType = fieldDefinitions[field]?.type;
      // 只在文本类型字段中搜索
      return ['string', 'text'].includes(fieldType);
    });

    if (searchableFields.length > 0) {
      const searchConditions = searchableFields.map(field => 
        `data.${field} LIKE :globalSearch`
      ).join(' OR ');
      
      queryBuilder.andWhere(`(${searchConditions})`, {
        globalSearch: `%${searchValue}%`
      });
    }
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
   * 生成图表数据
   */
  async generateChartData(config: ChartConfigDto): Promise<ChartData> {
    const { sessionId, chartType, xAxis, yAxis, aggregation, filters, title } = config;
    
    // 验证会话和表结构
    const schema = await this.getSessionSchema(sessionId);
    const tableName = schema.tableName;
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;

    // 验证字段存在
    if (!fieldDefinitions[xAxis]) {
      throw new BadRequestException(`X轴字段 ${xAxis} 不存在`);
    }
    if (!fieldDefinitions[yAxis]) {
      throw new BadRequestException(`Y轴字段 ${yAxis} 不存在`);
    }

    // 获取字段标注信息
    const annotations = await this.annotationRepository.find({
      where: { sessionId },
    });
    const annotationMap = new Map<string, FieldAnnotation>();
    annotations.forEach(annotation => {
      annotationMap.set(annotation.fieldName, annotation);
    });

    const xAxisLabel = annotationMap.get(xAxis)?.label || xAxis;
    const yAxisLabel = annotationMap.get(yAxis)?.label || yAxis;

    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .from(tableName, 'data');

    // 根据图表类型和聚合方式构建查询
    if (chartType === 'pie') {
      // 饼图：按X轴分组，对Y轴进行聚合
      const aggFunction = this.getAggregationFunction(aggregation || 'count', yAxis);
      queryBuilder
        .select(`data.${xAxis}`, 'x')
        .addSelect(aggFunction, 'y')
        .groupBy(`data.${xAxis}`)
        .orderBy('y', 'DESC');
    } else if (aggregation) {
      // 其他图表类型：按X轴分组，对Y轴进行聚合
      const aggFunction = this.getAggregationFunction(aggregation, yAxis);
      queryBuilder
        .select(`data.${xAxis}`, 'x')
        .addSelect(aggFunction, 'y')
        .groupBy(`data.${xAxis}`)
        .orderBy(`data.${xAxis}`, 'ASC');
    } else {
      // 散点图或无聚合：直接选择X和Y轴数据
      queryBuilder
        .select(`data.${xAxis}`, 'x')
        .addSelect(`data.${yAxis}`, 'y')
        .orderBy(`data.${xAxis}`, 'ASC');
    }

    // 应用筛选条件
    if (filters && filters.length > 0) {
      this.applyFilters(queryBuilder, filters, fieldDefinitions);
    }

    // 限制数据点数量（避免图表过于复杂）
    if (chartType === 'scatter' || !aggregation) {
      queryBuilder.limit(1000);
    }

    // 执行查询
    const rawData = await queryBuilder.getRawMany();
    
    // 获取总记录数
    const totalRecords = await this.getFilteredCount(tableName, filters, fieldDefinitions);

    // 转换数据格式
    const data: ChartDataPoint[] = rawData.map(row => ({
      x: row.x,
      y: parseFloat(row.y) || 0,
      label: String(row.x),
    }));

    // 对于饼图，计算百分比
    if (chartType === 'pie') {
      const total = data.reduce((sum, point) => sum + point.y, 0);
      data.forEach(point => {
        point.category = `${point.label} (${((point.y / total) * 100).toFixed(1)}%)`;
      });
    }

    return {
      type: chartType,
      title: title || `${xAxisLabel} vs ${yAxisLabel}`,
      xAxisLabel,
      yAxisLabel,
      data,
      aggregation,
      totalRecords,
    };
  }

  /**
   * 获取图表建议
   */
  async getChartSuggestions(sessionId: string): Promise<Array<{
    chartType: 'line' | 'bar' | 'pie' | 'scatter';
    xAxis: string;
    yAxis: string;
    aggregation?: AggregationType;
    title: string;
    description: string;
    suitability: number; // 0-100 适合度评分
  }>> {
    const schema = await this.getSessionSchema(sessionId);
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;
    
    // 获取字段标注
    const annotations = await this.annotationRepository.find({
      where: { sessionId },
    });
    const annotationMap = new Map<string, FieldAnnotation>();
    annotations.forEach(annotation => {
      annotationMap.set(annotation.fieldName, annotation);
    });

    const suggestions: any[] = [];
    const fields = Object.keys(fieldDefinitions);
    
    // 分类字段类型
    const numericFields = fields.filter(field => 
      ['integer', 'number', 'decimal', 'float'].includes(fieldDefinitions[field]?.type)
    );
    const categoricalFields = fields.filter(field => 
      ['string', 'text'].includes(fieldDefinitions[field]?.type)
    );
    const dateFields = fields.filter(field => 
      ['date', 'datetime', 'timestamp'].includes(fieldDefinitions[field]?.type)
    );

    // 生成建议
    // 1. 数值字段的分布（柱状图）
    numericFields.forEach(field => {
      const label = annotationMap.get(field)?.label || field;
      suggestions.push({
        chartType: 'bar' as const,
        xAxis: field,
        yAxis: field,
        aggregation: 'count' as const,
        title: `${label}分布`,
        description: `显示${label}的数值分布情况`,
        suitability: 85,
      });
    });

    // 2. 分类字段的统计（饼图）
    categoricalFields.forEach(catField => {
      const label = annotationMap.get(catField)?.label || catField;
      suggestions.push({
        chartType: 'pie' as const,
        xAxis: catField,
        yAxis: catField,
        aggregation: 'count' as const,
        title: `${label}占比`,
        description: `显示不同${label}的占比情况`,
        suitability: 80,
      });
    });

    // 3. 时间序列（折线图）
    if (dateFields.length > 0 && numericFields.length > 0) {
      dateFields.forEach(dateField => {
        numericFields.forEach(numField => {
          const dateLabel = annotationMap.get(dateField)?.label || dateField;
          const numLabel = annotationMap.get(numField)?.label || numField;
          suggestions.push({
            chartType: 'line' as const,
            xAxis: dateField,
            yAxis: numField,
            aggregation: 'avg' as const,
            title: `${numLabel}趋势`,
            description: `显示${numLabel}随${dateLabel}的变化趋势`,
            suitability: 90,
          });
        });
      });
    }

    // 4. 数值字段相关性（散点图）
    for (let i = 0; i < numericFields.length; i++) {
      for (let j = i + 1; j < numericFields.length; j++) {
        const field1 = numericFields[i];
        const field2 = numericFields[j];
        const label1 = annotationMap.get(field1)?.label || field1;
        const label2 = annotationMap.get(field2)?.label || field2;
        
        suggestions.push({
          chartType: 'scatter' as const,
          xAxis: field1,
          yAxis: field2,
          title: `${label1} vs ${label2}`,
          description: `分析${label1}和${label2}之间的相关性`,
          suitability: 75,
        });
      }
    }

    // 5. 分类字段与数值字段的关系（柱状图）
    categoricalFields.forEach(catField => {
      numericFields.forEach(numField => {
        const catLabel = annotationMap.get(catField)?.label || catField;
        const numLabel = annotationMap.get(numField)?.label || numField;
        
        suggestions.push({
          chartType: 'bar' as const,
          xAxis: catField,
          yAxis: numField,
          aggregation: 'avg' as const,
          title: `不同${catLabel}的${numLabel}对比`,
          description: `比较不同${catLabel}的${numLabel}平均值`,
          suitability: 85,
        });
      });
    });

    // 按适合度排序并返回前10个建议
    return suggestions
      .sort((a, b) => b.suitability - a.suitability)
      .slice(0, 10);
  }

  /**
   * 获取聚合函数SQL
   */
  private getAggregationFunction(aggregation: AggregationType | string, field: string): string {
    const aggregationMap = {
      [AggregationType.SUM]: `SUM(data.${field})`,
      [AggregationType.AVG]: `AVG(data.${field})`,
      [AggregationType.COUNT]: `COUNT(data.${field})`,
      [AggregationType.MIN]: `MIN(data.${field})`,
      [AggregationType.MAX]: `MAX(data.${field})`,
      [AggregationType.NONE]: `data.${field}`,
    };

    return aggregationMap[aggregation] || `COUNT(data.${field})`;
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