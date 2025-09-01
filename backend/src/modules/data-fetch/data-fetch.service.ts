import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpClientService } from '../../common/http-client';
import { CurlParserService } from '../../common/utils';
import { DynamicTableUtil } from '../../common/database-utils';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { SmokeTestDto, ParseCurlDto, CreateFetchConfigDto, ExecuteFetchDto } from './dto';

export interface SmokeTestResponse {
  success: boolean;
  data: any[];
  message?: string;
  error?: string;
  responseTime: number;
  dataStructure?: {
    fields: Array<{
      name: string;
      type: string;
      sampleValue: any;
    }>;
    totalFields: number;
  };
  suggestedPageFields?: string[]; // 建议的分页字段
}

export interface ParseCurlResponse {
  success: boolean;
  config?: {
    apiUrl: string;
    method: string;
    headers: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: any;
  };
  error?: string;
}

@Injectable()
export class DataFetchService {
  private readonly logger = new Logger(DataFetchService.name);

  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly curlParserService: CurlParserService,
    @InjectRepository(FetchConfig)
    private readonly fetchConfigRepository: Repository<FetchConfig>,
    @InjectRepository(DataSession)
    private readonly dataSessionRepository: Repository<DataSession>,
    @InjectRepository(DataTableSchema)
    private readonly dataTableSchemaRepository: Repository<DataTableSchema>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 执行冒烟测试
   * 不存储任何数据，仅用于验证API配置
   */
  async executeSmokeTest(smokeTestDto: SmokeTestDto): Promise<SmokeTestResponse> {
    const { 
      apiUrl, 
      method = 'GET', 
      headers = {}, 
      queryParams = {},
      data, 
      pageSize
    } = smokeTestDto;
    const startTime = Date.now();

    this.logger.log(`开始冒烟测试: ${method} ${apiUrl}`);

    try {
      // 验证URL格式并解析现有查询参数
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(apiUrl);
      } catch {
        throw new BadRequestException('URL格式无效');
      }

      // 构建不带查询参数的基础URL
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

      // 准备请求参数
      let requestParams: Record<string, any> = {};
      let requestData = data;

      // 保留原URL中的所有查询参数
      parsedUrl.searchParams.forEach((value, key) => {
        requestParams[key] = value;
      });

      // 添加前端传递的查询参数（优先级最高）
      if (queryParams && typeof queryParams === 'object') {
        Object.entries(queryParams).forEach(([key, value]) => {
          if (key && value !== undefined && value !== null) {
            requestParams[key] = value;
          }
        });
      }

      // 智能识别和处理分页参数
      const paginationInfo = this.detectPaginationFields(requestParams, requestData);
      
      // 只有在没有检测到任何分页参数且前端没有传递查询参数时，才添加默认分页参数
      const hasQueryParams = queryParams && Object.keys(queryParams).length > 0;
      
      this.logger.log(`调试信息 - requestParams: ${JSON.stringify(requestParams)}`);
      this.logger.log(`调试信息 - paginationInfo: ${JSON.stringify(paginationInfo)}`);
      this.logger.log(`调试信息 - hasQueryParams: ${hasQueryParams}`);
      
      if (!paginationInfo.hasExistingPagination && !hasQueryParams) {
        if (pageSize) {
          if (method === 'GET') {
            // GET 请求：在查询参数中添加分页信息
            requestParams[paginationInfo.pageField] = 1;
            requestParams[paginationInfo.pageSizeField] = pageSize;
          } else if (method === 'POST' && requestData) {
            // POST 请求：在请求体中添加分页信息
            if (typeof requestData === 'object' && requestData !== null) {
              requestData = {
                ...requestData,
                [paginationInfo.pageField]: 1,
                [paginationInfo.pageSizeField]: pageSize,
              };
            }
          }
        }
      }

      this.logger.log(`原始 queryParams: ${JSON.stringify(queryParams)}`);
      this.logger.log(`最终请求参数: ${JSON.stringify(requestParams)}`);
      this.logger.log(`检测到的分页信息: ${JSON.stringify(paginationInfo)}`);
      this.logger.log(`请求数据: ${JSON.stringify(requestData)}`);
      this.logger.log(`是否有前端查询参数: ${hasQueryParams}`);

      // 发送测试请求
      const response = await this.httpClientService.request({
        url: baseUrl,
        method: method as any,
        headers,
        params: requestParams,
        data: requestData,
        timeout: 30000, // 30秒超时
        retries: 2, // 冒烟测试重试2次
      });

      const responseTime = Date.now() - startTime;

      // 处理响应数据
      let sampleData: any[] = [];
      const responseData = response.data;

      // 如果指定了 dataPath，使用路径提取数据
      if (smokeTestDto.dataPath) {
        try {
          const extractedData = this.extractDataByPath(responseData, smokeTestDto.dataPath);
          if (Array.isArray(extractedData)) {
            sampleData = pageSize ? extractedData.slice(0, pageSize) : extractedData;
          } else {
            sampleData = [extractedData];
          }
        } catch (error) {
          this.logger.warn(`数据路径提取失败: ${error.message}，使用默认逻辑`);
          sampleData = this.extractDataWithDefaultLogic(responseData, pageSize || 0);
        }
      } else {
        sampleData = this.extractDataWithDefaultLogic(responseData, pageSize || 0);
      }

      // 分析数据结构
      const dataStructure = this.analyzeDataStructure(sampleData);

      // 检测建议的分页字段
      const suggestedPageFields = this.detectSuggestedPageFields(requestParams, requestData);

      this.logger.log(`冒烟测试成功，响应时间: ${responseTime}ms，获得 ${sampleData.length} 条样本数据`);

      return {
        success: true,
        data: sampleData,
        message: `连接成功，获得 ${sampleData.length} 条样本数据`,
        responseTime,
        dataStructure,
        suggestedPageFields,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`冒烟测试失败: ${error.message}`);

      let errorMessage = '连接失败';
      if (error.response) {
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '连接被拒绝，请检查URL和网络连接';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = '请求超时，请检查网络连接或增加超时时间';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        data: [],
        error: errorMessage,
        responseTime,
      };
    }
  }

  /**
   * 解析curl命令
   */
  async parseCurlCommand(parseCurlDto: ParseCurlDto): Promise<ParseCurlResponse> {
    const { curlCommand } = parseCurlDto;

    this.logger.log('开始解析curl命令');

    try {
      const result = this.curlParserService.parseCurlCommand(curlCommand);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // 验证解析结果
      const validationErrors = this.curlParserService.validateParsedConfig(result.config);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `配置验证失败: ${validationErrors.join(', ')}`,
        };
      }

      this.logger.log('curl命令解析成功');

      return {
        success: true,
        config: result.config,
      };
    } catch (error) {
      this.logger.error(`curl命令解析失败: ${error.message}`);

      return {
        success: false,
        error: `解析失败: ${error.message}`,
      };
    }
  }

  /**
   * 测试API连接
   */
  async testApiConnection(
    apiUrl: string,
    headers?: Record<string, string>
  ): Promise<{
    success: boolean;
    status?: number;
    message: string;
    responseTime: number;
  }> {
    this.logger.log(`测试API连接: ${apiUrl}`);

    return await this.httpClientService.testConnection(apiUrl, headers);
  }

  /**
   * 分析数据结构
   */
  private analyzeDataStructure(data: any[]): {
    fields: Array<{
      name: string;
      type: string;
      sampleValue: any;
    }>;
    totalFields: number;
  } {
    if (!data || data.length === 0) {
      return { fields: [], totalFields: 0 };
    }

    const fieldMap = new Map<string, { type: string; sampleValue: any }>();

    // 分析所有数据项的字段
    data.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        Object.entries(item).forEach(([key, value]) => {
          if (!fieldMap.has(key)) {
            fieldMap.set(key, {
              type: this.getFieldType(value),
              sampleValue: value,
            });
          }
        });
      }
    });

    const fields = Array.from(fieldMap.entries()).map(([name, info]) => ({
      name,
      type: info.type,
      sampleValue: info.sampleValue,
    }));

    return {
      fields,
      totalFields: fields.length,
    };
  }

  /**
   * 获取字段类型
   */
  private getFieldType(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    const type = typeof value;

    switch (type) {
      case 'boolean':
        return 'boolean';
      case 'number':
        return Number.isInteger(value) ? 'integer' : 'number';
      case 'string':
        // 尝试识别特殊格式
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
          return 'date';
        }
        if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value)) {
          return 'email';
        }
        if (/^https?:\/\//.test(value)) {
          return 'url';
        }
        return 'string';
      case 'object':
        if (Array.isArray(value)) {
          return 'array';
        }
        return 'object';
      default:
        return 'unknown';
    }
  }

  /**
   * 创建拉取配置
   */
  async createFetchConfig(createFetchConfigDto: CreateFetchConfigDto): Promise<FetchConfig> {
    const { sessionId, ...configData } = createFetchConfigDto;

    // 验证会话是否存在
    const session = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    // 检查是否已有配置
    const existingConfig = await this.fetchConfigRepository.findOne({
      where: { sessionId },
    });

    if (existingConfig) {
      // 更新现有配置
      Object.assign(existingConfig, configData);
      return await this.fetchConfigRepository.save(existingConfig);
    } else {
      // 创建新配置
      const newConfig = this.fetchConfigRepository.create({
        sessionId,
        ...configData,
      });
      return await this.fetchConfigRepository.save(newConfig);
    }
  }

  /**
   * 获取拉取配置
   */
  async getFetchConfig(sessionId: string): Promise<FetchConfig> {
    const config = await this.fetchConfigRepository.findOne({
      where: { sessionId },
      relations: ['session'],
    });

    if (!config) {
      throw new NotFoundException(`会话 ${sessionId} 的拉取配置不存在`);
    }

    return config;
  }

  /**
   * 执行正式数据拉取
   */
  async executeFetch(executeFetchDto: ExecuteFetchDto): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    totalRecords?: number;
    pagesProcessed?: number;
  }> {
    const { sessionId } = executeFetchDto;

    this.logger.log(`开始执行正式数据拉取，会话ID: ${sessionId}`);

    // 获取拉取配置
    const config = await this.getFetchConfig(sessionId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 第一步：拉取第一页数据分析结构
      this.logger.log('拉取第一页数据进行结构分析...');
      
      // 解析URL并保留原有查询参数
      const parsedUrl = new URL(config.apiUrl);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
      
      // 准备请求参数
      let requestParams: Record<string, any> = {};
      let requestData = config.data;

      // 保留原URL中的所有查询参数
      parsedUrl.searchParams.forEach((value, key) => {
        requestParams[key] = value;
      });

      // 添加配置中保存的查询参数
      if (config.queryParams && typeof config.queryParams === 'object') {
        Object.entries(config.queryParams).forEach(([key, value]) => {
          if (key && value !== undefined && value !== null) {
            requestParams[key] = value;
          }
        });
      }

      // 处理分页参数（如果启用分页）
      if (config.enablePagination && config.pageField) {
        // 使用配置的页面大小，如果没有设置则使用默认值50（适合拉取全部模式）
        const effectivePageSize = config.pageSize || 50;
        
        if (config.method === 'GET') {
          // GET 请求：分页参数放在 URL 查询参数中
          requestParams[config.pageField] = 1; // 从第1页开始
          
          // 尝试常见的页大小字段名
          const sizeFields = ['size', 'pageSize', 'limit', 'count', 'rows', 'per_page'];
          const sizeField = sizeFields.find(field => 
            parsedUrl.searchParams.has(field) || (requestData && requestData[field])
          ) || 'size';
          requestParams[sizeField] = effectivePageSize;
        } else if (config.method === 'POST' && requestData) {
          // POST 请求：分页参数可能在请求体中
          if (typeof requestData === 'object' && requestData !== null) {
            requestData = {
              ...requestData,
              [config.pageField]: 1,
            };
            
            const sizeFields = ['size', 'pageSize', 'limit', 'count', 'rows', 'per_page'];
            const sizeField = sizeFields.find(field => requestData[field]) || 'size';
            requestData[sizeField] = effectivePageSize;
          }
        }
      }
      
      const firstPageResponse = await this.httpClientService.request({
        url: baseUrl,
        method: config.method as any,
        headers: config.headers || {},
        params: requestParams,
        data: requestData,
        timeout: 0, // 取消超时限制
        retries: 2,
      });

      // 处理第一页数据
      let firstPageData: any[] = [];
      const responseData = firstPageResponse.data;

      // 如果指定了 dataPath，使用路径提取数据
      if (config.dataPath) {
        try {
          const extractedData = this.extractDataByPath(responseData, config.dataPath);
          if (Array.isArray(extractedData)) {
            firstPageData = extractedData;
          } else {
            firstPageData = [extractedData];
          }
        } catch (error) {
          this.logger.warn(`数据路径提取失败: ${error.message}，使用默认逻辑`);
          firstPageData = this.extractDataWithDefaultLogic(responseData, config.pageSize || 50);
        }
      } else {
        firstPageData = this.extractDataWithDefaultLogic(responseData, config.pageSize || 50);
      }

      if (firstPageData.length === 0) {
        throw new BadRequestException('API返回空数据');
      }

      // 检查是否已存在数据表结构
      const tableName = DynamicTableUtil.generateTableName(sessionId);
      let tableSchema = await this.dataTableSchemaRepository.findOne({
        where: { sessionId, tableName },
      });

      if (!tableSchema) {
        // 第一次拉取：分析数据结构并创建动态表
        const fieldDefinitions = DynamicTableUtil.analyzeDataStructure(firstPageData);

        this.logger.log(`创建动态表: ${tableName}`);
        await DynamicTableUtil.createDynamicTable(
          this.dataSource,
          tableName,
          fieldDefinitions,
          sessionId
        );

        // 保存表结构信息
        tableSchema = this.dataTableSchemaRepository.create({
          sessionId,
          tableName,
          fieldDefinitions,
        });
        await queryRunner.manager.save(tableSchema);
      } else {
        this.logger.log(`使用已存在的动态表: ${tableName}`);
      }

      // 插入第一页数据
      await DynamicTableUtil.insertDataBatch(
        this.dataSource,
        tableName,
        firstPageData,
        sessionId,
        1
      );

      // 查询实际插入的记录数（因为可能有重复数据被跳过）
      let totalRecordsResult = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE session_id = ?`,
        [sessionId]
      );
      let totalRecords = parseInt(totalRecordsResult[0]?.count || 0);
      let pagesProcessed = 1;

      // 第二步：根据配置拉取剩余数据
      if (config.enablePagination && config.pageField) {
        // 分页拉取模式：持续拉取直到没有更多数据
        let currentPage = 2; // 从第2页开始（第1页已经拉取）
        const maxPages = 1000; // 防止无限拉取

        while (currentPage <= maxPages) {
          this.logger.log(`拉取第 ${currentPage} 页数据...`);

          // 重新构建分页参数，保留原有查询参数和配置中的查询参数
          let pageParams = { ...requestParams };
          let pageRequestData = config.data;

          // 确保配置中的查询参数也包含在分页请求中
          if (config.queryParams && typeof config.queryParams === 'object') {
            Object.entries(config.queryParams).forEach(([key, value]) => {
              if (key && value !== undefined && value !== null) {
                pageParams[key] = value;
              }
            });
          }

          if (config.method === 'GET') {
            pageParams[config.pageField] = currentPage;
          } else if (config.method === 'POST' && pageRequestData) {
            if (typeof pageRequestData === 'object' && pageRequestData !== null) {
              pageRequestData = { ...pageRequestData, [config.pageField]: currentPage };
            }
          }

          const pageResponse = await this.httpClientService.request({
            url: baseUrl,
            method: config.method as any,
            headers: config.headers || {},
            params: pageParams,
            data: pageRequestData,
            timeout: 0, // 取消超时限制
            retries: 2,
          });

          let pageData: any[] = [];
          const pageResponseData = pageResponse.data;

          // 如果指定了 dataPath，使用路径提取数据
          if (config.dataPath) {
            try {
              const extractedData = this.extractDataByPath(pageResponseData, config.dataPath);
              if (Array.isArray(extractedData)) {
                pageData = extractedData;
              } else {
                pageData = [extractedData];
              }
            } catch (error) {
              this.logger.warn(`第 ${currentPage} 页数据路径提取失败: ${error.message}，使用默认逻辑`);
              pageData = this.extractDataWithDefaultLogic(pageResponseData, config.pageSize || 50);
            }
          } else {
            pageData = this.extractDataWithDefaultLogic(pageResponseData, config.pageSize || 50);
          }

          if (pageData.length === 0) {
            this.logger.log(`第 ${currentPage} 页无数据，停止拉取`);
            break;
          }

          try {
            await DynamicTableUtil.insertDataBatch(
              this.dataSource,
              tableName,
              pageData,
              sessionId,
              currentPage
            );

            // 重新查询实际的记录数
            const currentRecordsResult = await this.dataSource.query(
              `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE session_id = ?`,
              [sessionId]
            );
            totalRecords = parseInt(currentRecordsResult[0]?.count || 0);
            pagesProcessed++;
            currentPage++;

            // 如果当前页数据少于页大小，说明是最后一页
            if (pageData.length < config.pageSize) {
              this.logger.log(`第 ${currentPage - 1} 页数据不足，判断为最后一页`);
              break;
            }

            // 添加延迟避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            this.logger.warn(`第 ${currentPage} 页拉取失败，停止拉取: ${error.message}`);
            break;
          }
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`数据拉取完成，共处理 ${pagesProcessed} 页，获得 ${totalRecords} 条记录`);

      return {
        success: true,
        message: `数据拉取完成，共获得 ${totalRecords} 条记录`,
        sessionId,
        totalRecords,
        pagesProcessed,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`数据拉取失败: ${error.message}`, error.stack);
      
      return {
        success: false,
        message: `数据拉取失败: ${error.message}`,
        sessionId,
        totalRecords: 0,
        pagesProcessed: 0,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取拉取状态
   */
  async getFetchStatus(sessionId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    totalPages?: number;
    completedPages?: number;
    totalRecords?: number;
    error?: string;
  }> {
    // 检查会话是否存在
    const session = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    // 检查是否有数据表
    const tableSchema = await this.dataTableSchemaRepository.findOne({
      where: { sessionId },
    });

    if (!tableSchema) {
      return { status: 'pending' };
    }

    try {
      // 查询数据记录数
      const result = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM \`${tableSchema.tableName}\``
      );
      const totalRecords = parseInt(result[0]?.count || 0);

      return {
        status: totalRecords > 0 ? 'completed' : 'pending',
        totalRecords,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * 获取已拉取的数据
   */
  async getFetchedData(
    sessionId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  }> {
    // 检查数据表是否存在
    const tableSchema = await this.dataTableSchemaRepository.findOne({
      where: { sessionId },
    });

    if (!tableSchema) {
      throw new NotFoundException(`会话 ${sessionId} 的数据表不存在`);
    }

    const offset = (page - 1) * pageSize;

    try {
      // 查询总数
      const countResult = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM \`${tableSchema.tableName}\``
      );
      const total = parseInt(countResult[0]?.count || 0);

      // 查询数据
      const dataResult = await this.dataSource.query(
        `SELECT * FROM \`${tableSchema.tableName}\` 
         ORDER BY page_number, data_index 
         LIMIT ? OFFSET ?`,
        [pageSize, offset]
      );

      return {
        data: dataResult,
        pagination: {
          page,
          pageSize,
          total,
        },
      };
    } catch (error) {
      this.logger.error(`查询数据失败: ${error.message}`);
      throw new BadRequestException('查询数据失败');
    }
  }

  /**
   * 获取数据统计信息
   */
  async getDataStats(sessionId: string): Promise<{
    totalRecords: number;
    totalFields: number;
    tableSize: string;
    created: string;
  }> {
    // 检查数据表是否存在
    const tableSchema = await this.dataTableSchemaRepository.findOne({
      where: { sessionId },
    });

    if (!tableSchema) {
      throw new NotFoundException(`会话 ${sessionId} 的数据表不存在`);
    }

    try {
      // 查询总记录数
      const countResult = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM \`${tableSchema.tableName}\``
      );
      const totalRecords = parseInt(countResult[0]?.count || 0);

      // 获取字段数
      const totalFields = tableSchema.fieldDefinitions 
        ? Object.keys(tableSchema.fieldDefinitions).length 
        : 0;

      // 查询表大小（MySQL）
      let tableSize = 'N/A';
      try {
        const sizeResult = await this.dataSource.query(
          `SELECT 
             ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
           FROM information_schema.tables 
           WHERE table_schema = DATABASE() 
           AND table_name = ?`,
          [tableSchema.tableName]
        );
        if (sizeResult[0]?.size_mb) {
          tableSize = `${sizeResult[0].size_mb} MB`;
        }
      } catch (error) {
        this.logger.warn(`无法获取表大小: ${error.message}`);
      }

      return {
        totalRecords,
        totalFields,
        tableSize,
        created: tableSchema.createdAt?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`获取数据统计失败: ${error.message}`);
      throw new BadRequestException('获取数据统计失败');
    }
  }

  /**
   * 智能检测分页字段
   */
  private detectPaginationFields(
    queryParams: Record<string, any>, 
    requestData?: any
  ): {
    hasExistingPagination: boolean;
    pageField: string;
    pageSizeField: string;
    detectedFields: string[];
  } {
    // 常见的分页字段名
    const pageFieldNames = ['page', 'pageNum', 'pageIndex', 'p', 'pageNo', 'current', 'offset'];
    const sizeFieldNames = ['size', 'pageSize', 'limit', '_limit', 'count', 'rows', 'per_page', 'ps'];

    let detectedPageField = 'page';
    let detectedSizeField = 'size';
    let hasExistingPagination = false;
    const detectedFields: string[] = [];

    // 检查查询参数中的分页字段
    for (const field of pageFieldNames) {
      if (queryParams.hasOwnProperty(field)) {
        detectedPageField = field;
        hasExistingPagination = true;
        detectedFields.push(field);
        break;
      }
    }

    for (const field of sizeFieldNames) {
      if (queryParams.hasOwnProperty(field)) {
        detectedSizeField = field;
        hasExistingPagination = true;
        detectedFields.push(field);
        break;
      }
    }

    // 检查请求体中的分页字段
    if (requestData && typeof requestData === 'object') {
      for (const field of pageFieldNames) {
        if (requestData.hasOwnProperty(field)) {
          detectedPageField = field;
          hasExistingPagination = true;
          detectedFields.push(field);
          break;
        }
      }

      for (const field of sizeFieldNames) {
        if (requestData.hasOwnProperty(field)) {
          detectedSizeField = field;
          hasExistingPagination = true;
          detectedFields.push(field);
          break;
        }
      }
    }

    return {
      hasExistingPagination,
      pageField: detectedPageField,
      pageSizeField: detectedSizeField,
      detectedFields,
    };
  }

  /**
   * 检测建议的分页字段
   */
  private detectSuggestedPageFields(
    queryParams: Record<string, any>, 
    requestData?: any
  ): string[] {
    const suggestedFields: string[] = [];
    const pageFieldNames = ['page', 'pageNum', 'pageIndex', 'p', 'pageNo', 'current', 'offset'];

    // 检查查询参数中的分页字段
    for (const field of pageFieldNames) {
      if (queryParams.hasOwnProperty(field)) {
        suggestedFields.push(field);
      }
    }

    // 检查请求体中的分页字段
    if (requestData && typeof requestData === 'object') {
      for (const field of pageFieldNames) {
        if (requestData.hasOwnProperty(field) && !suggestedFields.includes(field)) {
          suggestedFields.push(field);
        }
      }
    }

    return suggestedFields;
  }

  /**
   * 根据路径提取数据
   */
  private extractDataByPath(data: any, path: string): any {
    if (!path || !data) {
      return data;
    }

    try {
      // 处理复杂路径，如 [0].data.rank_list
      const pathParts = path.split('.');
      let current = data;

      for (const part of pathParts) {
        if (part.includes('[') && part.includes(']')) {
          // 处理数组索引，如 [0] 或 items[0]
          const match = part.match(/^([^\[]*)?\[(\d+)\]$/);
          if (match) {
            const [, key, index] = match;
            if (key) {
              current = current[key];
            }
            current = current[parseInt(index)];
          } else {
            current = current[part];
          }
        } else {
          current = current[part];
        }

        if (current === undefined || current === null) {
          throw new Error(`路径 '${path}' 中的 '${part}' 不存在`);
        }
      }

      return current;
    } catch (error) {
      throw new Error(`无法按路径 '${path}' 提取数据: ${error.message}`);
    }
  }

  /**
   * 默认数据提取逻辑
   */
  private extractDataWithDefaultLogic(responseData: any, pageSize: number): any[] {
    // 尝试不同的数据结构
    if (Array.isArray(responseData)) {
      return pageSize > 0 ? responseData.slice(0, pageSize) : responseData;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      return pageSize > 0 ? responseData.data.slice(0, pageSize) : responseData.data;
    } else if (responseData.items && Array.isArray(responseData.items)) {
      return pageSize > 0 ? responseData.items.slice(0, pageSize) : responseData.items;
    } else if (responseData.results && Array.isArray(responseData.results)) {
      return pageSize > 0 ? responseData.results.slice(0, pageSize) : responseData.results;
    } else if (typeof responseData === 'object' && responseData !== null) {
      // 如果返回的是单个对象，包装成数组
      return [responseData];
    } else {
      this.logger.warn('响应数据格式不识别，使用原始数据');
      return [responseData];
    }
  }

  /**
   * 获取curl命令示例
   */
  getCurlExamples(): string[] {
    return this.curlParserService.generateCurlExamples();
  }
}