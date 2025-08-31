import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom, retry, catchError } from 'rxjs';
import { throwError } from 'rxjs';

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: AxiosRequestConfig;
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly defaultTimeout = 30000; // 30秒
  private readonly defaultRetries = 3;
  private readonly defaultRetryDelay = 1000; // 1秒

  constructor(private readonly httpService: HttpService) {}

  /**
   * 发送HTTP请求
   */
  async request<T = any>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const {
      url,
      method = 'GET',
      headers = {},
      params,
      data,
      timeout: requestTimeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
    } = options;

    const config: AxiosRequestConfig = {
      url,
      method,
      headers: {
        'User-Agent': 'DataFetchAnalysis/1.0',
        'Accept': 'application/json',
        ...headers,
      },
      params,
      data,
      timeout: requestTimeout,
      validateStatus: (status) => status < 500, // 只有5xx错误才重试
    };

    this.logger.log(`发送 ${method} 请求到 ${url}`);
    this.logger.debug(`请求配置: ${JSON.stringify(config, null, 2)}`);

    try {
      const response$ = this.httpService.request(config).pipe(
        retry({
          count: retries,
          delay: (error, retryCount) => {
            this.logger.warn(`请求失败，第 ${retryCount} 次重试: ${error.message}`);
            return new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
          },
        }),
        catchError((error) => {
          this.logger.error(`HTTP请求失败: ${error.message}`);
          return throwError(() => error);
        })
      );

      const response: AxiosResponse<T> = await firstValueFrom(response$);

      this.logger.log(`请求成功: ${response.status} ${response.statusText}`);
      this.logger.debug(`响应数据: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        config: response.config,
      };
    } catch (error) {
      this.logger.error(`HTTP请求最终失败: ${error.message}`);
      throw this.handleError(error);
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(
    url: string,
    options?: Omit<HttpRequestOptions, 'url' | 'method'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post<T = any>(
    url: string,
    data?: any,
    options?: Omit<HttpRequestOptions, 'url' | 'method' | 'data'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, url, method: 'POST', data });
  }

  /**
   * PUT请求
   */
  async put<T = any>(
    url: string,
    data?: any,
    options?: Omit<HttpRequestOptions, 'url' | 'method' | 'data'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, url, method: 'PUT', data });
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(
    url: string,
    options?: Omit<HttpRequestOptions, 'url' | 'method'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }

  /**
   * 分页数据拉取
   */
  async fetchPaginatedData<T = any>(
    baseUrl: string,
    options: {
      headers?: Record<string, string>;
      pageParam?: string; // 页码参数名，默认为 'page'
      sizeParam?: string; // 页大小参数名，默认为 'size'
      startPage?: number;
      endPage?: number;
      pageSize?: number;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<{
    allData: T[];
    totalPages: number;
    totalRecords: number;
    pagesProcessed: number;
  }> {
    const {
      headers = {},
      pageParam = 'page',
      sizeParam = 'size',
      startPage = 1,
      endPage,
      pageSize = 20,
      timeout: requestTimeout,
      retries,
    } = options;

    const allData: T[] = [];
    let currentPage = startPage;
    let totalPages = 0;
    let totalRecords = 0;
    let pagesProcessed = 0;

    this.logger.log(`开始分页拉取数据: ${baseUrl}`);
    this.logger.log(`页码范围: ${startPage} - ${endPage || '自动检测'}`);

    while (true) {
      // 检查是否达到结束页
      if (endPage && currentPage > endPage) {
        break;
      }

      try {
        // 解析URL并保留原有查询参数
        const parsedUrl = new URL(baseUrl);
        const params: Record<string, any> = {};
        
        // 保留原URL中的所有查询参数
        parsedUrl.searchParams.forEach((value, key) => {
          params[key] = value;
        });

        // 添加或覆盖分页参数
        params[pageParam] = currentPage;
        params[sizeParam] = pageSize;

        // 构建不带查询参数的基础URL
        const cleanBaseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

        const response = await this.get<any>(cleanBaseUrl, {
          headers,
          params,
          timeout: requestTimeout,
          retries,
        });

        // 处理响应数据
        const responseData = response.data;
        let pageData: T[] = [];

        // 尝试不同的数据结构
        if (Array.isArray(responseData)) {
          pageData = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          pageData = responseData.data;
        } else if (responseData.items && Array.isArray(responseData.items)) {
          pageData = responseData.items;
        } else if (responseData.results && Array.isArray(responseData.results)) {
          pageData = responseData.results;
        } else {
          this.logger.warn(`第 ${currentPage} 页数据格式不识别，尝试直接使用响应数据`);
          pageData = [responseData];
        }

        // 如果当前页没有数据，停止拉取
        if (!pageData || pageData.length === 0) {
          this.logger.log(`第 ${currentPage} 页无数据，停止拉取`);
          break;
        }

        allData.push(...pageData);
        pagesProcessed++;

        // 尝试获取总页数和总记录数
        if (responseData.totalPages) {
          totalPages = responseData.totalPages;
        }
        if (responseData.total) {
          totalRecords = responseData.total;
        }

        this.logger.log(`第 ${currentPage} 页拉取完成，获得 ${pageData.length} 条记录`);

        // 如果没有指定结束页，且当前页数据少于页大小，说明已经是最后一页
        if (!endPage && pageData.length < pageSize) {
          this.logger.log(`第 ${currentPage} 页数据不足 ${pageSize} 条，判断为最后一页`);
          break;
        }

        currentPage++;

        // 添加延迟以避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(`第 ${currentPage} 页拉取失败: ${error.message}`);
        throw error;
      }
    }

    // 如果没有获取到总记录数，使用实际拉取的数据量
    if (!totalRecords) {
      totalRecords = allData.length;
    }

    // 如果没有获取到总页数，计算总页数
    if (!totalPages) {
      totalPages = Math.ceil(totalRecords / pageSize);
    }

    this.logger.log(`分页拉取完成，共处理 ${pagesProcessed} 页，获得 ${allData.length} 条记录`);

    return {
      allData,
      totalPages,
      totalRecords,
      pagesProcessed,
    };
  }

  /**
   * 测试API连接
   */
  async testConnection(
    url: string,
    headers?: Record<string, string>,
    timeout = 10000
  ): Promise<{
    success: boolean;
    status?: number;
    message: string;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.get(url, {
        headers,
        timeout,
        retries: 1, // 测试连接只重试1次
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        status: response.status,
        message: `连接成功 (${response.status} ${response.statusText})`,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        status: error.response?.status,
        message: error.message || '连接失败',
        responseTime,
      };
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: any): Error {
    if (error.response) {
      // 服务器响应了错误状态码
      const { status, statusText, data } = error.response;
      return new Error(`HTTP ${status} ${statusText}: ${JSON.stringify(data)}`);
    } else if (error.request) {
      // 请求已发出但没有收到响应
      return new Error('网络错误：无法连接到服务器');
    } else {
      // 其他错误
      return new Error(`请求配置错误: ${error.message}`);
    }
  }
}