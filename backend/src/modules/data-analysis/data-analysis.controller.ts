import { Controller, Get, Post, Query, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DataAnalysisService, FilterCondition, SortCondition, QueryOptions } from './data-analysis.service';

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
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';

  @IsOptional()
  @IsString()
  groupBy?: string;

  @IsOptional()
  @IsArray()
  filters?: FilterCondition[];
}

@Controller('data-analysis')
export class DataAnalysisController {
  constructor(
    private readonly dataAnalysisService: DataAnalysisService,
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
}