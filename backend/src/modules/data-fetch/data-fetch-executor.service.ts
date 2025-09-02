import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpClientService } from '../../common/http-client/http-client.service';
import { SchemaAnalysisService, SchemaAnalysisResult } from '../../common/utils/schema-analysis.service';
import { DynamicTableService } from '../../common/database-utils/dynamic-table.service';
import { DataSessionService } from '../data-session/data-session.service';
import { ProgressMonitorService } from './progress-monitor.service';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { DataSession, SessionStatus } from '../../entities/data-session.entity';

export interface FetchProgress {
  sessionId: string;
  status: 'starting' | 'analyzing' | 'creating_table' | 'fetching' | 'completed' | 'error' | 'cancelled';
  currentPage?: number;
  totalPages?: number;
  fetchedRecords: number;
  totalRecords?: number;
  message: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
  schemaAnalysis?: SchemaAnalysisResult;
}

export interface FetchExecutionResult {
  success: boolean;
  sessionId: string;
  totalRecords: number;
  totalPages: number;
  tableName?: string;
  error?: string;
  executionTime: number;
}

@Injectable()
export class DataFetchExecutorService {
  private readonly logger = new Logger(DataFetchExecutorService.name);

  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly schemaAnalysisService: SchemaAnalysisService,
    private readonly dynamicTableService: DynamicTableService,
    private readonly dataSessionService: DataSessionService,
    private readonly progressMonitorService: ProgressMonitorService,
    @InjectRepository(FetchConfig)
    private readonly fetchConfigRepository: Repository<FetchConfig>,
  ) {}

  /**
   * 执行完整的数据拉取流程
   */
  async executeFetch(sessionId: string): Promise<FetchExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 初始化进度跟踪
      this.progressMonitorService.initializeProgress(sessionId);
      
      // 获取会话和配置
      const session = await this.dataSessionService.findById(sessionId);
      if (!session) {
        throw new Error(`会话 ${sessionId} 不存在`);
      }

      const fetchConfig = await this.fetchConfigRepository.findOne({
        where: { sessionId },
      });
      if (!fetchConfig) {
        throw new Error(`会话 ${sessionId} 的拉取配置不存在`);
      }

      // 更新会话状态
      await this.dataSessionService.updateStatus(sessionId, SessionStatus.UNFETCHED);

      // 执行拉取流程
      const result = await this.performFetch(sessionId, fetchConfig);

      // 更新最终状态
      await this.dataSessionService.updateStatus(sessionId, SessionStatus.FETCHED);
      this.progressMonitorService.markCompleted(sessionId, result.totalRecords, result.totalPages);

      return {
        ...result,
        success: true,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error(`数据拉取失败: ${error.message}`, error.stack);
      
      // 更新错误状态
      await this.dataSessionService.updateStatus(sessionId, SessionStatus.UNFETCHED);
      this.progressMonitorService.markError(sessionId, error.message);

      return {
        success: false,
        sessionId,
        totalRecords: 0,
        totalPages: 0,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行具体的拉取逻辑
   */
  private async performFetch(sessionId: string, config: FetchConfig): Promise<Omit<FetchExecutionResult, 'success' | 'executionTime'>> {
    // 第一步：分析数据结构
    this.progressMonitorService.updateProgress(sessionId, {
      status: 'analyzing',
      message: '正在分析数据结构...',
    });

    const firstPageData = await this.fetchSinglePage(config, 1);
    if (!firstPageData || firstPageData.length === 0) {
      throw new Error('API 返回空数据，无法分析结构');
    }

    const schemaAnalysis = this.schemaAnalysisService.analyzeDataStructure(firstPageData, sessionId);
    this.progressMonitorService.updateProgress(sessionId, {
      message: `数据结构分析完成，发现 ${schemaAnalysis.totalFields} 个字段`,
    });

    // 第二步：创建动态表
    this.progressMonitorService.updateProgress(sessionId, {
      status: 'creating_table',
      message: '正在创建数据表...',
    });

    const tableResult = await this.dynamicTableService.createTableFromSchema(schemaAnalysis);
    if (!tableResult.created) {
      throw new Error(`创建数据表失败: ${tableResult.error}`);
    }

    this.progressMonitorService.updateProgress(sessionId, {
      message: `数据表 ${tableResult.tableName} 创建成功`,
    });

    // 第三步：执行数据拉取
    this.progressMonitorService.updateProgress(sessionId, {
      status: 'fetching',
      message: '开始拉取数据...',
    });

    let totalRecords = 0;
    let totalPages = 0;

    if (config.enablePagination) {
      // 分页拉取模式
      const result = await this.fetchPaginatedData(sessionId, config, schemaAnalysis.tableName);
      totalRecords = result.totalRecords;
      totalPages = result.totalPages;
    } else {
      // 全部拉取模式
      const result = await this.fetchAllData(sessionId, config, schemaAnalysis.tableName);
      totalRecords = result.totalRecords;
      totalPages = result.totalPages;
    }

    return {
      sessionId,
      totalRecords,
      totalPages,
      tableName: schemaAnalysis.tableName,
    };
  }

  /**
   * 分页拉取数据
   */
  private async fetchPaginatedData(
    sessionId: string,
    config: FetchConfig,
    tableName: string
  ): Promise<{ totalRecords: number; totalPages: number }> {
    const startPage = 1;
    const endPage = startPage;
    let totalRecords = 0;

    for (let page = startPage; page <= endPage; page++) {
      const pageStartTime = Date.now();
      
      this.progressMonitorService.updateProgress(sessionId, {
        currentPage: page,
        totalPages: endPage - startPage + 1,
        message: `正在拉取第 ${page} 页数据...`,
      });

      const pageData = await this.fetchSinglePage(config, page);
      if (!pageData || pageData.length === 0) {
        this.logger.warn(`第 ${page} 页返回空数据，停止拉取`);
        break;
      }

      const insertedCount = await this.dynamicTableService.insertDataToTable(tableName, pageData);
      totalRecords += insertedCount;

      const pageProcessingTime = Date.now() - pageStartTime;
      this.progressMonitorService.recordPageTiming(sessionId, page, pageProcessingTime);

      this.progressMonitorService.updateProgress(sessionId, {
        fetchedRecords: totalRecords,
        message: `第 ${page} 页完成，已拉取 ${totalRecords} 条记录`,
      });

      // 添加延迟避免过于频繁的请求
      await this.delay(100);
    }

    return {
      totalRecords,
      totalPages: endPage - startPage + 1,
    };
  }

  /**
   * 全部拉取数据
   */
  private async fetchAllData(
    sessionId: string,
    config: FetchConfig,
    tableName: string
  ): Promise<{ totalRecords: number; totalPages: number }> {
    let currentPage = 1;
    let totalRecords = 0;
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3; // 连续3页空数据后停止

    while (consecutiveEmptyPages < maxEmptyPages) {
      const pageStartTime = Date.now();
      
      this.progressMonitorService.updateProgress(sessionId, {
        currentPage,
        message: `正在拉取第 ${currentPage} 页数据...`,
      });

      try {
        const pageData = await this.fetchSinglePage(config, currentPage);
        
        if (!pageData || pageData.length === 0) {
          consecutiveEmptyPages++;
          this.logger.debug(`第 ${currentPage} 页返回空数据 (连续空页: ${consecutiveEmptyPages})`);
          
          if (consecutiveEmptyPages >= maxEmptyPages) {
            this.logger.log(`连续 ${maxEmptyPages} 页空数据，停止拉取`);
            break;
          }
        } else {
          consecutiveEmptyPages = 0; // 重置空页计数
          
          const insertedCount = await this.dynamicTableService.insertDataToTable(tableName, pageData);
          totalRecords += insertedCount;

          const pageProcessingTime = Date.now() - pageStartTime;
          this.progressMonitorService.recordPageTiming(sessionId, currentPage, pageProcessingTime);

          this.progressMonitorService.updateProgress(sessionId, {
            fetchedRecords: totalRecords,
            message: `第 ${currentPage} 页完成，已拉取 ${totalRecords} 条记录`,
          });
        }

        currentPage++;
        
        // 添加延迟避免过于频繁的请求
        await this.delay(100);

      } catch (error) {
        this.logger.error(`拉取第 ${currentPage} 页时出错: ${error.message}`);
        
        // 如果是网络错误，尝试重试
        if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
          this.logger.log(`网络错误，等待后重试第 ${currentPage} 页`);
          await this.delay(2000);
          continue;
        }
        
        // 其他错误直接停止
        throw error;
      }
    }

    return {
      totalRecords,
      totalPages: currentPage - 1,
    };
  }

  /**
   * 拉取单页数据
   */
  private async fetchSinglePage(config: FetchConfig, page: number): Promise<any[]> {
    const parsedUrl = new URL(config.apiUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    
    // 准备请求参数
    let requestParams: Record<string, any> = {};
    let requestData = config.data;

    // 保留原URL中的所有查询参数
    parsedUrl.searchParams.forEach((value, key) => {
      requestParams[key] = value;
    });
    
    // 根据请求方法处理分页参数
    if (config.method === 'GET') {
      // GET 请求：分页参数放在 URL 查询参数中
      requestParams.page = page.toString();
      if (config.pageSize) {
        requestParams.size = config.pageSize.toString();
        requestParams.limit = config.pageSize.toString();
      }
    } else if (config.method === 'POST' && requestData) {
      // POST 请求：分页参数可能在请求体中
      if (typeof requestData === 'object' && requestData !== null) {
        requestData = {
          ...requestData,
          page: page.toString(),
          size: config.pageSize?.toString(),
          limit: config.pageSize?.toString(),
        };
      }
      // 同时也在查询参数中添加
      requestParams.page = page.toString();
      if (config.pageSize) {
        requestParams.size = config.pageSize.toString();
        requestParams.limit = config.pageSize.toString();
      }
    }

    const response = await this.httpClientService.request({
      url: baseUrl,
      method: config.method as any,
      headers: config.headers,
      params: requestParams,
      data: requestData,
    });

    // 尝试从响应中提取数据数组
    return this.extractDataFromResponse(response.data);
  }

  /**
   * 从API响应中提取数据数组
   */
  private extractDataFromResponse(responseData: any): any[] {
    if (Array.isArray(responseData)) {
      return responseData;
    }

    // 常见的数据包装格式
    const possibleDataKeys = ['data', 'items', 'results', 'list', 'records', 'content'];
    
    for (const key of possibleDataKeys) {
      if (responseData[key] && Array.isArray(responseData[key])) {
        return responseData[key];
      }
    }

    // 如果找不到数组，将单个对象包装成数组
    if (typeof responseData === 'object' && responseData !== null) {
      return [responseData];
    }

    return [];
  }

  /**
   * 获取拉取进度
   */
  getProgress(sessionId: string): FetchProgress | null {
    return this.progressMonitorService.getProgress(sessionId);
  }

  /**
   * 清理进度记录
   */
  clearProgress(sessionId: string): void {
    this.progressMonitorService.clearProgress(sessionId);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 取消正在进行的拉取
   */
  async cancelFetch(sessionId: string): Promise<void> {
    const progress = this.progressMonitorService.getProgress(sessionId);
    if (progress && ['starting', 'analyzing', 'creating_table', 'fetching'].includes(progress.status)) {
      this.progressMonitorService.markCancelled(sessionId);

      // 更新会话状态
      await this.dataSessionService.updateStatus(sessionId, SessionStatus.UNFETCHED);
      
      this.logger.log(`用户取消了会话 ${sessionId} 的数据拉取`);
    }
  }
}