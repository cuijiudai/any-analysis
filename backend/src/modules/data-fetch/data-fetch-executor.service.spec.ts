import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataFetchExecutorService } from './data-fetch-executor.service';
import { HttpClientService } from '../../common/http-client/http-client.service';
import { SchemaAnalysisService } from '../../common/utils/schema-analysis.service';
import { DynamicTableService } from '../../common/database-utils/dynamic-table.service';
import { DataSessionService } from '../data-session/data-session.service';
import { FetchConfig } from '../../entities/fetch-config.entity';

describe('DataFetchExecutorService', () => {
  let service: DataFetchExecutorService;
  let mockHttpClientService: jest.Mocked<HttpClientService>;
  let mockSchemaAnalysisService: jest.Mocked<SchemaAnalysisService>;
  let mockDynamicTableService: jest.Mocked<DynamicTableService>;
  let mockDataSessionService: jest.Mocked<DataSessionService>;
  let mockFetchConfigRepository: jest.Mocked<Repository<FetchConfig>>;

  beforeEach(async () => {
    mockHttpClientService = {
      get: jest.fn(),
    } as any;

    mockSchemaAnalysisService = {
      analyzeDataStructure: jest.fn(),
    } as any;

    mockDynamicTableService = {
      createTableFromSchema: jest.fn(),
      insertDataToTable: jest.fn(),
    } as any;

    mockDataSessionService = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    mockFetchConfigRepository = {
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataFetchExecutorService,
        {
          provide: HttpClientService,
          useValue: mockHttpClientService,
        },
        {
          provide: SchemaAnalysisService,
          useValue: mockSchemaAnalysisService,
        },
        {
          provide: DynamicTableService,
          useValue: mockDynamicTableService,
        },
        {
          provide: DataSessionService,
          useValue: mockDataSessionService,
        },
        {
          provide: getRepositoryToken(FetchConfig),
          useValue: mockFetchConfigRepository,
        },
      ],
    }).compile();

    service = module.get<DataFetchExecutorService>(DataFetchExecutorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeFetch', () => {
    const mockSession = {
      id: 'test-session-id',
      name: 'Test Session',
      status: 'unconfigured',
    };

    const mockFetchConfig = {
      id: 'config-id',
      sessionId: 'test-session-id',
      apiUrl: 'https://api.example.com/data',
      headers: { 'Authorization': 'Bearer token' },
      fetchMode: 'pagination' as const,
      startPage: 1,
      endPage: 2,
      pageSize: 10,
    };

    const mockApiData = [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' },
    ];

    const mockSchemaResult = {
      tableName: 'data_test_session_id',
      totalFields: 3,
      fields: [
        { name: 'id', type: 'integer', mysqlType: 'BIGINT', nullable: false, sampleValues: [1, 2] },
        { name: 'name', type: 'string', mysqlType: 'VARCHAR(255)', nullable: false, sampleValues: ['John', 'Jane'] },
        { name: 'email', type: 'email', mysqlType: 'VARCHAR(255)', nullable: false, sampleValues: ['john@example.com'] },
      ],
    };

    beforeEach(() => {
      mockDataSessionService.findById.mockResolvedValue(mockSession as any);
      mockFetchConfigRepository.findOne.mockResolvedValue(mockFetchConfig as any);
      mockHttpClientService.get.mockResolvedValue({ 
        data: mockApiData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any }
      } as any);
      mockSchemaAnalysisService.analyzeDataStructure.mockReturnValue(mockSchemaResult);
      mockDynamicTableService.createTableFromSchema.mockResolvedValue({
        tableName: 'data_test_session_id',
        created: true,
        fieldsCreated: 3,
      });
      mockDynamicTableService.insertDataToTable.mockResolvedValue(2);
    });

    it('should execute fetch successfully with pagination mode', async () => {
      const result = await service.executeFetch('test-session-id');

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(4); // 2 pages * 2 records each
      expect(result.totalPages).toBe(2);
      expect(result.tableName).toBe('data_test_session_id');

      expect(mockDataSessionService.updateStatus).toHaveBeenCalledWith('test-session-id', 'unfetched');
      expect(mockDataSessionService.updateStatus).toHaveBeenCalledWith('test-session-id', 'fetched');
      expect(mockSchemaAnalysisService.analyzeDataStructure).toHaveBeenCalledWith(mockApiData, 'test-session-id');
      expect(mockDynamicTableService.createTableFromSchema).toHaveBeenCalledWith(mockSchemaResult);
    });

    it('should execute fetch successfully with all mode', async () => {
      const allModeFetchConfig = { ...mockFetchConfig, fetchMode: 'all' as const };
      mockFetchConfigRepository.findOne.mockResolvedValue(allModeFetchConfig as any);
      
      // Mock empty response for third page to stop fetching
      mockHttpClientService.get
        .mockResolvedValueOnce({ data: mockApiData, status: 200, statusText: 'OK', headers: {}, config: { headers: {} as any } } as any) // First page for analysis
        .mockResolvedValueOnce({ data: mockApiData, status: 200, statusText: 'OK', headers: {}, config: { headers: {} as any } } as any) // Page 1
        .mockResolvedValueOnce({ data: mockApiData, status: 200, statusText: 'OK', headers: {}, config: { headers: {} as any } } as any) // Page 2
        .mockResolvedValueOnce({ data: [], status: 200, statusText: 'OK', headers: {}, config: { headers: {} as any } } as any) // Page 3 - empty
        .mockResolvedValueOnce({ data: [], status: 200, statusText: 'OK', headers: {}, config: { headers: {} as any } } as any) // Page 4 - empty
        .mockResolvedValueOnce({ data: [], status: 200, statusText: 'OK', headers: {}, config: { headers: {} as any } } as any); // Page 5 - empty (triggers stop)

      const result = await service.executeFetch('test-session-id');

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(4); // 2 pages * 2 records each
      expect(mockHttpClientService.get).toHaveBeenCalledTimes(6); // 1 for analysis + 5 for fetching
    });

    it('should handle session not found error', async () => {
      mockDataSessionService.findById.mockResolvedValue(null);

      const result = await service.executeFetch('nonexistent-session');

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话 nonexistent-session 不存在');
    });

    it('should handle fetch config not found error', async () => {
      mockFetchConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.executeFetch('test-session-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话 test-session-id 的拉取配置不存在');
    });

    it('should handle empty API response error', async () => {
      mockHttpClientService.get.mockResolvedValue({ 
        data: [], 
        status: 200, 
        statusText: 'OK', 
        headers: {}, 
        config: { headers: {} as any } 
      } as any);

      const result = await service.executeFetch('test-session-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API 返回空数据，无法分析结构');
    });

    it('should handle table creation failure', async () => {
      mockDynamicTableService.createTableFromSchema.mockResolvedValue({
        tableName: 'data_test_session_id',
        created: false,
        fieldsCreated: 0,
        error: 'Database error',
      });

      const result = await service.executeFetch('test-session-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('创建数据表失败: Database error');
    });

    it('should handle HTTP request errors', async () => {
      mockHttpClientService.get.mockRejectedValue(new Error('Network error'));

      const result = await service.executeFetch('test-session-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getProgress', () => {
    it('should return progress for existing session', async () => {
      // Start a fetch to create progress
      const mockSession = { id: 'test-session', status: 'unconfigured' };
      const mockConfig = {
        sessionId: 'test-session',
        apiUrl: 'https://api.example.com',
        headers: {},
        fetchMode: 'pagination' as const,
        startPage: 1,
        endPage: 1,
        pageSize: 10,
      };

      mockDataSessionService.findById.mockResolvedValue(mockSession as any);
      mockFetchConfigRepository.findOne.mockResolvedValue(mockConfig as any);
      mockHttpClientService.get.mockRejectedValue(new Error('Stop execution'));

      // This will fail but create progress entry
      await service.executeFetch('test-session');

      const progress = service.getProgress('test-session');
      expect(progress).toBeDefined();
      expect(progress?.sessionId).toBe('test-session');
    });

    it('should return null for non-existent session', () => {
      const progress = service.getProgress('nonexistent-session');
      expect(progress).toBeNull();
    });
  });

  describe('clearProgress', () => {
    it('should clear progress for session', async () => {
      // Create progress first
      const mockSession = { id: 'test-session', status: 'unconfigured' };
      const mockConfig = {
        sessionId: 'test-session',
        apiUrl: 'https://api.example.com',
        headers: {},
        fetchMode: 'pagination' as const,
      };

      mockDataSessionService.findById.mockResolvedValue(mockSession as any);
      mockFetchConfigRepository.findOne.mockResolvedValue(mockConfig as any);
      mockHttpClientService.get.mockRejectedValue(new Error('Stop'));

      await service.executeFetch('test-session');
      expect(service.getProgress('test-session')).toBeDefined();

      service.clearProgress('test-session');
      expect(service.getProgress('test-session')).toBeNull();
    });
  });

  describe('cancelFetch', () => {
    it('should cancel ongoing fetch', async () => {
      const mockSession = { id: 'test-session', status: 'unconfigured' };
      mockDataSessionService.findById.mockResolvedValue(mockSession as any);

      // Simulate ongoing fetch by creating progress
      const mockConfig = {
        sessionId: 'test-session',
        apiUrl: 'https://api.example.com',
        headers: {},
        fetchMode: 'pagination' as const,
      };
      mockFetchConfigRepository.findOne.mockResolvedValue(mockConfig as any);
      mockHttpClientService.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Start fetch (won't complete)
      const fetchPromise = service.executeFetch('test-session');

      // Wait a bit for progress to be created
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cancel the fetch
      await service.cancelFetch('test-session');

      const progress = service.getProgress('test-session');
      expect(progress?.status).toBe('error');
      expect(progress?.error).toBe('用户取消操作');
      expect(mockDataSessionService.updateStatus).toHaveBeenCalledWith('test-session', 'unconfigured');
    });
  });
});