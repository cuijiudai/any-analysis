import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DataFetchService } from './data-fetch.service';
import { SmokeTestDto, ParseCurlDto, CreateFetchConfigDto, ExecuteFetchDto } from './dto';

@Controller('data-fetch')
export class DataFetchController {
  constructor(private readonly dataFetchService: DataFetchService) {}

  /**
   * 执行冒烟测试
   * 验证API配置，不存储任何数据
   */
  @Post('smoke-test')
  @HttpCode(HttpStatus.OK)
  async executeSmokeTest(@Body() smokeTestDto: SmokeTestDto) {
    const result = await this.dataFetchService.executeSmokeTest(smokeTestDto);
    
    return {
      success: result.success,
      data: result.success ? {
        sampleData: result.data,
        dataStructure: result.dataStructure,
        responseTime: result.responseTime,
        message: result.message,
      } : null,
      error: result.error,
      message: result.success ? '冒烟测试成功' : '冒烟测试失败',
    };
  }

  /**
   * 解析curl命令
   */
  @Post('parse-curl')
  @HttpCode(HttpStatus.OK)
  async parseCurlCommand(@Body() parseCurlDto: ParseCurlDto) {
    const result = await this.dataFetchService.parseCurlCommand(parseCurlDto);
    
    return {
      success: result.success,
      data: result.config,
      error: result.error,
      message: result.success ? 'curl命令解析成功' : 'curl命令解析失败',
    };
  }

  /**
   * 测试API连接
   */
  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testApiConnection(
    @Body() body: { apiUrl: string; headers?: Record<string, string> }
  ) {
    const { apiUrl, headers } = body;
    const result = await this.dataFetchService.testApiConnection(apiUrl, headers);
    
    return {
      success: result.success,
      data: {
        status: result.status,
        responseTime: result.responseTime,
      },
      message: result.message,
    };
  }

  /**
   * 创建拉取配置
   */
  @Post('configure')
  async createFetchConfig(@Body() createFetchConfigDto: CreateFetchConfigDto) {
    const config = await this.dataFetchService.createFetchConfig(createFetchConfigDto);
    
    return {
      success: true,
      data: config,
      message: '拉取配置保存成功',
    };
  }

  /**
   * 获取拉取配置
   */
  @Get('config/:sessionId')
  async getFetchConfig(@Param('sessionId') sessionId: string) {
    const config = await this.dataFetchService.getFetchConfig(sessionId);
    
    return {
      success: true,
      data: config,
    };
  }

  /**
   * 执行正式数据拉取
   */
  @Post('execute')
  async executeFetch(@Body() executeFetchDto: ExecuteFetchDto) {
    const result = await this.dataFetchService.executeFetch(executeFetchDto);
    
    return {
      success: result.success,
      data: {
        sessionId: result.sessionId,
        totalRecords: result.totalRecords,
        pagesProcessed: result.pagesProcessed,
      },
      message: result.message,
    };
  }

  /**
   * 获取拉取状态
   */
  @Get('status/:sessionId')
  async getFetchStatus(@Param('sessionId') sessionId: string) {
    const status = await this.dataFetchService.getFetchStatus(sessionId);
    
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 获取已拉取的数据
   */
  @Get('data/:sessionId')
  async getFetchedData(
    @Param('sessionId') sessionId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const result = await this.dataFetchService.getFetchedData(sessionId, page, pageSize);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取数据统计信息
   */
  @Get('stats/:sessionId')
  async getDataStats(@Param('sessionId') sessionId: string) {
    const stats = await this.dataFetchService.getDataStats(sessionId);
    
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取curl命令示例
   */
  @Get('curl-examples')
  getCurlExamples() {
    const examples = this.dataFetchService.getCurlExamples();
    
    return {
      success: true,
      data: examples,
      message: '获取curl示例成功',
    };
  }
}