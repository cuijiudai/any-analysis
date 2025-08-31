import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DataSessionService } from './data-session.service';
import { DataSession, SessionStatus } from '../../entities/data-session.entity';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { ChartConfig } from '../../entities/chart-config.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { CreateSessionDto } from './dto';

describe('DataSessionService', () => {
  let service: DataSessionService;
  let sessionRepository: Repository<DataSession>;
  let dataSource: DataSource;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSessionService,
        {
          provide: getRepositoryToken(DataSession),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(FetchConfig),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(FieldAnnotation),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(ChartConfig),
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

    service = module.get<DataSessionService>(DataSessionService);
    sessionRepository = module.get<Repository<DataSession>>(
      getRepositoryToken(DataSession),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('应该成功创建会话', async () => {
      const createSessionDto: CreateSessionDto = {
        name: '测试会话',
      };

      const mockSession = {
        id: 'test-id',
        name: '测试会话',
        status: SessionStatus.CONFIGURING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockSession);
      mockRepository.save.mockResolvedValue(mockSession);

      const result = await service.createSession(createSessionDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        name: createSessionDto.name,
        status: SessionStatus.CONFIGURING,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual(mockSession);
    });
  });

  describe('getSessionById', () => {
    it('应该返回会话详情', async () => {
      const sessionId = 'test-id';
      const mockSession = {
        id: sessionId,
        name: '测试会话',
        status: SessionStatus.CONFIGURING,
      };

      mockRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.getSessionById(sessionId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: sessionId },
        relations: ['fetchConfig', 'fieldAnnotations', 'chartConfigs', 'dataTableSchemas'],
      });
      expect(result).toEqual(mockSession);
    });

    it('当会话不存在时应该抛出异常', async () => {
      const sessionId = 'non-existent-id';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getSessionById(sessionId)).rejects.toThrow(
        `会话 ${sessionId} 不存在`,
      );
    });
  });

  describe('getSessionList', () => {
    it('应该返回分页的会话列表', async () => {
      const queryDto = { page: 1, pageSize: 10 };
      const mockSessions = [
        { id: '1', name: '会话1' },
        { id: '2', name: '会话2' },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockSessions, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getSessionList(queryDto);

      expect(result).toEqual({
        sessions: mockSessions,
        total: 2,
        page: 1,
        pageSize: 10,
      });
    });
  });
});