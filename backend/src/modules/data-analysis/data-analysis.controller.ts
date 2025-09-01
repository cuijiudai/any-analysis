import { Controller, Get, Post, Put, Delete, Query, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DataAnalysisService, FilterCondition, SortCondition, QueryOptions, ChartConfigDto } from './data-analysis.service';
import { ChartType, AggregationType, XAxisAggregationType } from '../../entities/chart-config.entity';
import { ChartDataService } from './chart-data.service';

export class QueryDataDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsArray()
  filters?: FilterCondition[];

  @IsOptional()
  @IsArray()
  sorts?: SortCondition[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}

export class AggregateDataDto {
  @IsString()
  sessionId: string;

  @IsString()
  field: string;

  @IsString()
  aggregation: AggregationType;

  @IsOptional()
  @IsString()
  groupBy?: string;

  @IsOptional()
  @IsArray()
  filters?: FilterCondition[];
}

export class GenerateChartDto {
  @IsString()
  sessionId: string;

  @IsString()
  chartType: ChartType;

  @IsString()
  xAxis: string;

  @IsString()
  yAxis: string;

  @IsOptional()
  @IsString()
  xAxisAggregation?: XAxisAggregationType;

  @IsOptional()
  @IsString()
  aggregation?: AggregationType;

  @IsOptional()
  @IsString()
  groupBy?: string;

  @IsOptional()
  @IsArray()
  filters?: FilterCondition[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colorScheme?: string[];

  @IsOptional()
  showLegend?: boolean;

  @IsOptional()
  showDataLabels?: boolean;
}

@Controller('data-analysis')
export class DataAnalysisController {
  constructor(
    private readonly dataAnalysisService: DataAnalysisService,
    private readonly chartDataService: ChartDataService,
  ) {}

  /**
   * 查询会话数据
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryData(@Body() dto: QueryDataDto) {
    const { sessionId, ...options } = dto;
    const result = await this.dataAnalysisService.queryData(sessionId, options);
    
    return {
      success: true,
      ...result,
    };
  }

  /**
   * 获取会话数据（GET方式，用于简单查询）
   */
  @Get('data/:sessionId')
  async getData(
    @Param('sessionId') sessionId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('fields') fields?: string,
    @Query('sortField') sortField?: string,
    @Query('sortDirection') sortDirection?: 'ASC' | 'DESC'
  ) {
    const options: QueryOptions = {
      page: page ? parseInt(String(page)) : 1,
      pageSize: pageSize ? parseInt(String(pageSize)) : 20,
    };

    if (fields) {
      options.fields = fields.split(',');
    }

    if (sortField) {
      options.sorts = [{
        field: sortField,
        direction: sortDirection || 'ASC',
      }];
    }

    const result = await this.dataAnalysisService.queryData(sessionId, options);
    
    return {
      success: true,
      ...result,
    };
  }

  /**
   * 数据聚合查询
   */
  @Post('aggregate')
  @HttpCode(HttpStatus.OK)
  async aggregateData(@Body() dto: AggregateDataDto) {
    const { sessionId, field, aggregation, groupBy, filters } = dto;
    const result = await this.dataAnalysisService.aggregateData(
      sessionId,
      field,
      aggregation,
      groupBy,
      filters
    );
    
    return {
      success: true,
      result,
    };
  }

  /**
   * 获取字段统计信息
   */
  @Get('field-stats/:sessionId/:field')
  async getFieldStats(
    @Param('sessionId') sessionId: string,
    @Param('field') field: string
  ) {
    const stats = await this.dataAnalysisService.getFieldStats(sessionId, field);
    
    return {
      success: true,
      stats,
    };
  }

  /**
   * 获取数据概览
   */
  @Get('overview/:sessionId')
  async getDataOverview(@Param('sessionId') sessionId: string) {
    const overview = await this.dataAnalysisService.getDataOverview(sessionId);
    
    return {
      success: true,
      overview,
    };
  }

  /**
   * 导出数据
   */
  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportData(@Body() dto: QueryDataDto) {
    // 导出时不分页，获取所有数据
    const { sessionId, ...options } = dto;
    const exportOptions = {
      ...options,
      page: 1,
      pageSize: 100000, // 设置一个很大的数字来获取所有数据
    };
    
    const result = await this.dataAnalysisService.queryData(sessionId, exportOptions);
    
    return {
      success: true,
      data: result.data,
      fields: result.fields,
      total: result.total,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取筛选选项
   */
  @Get('filter-options/:sessionId/:field')
  async getFilterOptions(
    @Param('sessionId') sessionId: string,
    @Param('field') field: string,
    @Query('limit') limit?: number
  ) {
    const stats = await this.dataAnalysisService.getFieldStats(sessionId, field);
    
    // 返回字段的唯一值作为筛选选项
    const options = stats.topValues?.slice(0, limit ? parseInt(String(limit)) : 50) || [];
    
    return {
      success: true,
      field,
      type: stats.type,
      options: options.map(item => ({
        label: String(item.value),
        value: item.value,
        count: item.count,
      })),
      totalUniqueValues: stats.uniqueCount,
    };
  }

  /**
   * 获取字段枚举值（从对话数据聚合）
   */
  @Post('field-values')
  @HttpCode(HttpStatus.OK)
  async getFieldValues(@Body() dto: { sessionId: string; fieldName: string; limit?: number }) {
    const { sessionId, fieldName, limit = 50 } = dto;
    
    try {
      const stats = await this.dataAnalysisService.getFieldStats(sessionId, fieldName);
      
      // 返回字段的唯一值及其出现次数
      const values = stats.topValues?.slice(0, limit).map(item => ({
        value: item.value,
        count: item.count,
      })) || [];
      
      return {
        success: true,
        field: fieldName,
        values,
        totalUniqueValues: stats.uniqueCount,
        totalRecords: stats.count || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        values: [],
      };
    }
  }

  /**
   * 获取枚举字段的所有可能值
   */
  @Get('enum-values/:sessionId/:fieldName')
  async getEnumValues(
    @Param('sessionId') sessionId: string,
    @Param('fieldName') fieldName: string,
    @Query('limit') limit?: number
  ) {
    try {
      const stats = await this.dataAnalysisService.getFieldStats(sessionId, fieldName);
      
      // 检查是否为枚举类型（唯一值较少）
      const isEnum = stats.uniqueCount <= 50;
      
      if (!isEnum) {
        return {
          success: false,
          message: '该字段不是枚举类型',
          isEnum: false,
        };
      }
      
      const values = stats.topValues?.slice(0, limit ? parseInt(String(limit)) : 100).map(item => ({
        value: item.value,
        count: item.count,
        label: String(item.value),
      })) || [];
      
      return {
        success: true,
        field: fieldName,
        isEnum: true,
        values,
        totalUniqueValues: stats.uniqueCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        values: [],
      };
    }
  }

  /**
   * 批量获取字段统计信息
   */
  @Post('field-stats')
  @HttpCode(HttpStatus.OK)
  async getFieldsStats(@Body() dto: { sessionId: string; fields: string[] }) {
    const { sessionId, fields } = dto;
    
    try {
      const stats = await Promise.all(
        fields.map(async (field) => {
          try {
            const fieldStats = await this.dataAnalysisService.getFieldStats(sessionId, field);
            return {
              field,
              ...fieldStats,
            };
          } catch (error) {
            return {
              field,
              error: error.message,
            };
          }
        })
      );
      
      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stats: [],
      };
    }
  }

  /**
   * 获取数据统计信息
   */
  @Get('stats/:sessionId')
  async getDataStats(@Param('sessionId') sessionId: string) {
    const overview = await this.dataAnalysisService.getDataOverview(sessionId);
    
    return {
      success: true,
      data: {
        totalRecords: overview.totalRecords,
        totalFields: overview.fieldsCount,
        tableSize: 'N/A', // 可以后续实现
        created: overview.createdAt || new Date().toISOString(),
      },
    };
  }

  /**
   * 数据验证
   */
  @Get('validate/:sessionId')
  async validateData(@Param('sessionId') sessionId: string) {
    const overview = await this.dataAnalysisService.getDataOverview(sessionId);
    
    // 简单的数据验证逻辑
    const issues: string[] = [];
    
    if (overview.totalRecords === 0) {
      issues.push('数据表为空');
    }
    
    if (overview.annotatedFields === 0) {
      issues.push('没有字段标注');
    }
    
    if (overview.annotatedFields < overview.fieldsCount) {
      issues.push(`还有 ${overview.fieldsCount - overview.annotatedFields} 个字段未标注`);
    }
    
    return {
      success: true,
      isValid: issues.length === 0,
      issues,
      overview,
    };
  }

  /**
   * 生成图表数据
   */
  @Post('chart/generate')
  @HttpCode(HttpStatus.OK)
  async generateChart(@Body() dto: GenerateChartDto) {
    const config: ChartConfigDto = {
      sessionId: dto.sessionId,
      chartType: dto.chartType as any,
      xAxis: dto.xAxis,
      yAxis: dto.yAxis,
      xAxisAggregation: dto.xAxisAggregation,
      aggregation: dto.aggregation as any,
      groupBy: dto.groupBy,
      filters: dto.filters,
      title: dto.title,
      colorScheme: dto.colorScheme,
      showLegend: dto.showLegend,
      showDataLabels: dto.showDataLabels,
    };

    const chartData = await this.chartDataService.generateOptimizedChartData(config);
    
    return {
      success: true,
      chartData,
      config,
    };
  }

  /**
   * 获取图表建议
   */
  @Get('chart/suggestions/:sessionId')
  async getChartSuggestions(@Param('sessionId') sessionId: string) {
    const suggestions = await this.chartDataService.getIntelligentChartSuggestions(sessionId);
    
    return {
      success: true,
      suggestions,
    };
  }

  /**
   * 保存图表配置
   */
  @Post('chart/save')
  @HttpCode(HttpStatus.OK)
  async saveChartConfig(@Body() dto: GenerateChartDto & { name: string }) {
    const config = {
      sessionId: dto.sessionId,
      name: dto.name,
      chartType: dto.chartType as ChartType,
      xAxis: dto.xAxis,
      yAxis: dto.yAxis,
      aggregation: dto.aggregation as AggregationType,
      filters: dto.filters,
      title: dto.title,
    };

    const savedConfig = await this.chartDataService.saveChartConfig(config);
    
    return {
      success: true,
      config: savedConfig,
    };
  }

  /**
   * 获取保存的图表配置
   */
  @Get('chart/saved/:sessionId')
  async getSavedCharts(@Param('sessionId') sessionId: string) {
    const charts = await this.chartDataService.getSavedChartConfigs(sessionId);
    
    return {
      success: true,
      charts,
    };
  }

  /**
   * 删除图表配置
   */
  @Delete('chart/:chartId')
  async deleteChart(@Param('chartId') chartId: string) {
    await this.chartDataService.deleteChartConfig(chartId);
    
    return {
      success: true,
      message: '图表配置已删除',
    };
  }

  /**
   * 更新图表配置
   */
  @Put('chart/:chartId')
  @HttpCode(HttpStatus.OK)
  async updateChart(
    @Param('chartId') chartId: string,
    @Body() dto: Partial<GenerateChartDto> & { name?: string }
  ) {
    const updates = {
      name: dto.name,
      chartType: dto.chartType as ChartType,
      xAxis: dto.xAxis,
      yAxis: dto.yAxis,
      aggregation: dto.aggregation as AggregationType,
      title: dto.title,
    };

    const updatedConfig = await this.chartDataService.updateChartConfig(chartId, updates);
    
    return {
      success: true,
      message: '图表配置已更新',
      config: updatedConfig,
    };
  }

  /**
   * 根据保存的配置生成图表
   */
  @Get('chart/load/:chartId')
  async loadSavedChart(@Param('chartId') chartId: string) {
    // 获取保存的配置
    const chart = await this.chartDataService.getChartConfigById(chartId);
    
    if (!chart) {
      return {
        success: false,
        message: '图表配置不存在',
      };
    }

    // 根据配置生成图表数据
    const config: ChartConfigDto = {
      sessionId: chart.sessionId,
      chartType: chart.chartType as any,
      xAxis: chart.xAxis,
      yAxis: chart.yAxis,
      xAxisAggregation: chart.xAxisAggregation,
      aggregation: chart.aggregation as any,
      filters: chart.filters,
      title: chart.title || chart.name,
    };

    const chartData = await this.chartDataService.generateOptimizedChartData(config);
    
    return {
      success: true,
      chartData,
      config: chart,
    };
  }

  /**
   * 获取字段信息（用于图表配置）
   */
  @Get('fields/:sessionId')
  async getFields(@Param('sessionId') sessionId: string) {
    const overview = await this.dataAnalysisService.getDataOverview(sessionId);
    
    // 这里可以扩展返回更详细的字段信息
    return {
      success: true,
      fields: [], // 需要从schema中获取字段信息
      totalFields: overview.fieldsCount,
    };
  }

  /**
   * 预览图表数据（限制数据量）
   */
  @Post('chart/preview')
  @HttpCode(HttpStatus.OK)
  async previewChart(@Body() dto: GenerateChartDto) {
    // 预览时限制数据量
    const config: ChartConfigDto = {
      sessionId: dto.sessionId,
      chartType: dto.chartType as any,
      xAxis: dto.xAxis,
      yAxis: dto.yAxis,
      xAxisAggregation: dto.xAxisAggregation,
      aggregation: dto.aggregation as any,
      groupBy: dto.groupBy,
      filters: dto.filters,
      title: dto.title,
      colorScheme: dto.colorScheme,
      showLegend: dto.showLegend,
      showDataLabels: dto.showDataLabels,
    };

    const chartData = await this.dataAnalysisService.generateChartData(config);
    
    // 限制预览数据点数量
    const previewData = {
      ...chartData,
      data: chartData.data.slice(0, 50), // 只返回前50个数据点
    };
    
    return {
      success: true,
      chartData: previewData,
      isPreview: true,
      totalDataPoints: chartData.data.length,
    };
  }
}