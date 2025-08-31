import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DataFetchService } from './data-fetch.service';
import { HttpClientService } from '../../common/http-client';
import { CurlParserService } from '../../common/utils';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { SmokeTestDto, HttpMethod } from './dto';

describe('DataFetchService', () => {
  let service: DataFetchService;
  let httpClientService: HttpClientService;
  let curlParserService: CurlParserService;

  const mockHttpClientService = {
    get: jest.fn(),
    request: jest.fn(),
    testConnection: jest.fn(),
  };

  const mockCurlParserService = {
    parseCurlCommand: jest.fn(),
    validateParsedConfig: jest.fn(),
    generateCurlExamples: jest.fn(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataFetchService,
        {
          provide: HttpClientService,
          useValue: mockHttpClientService,
        },
        {
          provide: CurlParserService,
          useValue: mockCurlParserService,
        },
        {
          provide: getRepositoryToken(FetchConfig),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(DataSession),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(DataTableSchema),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<DataFetchService>(DataFetchService);
    httpClientService = module.get<HttpClientService>(HttpClientService);
    curlParserService = module.get<CurlParserService>(CurlParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSmokeTest', () => {
    it('应该成功执行冒烟测试', async () => {
      const smokeTestDto: SmokeTestDto = {
        apiUrl: 'https://api.example.com/users',
        headers: { 'Authorization': 'Bearer token' },
        pageSize: 10,
      };

      const mockResponse = {
        data: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClientService.get.mockResolvedValue(mockResponse);

      const result = await service.executeSmokeTest(smokeTestDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(result.dataStructure).toBeDefined();
      expect(result.dataStructure.fields).toHaveLength(3); // id, name, email
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('应该处理API错误', async () => {
      const smokeTestDto: SmokeTestDto = {
        apiUrl: 'https://api.example.com/users',
      };

      const error = new Error('Network Error');
      mockHttpClientService.get.mockRejectedValue(error);

      const result = await service.executeSmokeTest(smokeTestDto);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toEqual([]);
    });

    it('应该处理无效URL', async () => {
      const smokeTestDto: SmokeTestDto = {
        apiUrl: 'invalid-url',
      };

      await expect(service.executeSmokeTest(smokeTestDto)).rejects.toThrow('URL格式无效');
    });

    it('应该处理不同的响应数据格式', async () => {
      const smokeTestDto: SmokeTestDto = {
        apiUrl: 'https://api.example.com/users',
      };

      // 测试嵌套数据格式
      const mockResponse = {
        data: {
          data: [{ id: 1, name: 'John' }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClientService.get.mockResolvedValue(mockResponse);

      const result = await service.executeSmokeTest(smokeTestDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, name: 'John' }]);
    });

    it('应该正确处理URL中的查询参数', async () => {
      const smokeTestDto: SmokeTestDto = {
        apiUrl: 'https://api.example.com/users?filter=active&sort=name',
        method: HttpMethod.GET,
        headers: { 'Authorization': 'Bearer token' },
        pageSize: 5,
      };

      const mockResponse = {
        data: [{ id: 1, name: 'John' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClientService.request.mockResolvedValue(mockResponse);

      await service.executeSmokeTest(smokeTestDto);

      // 验证调用参数
      expect(mockHttpClientService.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token' },
        params: {
          filter: 'active',
          sort: 'name',
          page: 1,
          size: 5,
          limit: 5,
        },
        data: undefined,
        timeout: 15000,
        retries: 1,
      });
    });

    it('应该正确处理POST请求和请求体数据', async () => {
      const smokeTestDto: SmokeTestDto = {
        apiUrl: 'https://api.example.com/search?category=users',
        method: HttpMethod.POST,
        headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
        data: { query: 'active users', filters: { status: 'active' } },
        pageSize: 10,
      };

      const mockResponse = {
        data: [{ id: 1, name: 'John' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClientService.request.mockResolvedValue(mockResponse);

      await service.executeSmokeTest(smokeTestDto);

      // 验证调用参数
      expect(mockHttpClientService.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/search',
        method: 'POST',
        headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
        params: {
          category: 'users',
          page: 1,
          size: 10,
          limit: 10,
        },
        data: {
          query: 'active users',
          filters: { status: 'active' },
          page: 1,
          size: 10,
          limit: 10,
        },
        timeout: 15000,
        retries: 1,
      });
    });
  });

  describe('parseCurlCommand', () => {
    it('应该成功解析curl命令', async () => {
      const parseCurlDto = {
        curlCommand: 'curl -X GET "https://api.example.com/users" -H "Authorization: Bearer token"',
      };

      const mockParsedResult = {
        success: true,
        config: {
          apiUrl: 'https://api.example.com/users',
          method: 'GET',
          headers: { 'Authorization': 'Bearer token' },
        },
      };

      mockCurlParserService.parseCurlCommand.mockReturnValue(mockParsedResult);
      mockCurlParserService.validateParsedConfig.mockReturnValue([]);

      const result = await service.parseCurlCommand(parseCurlDto);

      expect(result.success).toBe(true);
      expect(result.config).toEqual(mockParsedResult.config);
    });

    it('应该处理解析失败', async () => {
      const parseCurlDto = {
        curlCommand: 'invalid curl command',
      };

      const mockParsedResult = {
        success: false,
        error: '解析失败: 无法识别命令格式',
      };

      mockCurlParserService.parseCurlCommand.mockReturnValue(mockParsedResult);

      const result = await service.parseCurlCommand(parseCurlDto);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理配置验证失败', async () => {
      const parseCurlDto = {
        curlCommand: 'curl -X GET "invalid-url"',
      };

      const mockParsedResult = {
        success: true,
        config: {
          apiUrl: 'invalid-url',
          method: 'GET',
          headers: {},
        },
      };

      mockCurlParserService.parseCurlCommand.mockReturnValue(mockParsedResult);
      mockCurlParserService.validateParsedConfig.mockReturnValue(['URL格式无效']);

      const result = await service.parseCurlCommand(parseCurlDto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('配置验证失败');
    });
  });

  describe('testApiConnection', () => {
    it('应该测试API连接', async () => {
      const apiUrl = 'https://api.example.com/health';
      const headers = { 'Authorization': 'Bearer token' };

      const mockResult = {
        success: true,
        status: 200,
        message: '连接成功',
        responseTime: 150,
      };

      mockHttpClientService.testConnection.mockResolvedValue(mockResult);

      const result = await service.testApiConnection(apiUrl, headers);

      expect(mockHttpClientService.testConnection).toHaveBeenCalledWith(apiUrl, headers);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getCurlExamples', () => {
    it('应该获取curl示例', () => {
      const mockExamples = [
        'curl -X GET "https://api.example.com/users"',
        'curl -X POST "https://api.example.com/users" -d \'{"name": "John"}\'',
      ];

      mockCurlParserService.generateCurlExamples.mockReturnValue(mockExamples);

      const result = service.getCurlExamples();

      expect(result).toEqual(mockExamples);
    });
  });
});