import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { ChartConfig } from '../../entities/chart-config.entity';
import { FilterCondition, ChartData, ChartDataPoint, ChartConfigDto } from './data-analysis.service';
import { AggregationType } from '../../entities/chart-config.entity';

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  chartType: 'line' | 'bar' | 'pie' | 'scatter';
  defaultAggregation?: AggregationType;
  requiredFieldTypes: {
    xAxis: string[];
    yAxis: string[];
  };
  suitabilityScore: number;
}

@Injectable()
export class ChartDataService {


  // 预定义的图表模板
  private readonly chartTemplates: ChartTemplate[] = [
    {
      id: 'numeric_distribution',
      name: '数值分布',
      description: '显示数值字段的分布情况',
      chartType: 'bar',
      defaultAggregation: AggregationType.COUNT,
      requiredFieldTypes: {
        xAxis: ['integer', 'number', 'decimal', 'float'],
        yAxis: ['integer', 'number', 'decimal', 'float'],
      },
      suitabilityScore: 85,
    },
    {
      id: 'category_proportion',
      name: '分类占比',
      description: '显示分类字段的占比情况',
      chartType: 'pie',
      defaultAggregation: AggregationType.COUNT,
      requiredFieldTypes: {
        xAxis: ['string', 'text'],
        yAxis: ['string', 'text', 'integer', 'number'],
      },
      suitabilityScore: 80,
    },
    {
      id: 'time_trend',
      name: '时间趋势',
      description: '显示数值随时间的变化趋势',
      chartType: 'line',
      defaultAggregation: AggregationType.AVG,
      requiredFieldTypes: {
        xAxis: ['date', 'datetime', 'timestamp'],
        yAxis: ['integer', 'number', 'decimal', 'float'],
      },
      suitabilityScore: 90,
    },
    {
      id: 'correlation_analysis',
      name: '相关性分析',
      description: '分析两个数值字段之间的相关性',
      chartType: 'scatter',
      requiredFieldTypes: {
        xAxis: ['integer', 'number', 'decimal', 'float'],
        yAxis: ['integer', 'number', 'decimal', 'float'],
      },
      suitabilityScore: 75,
    },
    {
      id: 'category_comparison',
      name: '分类对比',
      description: '比较不同分类的数值指标',
      chartType: 'bar',
      defaultAggregation: AggregationType.AVG,
      requiredFieldTypes: {
        xAxis: ['string', 'text'],
        yAxis: ['integer', 'number', 'decimal', 'float'],
      },
      suitabilityScore: 85,
    },
  ];

  constructor(
    @InjectRepository(DataSession)
    private readonly sessionRepository: Repository<DataSession>,
    @InjectRepository(DataTableSchema)
    private readonly schemaRepository: Repository<DataTableSchema>,
    @InjectRepository(FieldAnnotation)
    private readonly annotationRepository: Repository<FieldAnnotation>,
    @InjectRepository(ChartConfig)
    private readonly chartConfigRepository: Repository<ChartConfig>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 生成优化的图表数据
   */
  async generateOptimizedChartData(config: ChartConfigDto): Promise<ChartData> {
    const { sessionId, chartType, xAxis, yAxis, aggregation, filters, title } = config;
    
    // 获取会话信息
    const schema = await this.getSessionSchema(sessionId);
    const tableName = schema.tableName;
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;

    // 验证字段
    this.validateFields(fieldDefinitions, xAxis, yAxis);

    // 获取字段标注
    const annotations = await this.getFieldAnnotations(sessionId);
    const xAxisLabel = annotations.get(xAxis)?.label || xAxis;
    const yAxisLabel = annotations.get(yAxis)?.label || yAxis;

    // 根据图表类型优化查询
    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .from(tableName, 'data');

    // 应用筛选条件
    if (filters && filters.length > 0) {
      this.applyFilters(queryBuilder, filters, fieldDefinitions);
    }

    let data: ChartDataPoint[] = [];
    let totalRecords = 0;

    switch (chartType) {
      case 'pie':
        ({ data, totalRecords } = await this.generatePieChartData(queryBuilder, xAxis, yAxis, aggregation));
        break;
      case 'line':
        ({ data, totalRecords } = await this.generateLineChartData(queryBuilder, xAxis, yAxis, aggregation));
        break;
      case 'bar':
        ({ data, totalRecords } = await this.generateBarChartData(queryBuilder, xAxis, yAxis, aggregation));
        break;
      case 'scatter':
        ({ data, totalRecords } = await this.generateScatterChartData(queryBuilder, xAxis, yAxis));
        break;
      default:
        throw new BadRequestException(`不支持的图表类型: ${chartType}`);
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
   * 生成饼图数据
   */
  private async generatePieChartData(
    queryBuilder: any,
    xAxis: string,
    yAxis: string,
    aggregation?: string
  ): Promise<{ data: ChartDataPoint[]; totalRecords: number }> {
    const aggFunction = this.getAggregationFunction(aggregation || 'count', yAxis);
    
    queryBuilder
      .select(`data.${xAxis}`, 'x')
      .addSelect(aggFunction, 'y')
      .groupBy(`data.${xAxis}`)
      .orderBy('y', 'DESC')
      .limit(20); // 限制饼图分片数量

    const rawData = await queryBuilder.getRawMany();
    const total = rawData.reduce((sum: number, row: any) => sum + parseFloat(row.y || 0), 0);

    const data: ChartDataPoint[] = rawData.map((row: any) => {
      const value = parseFloat(row.y) || 0;
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      
      return {
        x: row.x,
        y: value,
        label: String(row.x),
        category: `${row.x} (${percentage}%)`,
      };
    });

    return { data, totalRecords: rawData.length };
  }

  /**
   * 生成折线图数据
   */
  private async generateLineChartData(
    queryBuilder: any,
    xAxis: string,
    yAxis: string,
    aggregation?: string
  ): Promise<{ data: ChartDataPoint[]; totalRecords: number }> {
    const aggFunction = this.getAggregationFunction(aggregation || 'avg', yAxis);
    
    queryBuilder
      .select(`data.${xAxis}`, 'x')
      .addSelect(aggFunction, 'y')
      .groupBy(`data.${xAxis}`)
      .orderBy(`data.${xAxis}`, 'ASC')
      .limit(500); // 限制数据点数量

    const rawData = await queryBuilder.getRawMany();

    const data: ChartDataPoint[] = rawData.map((row: any) => ({
      x: row.x,
      y: parseFloat(row.y) || 0,
      label: String(row.x),
    }));

    return { data, totalRecords: rawData.length };
  }

  /**
   * 生成柱状图数据
   */
  private async generateBarChartData(
    queryBuilder: any,
    xAxis: string,
    yAxis: string,
    aggregation?: string
  ): Promise<{ data: ChartDataPoint[]; totalRecords: number }> {
    const aggFunction = this.getAggregationFunction(aggregation || 'sum', yAxis);
    
    queryBuilder
      .select(`data.${xAxis}`, 'x')
      .addSelect(aggFunction, 'y')
      .groupBy(`data.${xAxis}`)
      .orderBy('y', 'DESC')
      .limit(50); // 限制柱状图数量

    const rawData = await queryBuilder.getRawMany();

    const data: ChartDataPoint[] = rawData.map((row: any) => ({
      x: row.x,
      y: parseFloat(row.y) || 0,
      label: String(row.x),
    }));

    return { data, totalRecords: rawData.length };
  }

  /**
   * 生成散点图数据
   */
  private async generateScatterChartData(
    queryBuilder: any,
    xAxis: string,
    yAxis: string
  ): Promise<{ data: ChartDataPoint[]; totalRecords: number }> {
    queryBuilder
      .select(`data.${xAxis}`, 'x')
      .addSelect(`data.${yAxis}`, 'y')
      .where(`data.${xAxis} IS NOT NULL`)
      .andWhere(`data.${yAxis} IS NOT NULL`)
      .orderBy('RAND()')
      .limit(1000); // 散点图采样

    const rawData = await queryBuilder.getRawMany();

    const data: ChartDataPoint[] = rawData.map((row: any) => ({
      x: parseFloat(row.x) || 0,
      y: parseFloat(row.y) || 0,
      label: `(${row.x}, ${row.y})`,
    }));

    return { data, totalRecords: rawData.length };
  }

  /**
   * 获取智能图表建议
   */
  async getIntelligentChartSuggestions(sessionId: string): Promise<Array<{
    template: ChartTemplate;
    xAxis: string;
    yAxis: string;
    xAxisLabel: string;
    yAxisLabel: string;
    aggregation?: string;
    title: string;
    description: string;
    suitability: number;
    estimatedDataPoints: number;
  }>> {
    const schema = await this.getSessionSchema(sessionId);
    const fieldDefinitions = schema.fieldDefinitions as Record<string, any>;
    const annotations = await this.getFieldAnnotations(sessionId);

    const suggestions: any[] = [];
    const fields = Object.keys(fieldDefinitions);

    // 为每个模板生成建议
    for (const template of this.chartTemplates) {
      const xAxisCandidates = fields.filter(field => 
        template.requiredFieldTypes.xAxis.includes(fieldDefinitions[field]?.type)
      );
      const yAxisCandidates = fields.filter(field => 
        template.requiredFieldTypes.yAxis.includes(fieldDefinitions[field]?.type)
      );

      // 生成字段组合
      for (const xField of xAxisCandidates) {
        for (const yField of yAxisCandidates) {
          if (xField === yField && template.chartType !== 'pie') continue;

          const xLabel = annotations.get(xField)?.label || xField;
          const yLabel = annotations.get(yField)?.label || yField;

          // 估算数据点数量
          const estimatedDataPoints = await this.estimateDataPoints(
            sessionId, 
            xField, 
            yField, 
            template.chartType,
            template.defaultAggregation
          );

          // 计算适合度
          const suitability = this.calculateSuitability(
            template,
            fieldDefinitions[xField],
            fieldDefinitions[yField],
            estimatedDataPoints
          );

          suggestions.push({
            template,
            xAxis: xField,
            yAxis: yField,
            xAxisLabel: xLabel,
            yAxisLabel: yLabel,
            aggregation: template.defaultAggregation,
            title: this.generateChartTitle(template, xLabel, yLabel),
            description: `${template.description}：${xLabel} vs ${yLabel}`,
            suitability,
            estimatedDataPoints,
          });
        }
      }
    }

    // 排序并返回最佳建议
    return suggestions
      .sort((a, b) => b.suitability - a.suitability)
      .slice(0, 15);
  }

  /**
   * 保存图表配置
   */
  async saveChartConfig(config: Partial<ChartConfig> & { sessionId: string }): Promise<ChartConfig> {
    const chartConfig = this.chartConfigRepository.create({
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.chartConfigRepository.save(chartConfig);
  }

  /**
   * 获取保存的图表配置列表
   */
  async getSavedChartConfigs(sessionId: string): Promise<ChartConfig[]> {
    return await this.chartConfigRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据ID获取图表配置
   */
  async getChartConfigById(configId: string): Promise<ChartConfig | null> {
    return await this.chartConfigRepository.findOne({
      where: { id: configId },
    });
  }

  /**
   * 更新图表配置
   */
  async updateChartConfig(configId: string, updates: Partial<ChartConfig>): Promise<ChartConfig> {
    await this.chartConfigRepository.update(configId, {
      ...updates,
      updatedAt: new Date(),
    });
    
    const updatedConfig = await this.chartConfigRepository.findOne({
      where: { id: configId },
    });
    
    if (!updatedConfig) {
      throw new NotFoundException(`图表配置 ${configId} 不存在`);
    }
    
    return updatedConfig;
  }

  /**
   * 删除图表配置
   */
  async deleteChartConfig(configId: string): Promise<void> {
    const result = await this.chartConfigRepository.delete(configId);
    if (result.affected === 0) {
      throw new NotFoundException(`图表配置 ${configId} 不存在`);
    }
  }

  /**
   * 复制图表配置
   */
  async duplicateChartConfig(configId: string, newName?: string): Promise<ChartConfig> {
    const originalConfig = await this.getChartConfigById(configId);
    if (!originalConfig) {
      throw new NotFoundException(`图表配置 ${configId} 不存在`);
    }

    const duplicatedConfig = this.chartConfigRepository.create({
      ...originalConfig,
      id: undefined, // 让数据库生成新的ID
      name: newName || `${originalConfig.name} (副本)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.chartConfigRepository.save(duplicatedConfig);
  }

  /**
   * 批量删除图表配置
   */
  async batchDeleteChartConfigs(configIds: string[]): Promise<void> {
    await this.chartConfigRepository.delete(configIds);
  }

  /**
   * 获取图表配置统计信息
   */
  async getChartConfigStats(sessionId: string): Promise<{
    totalCharts: number;
    chartTypeDistribution: Record<string, number>;
    recentCharts: ChartConfig[];
  }> {
    const configs = await this.getSavedChartConfigs(sessionId);
    
    const chartTypeDistribution: Record<string, number> = {};
    configs.forEach(config => {
      chartTypeDistribution[config.chartType] = (chartTypeDistribution[config.chartType] || 0) + 1;
    });

    return {
      totalCharts: configs.length,
      chartTypeDistribution,
      recentCharts: configs.slice(0, 5), // 最近5个图表
    };
  }

  // 私有辅助方法
  private async getSessionSchema(sessionId: string): Promise<DataTableSchema> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    const schema = await this.schemaRepository.findOne({ where: { sessionId } });
    if (!schema) {
      throw new NotFoundException(`会话 ${sessionId} 没有数据表结构`);
    }

    return schema;
  }

  private async getFieldAnnotations(sessionId: string): Promise<Map<string, FieldAnnotation>> {
    const annotations = await this.annotationRepository.find({ where: { sessionId } });
    const annotationMap = new Map<string, FieldAnnotation>();
    annotations.forEach(annotation => {
      annotationMap.set(annotation.fieldName, annotation);
    });
    return annotationMap;
  }

  private validateFields(fieldDefinitions: Record<string, any>, xAxis: string, yAxis: string): void {
    if (!fieldDefinitions[xAxis]) {
      throw new BadRequestException(`X轴字段 ${xAxis} 不存在`);
    }
    if (!fieldDefinitions[yAxis]) {
      throw new BadRequestException(`Y轴字段 ${yAxis} 不存在`);
    }
  }

  private applyFilters(queryBuilder: any, filters: FilterCondition[], fieldDefinitions: Record<string, any>): void {
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

  private async estimateDataPoints(
    sessionId: string,
    xField: string,
    yField: string,
    chartType: string,
    aggregation?: string
  ): Promise<number> {
    // 简化实现：返回估算值
    // 实际实现中可以查询数据库获取更准确的估算
    return Math.floor(Math.random() * 100) + 10;
  }

  private calculateSuitability(
    template: ChartTemplate,
    xFieldDef: any,
    yFieldDef: any,
    estimatedDataPoints: number
  ): number {
    let score = template.suitabilityScore;

    // 根据数据点数量调整适合度
    if (template.chartType === 'pie' && estimatedDataPoints > 20) {
      score -= 20; // 饼图不适合太多分片
    }
    if (template.chartType === 'scatter' && estimatedDataPoints < 10) {
      score -= 30; // 散点图需要足够的数据点
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateChartTitle(template: ChartTemplate, xLabel: string, yLabel: string): string {
    const titleMap = {
      numeric_distribution: `${xLabel}分布图`,
      category_proportion: `${xLabel}占比图`,
      time_trend: `${yLabel}随${xLabel}变化趋势`,
      correlation_analysis: `${xLabel}与${yLabel}相关性分析`,
      category_comparison: `不同${xLabel}的${yLabel}对比`,
    };

    return titleMap[template.id] || `${xLabel} vs ${yLabel}`;
  }
}