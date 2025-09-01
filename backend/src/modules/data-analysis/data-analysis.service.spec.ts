import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { DataAnalysisService, FilterCondition } from './data-analysis.service';
import { DataSession } from '../../entities/data-session.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { AggregationType } from '../../entities/chart-config.entity';

describe('DataAnalysisService', () => {
  let service: DataAnalysisService;
  let sessionRepository: jest.Mocked<Repository<DataSession>>;
  let schemaRepository: jest.Mocked<Repository<DataTableSchema>>;
  let annotationRepository: jest.Mocked<Repository<FieldAnnotation>>;
  let dataSource: jest.Mocked<DataSource>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<any>>;

  const mockSession = {
    id: 'test-session-id',
    name: 'Test Session',
    status: 'completed',
  };

  const mockSchema = {
    id: 'test-schema-id',
    sessionId: 'test-session-id',
    tableName: 'data_test_session_id',
    fieldDefinitions: {
      id: { type: 'integer' },
      name: { type: 'string' },
      age: { type: 'integer' },
      email: { type: 'string' },
      created_at: { type: 'date' },
    },
  };

  const mockAnnotations = [
    {
      id: 'annotation-1',
      sessionId: 'test-session-id',
      fieldName: 'name',
      label: '姓名',
    },
    {
      id: 'annotation-2',
      sessionId: 'test-session-id',
      fieldName: 'age',
      label: '年龄',
    },
  ];

  const mockData = [
    { id: 1, name: '张三', age: 25, email: 'zhang@example.com', created_at: '2023-01-01' },
    { id: 2, name: '李四', age: 30, email: 'li@example.com', created_at: '2023-01-02' },
    { id: 3, name: '王五', age: 28, email: 'wang@example.com', created_at: '2023-01-03' },
  ];

  beforeEach(async () => {
    // 创建 QueryBuilder mock
    queryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
    } as any;

    // 创建 DataSource mock
    dataSource = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      query: jest.fn(),
    } as any;

    // 创建 Repository mocks
    sessionRepository = {
      findOne: jest.fn(),
    } as any;

    schemaRepository = {
      findOne: jest.fn(),
    } as any;

    annotationRepository = {
      find: jest.fn(),
      count: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataAnalysisService,
        {
          provide: getRepositoryToken(DataSession),
          useValue: sessionRepository,
        },
        {
          provide: getRepositoryToken(DataTableSchema),
          useValue: schemaRepository,
        },
        {
          provide: getRepositoryToken(FieldAnnotation),
          useValue: annotationRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<DataAnalysisService>(DataAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queryData', () => {
    beforeEach(() => {
      sessionRepository.findOne.mockResolvedValue(mockSession as any);
      schemaRepository.findOne.mockResolvedValue(mockSchema as any);
      annotationRepository.find.mockResolvedValue(mockAnnotations as any);
      queryBuilder.getRawMany.mockResolvedValue(mockData);
      dataSource.query.mockResolvedValue([{ count: mockData.length }]);
    });

    it('should query data successfully', async () => {
      const result = await service.queryData('test-session-id', {
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({
        data: mockData,
        total: mockData.length,
        page: 1,
        pageSize: 10,
        fields: expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            label: '姓名',
            type: 'string',
          }),
        ]),
      });

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-session-id' },
      });
      expect(schemaRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 'test-session-id' },
      });
    });

    it('should apply filters correctly', async () => {
      const filters: FilterCondition[] = [
        { field: 'age', operator: 'gt', value: 25 },
        { field: 'name', operator: 'like', value: '张' },
      ];

      await service.queryData('test-session-id', { filters });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('data.age > :filter_0', { filter_0: 25 });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('data.name LIKE :filter_1', { filter_1: '%张%' });
    });

    it('should apply sorting correctly', async () => {
      await service.queryData('test-session-id', {
        sorts: [
          { field: 'age', direction: 'DESC' },
          { field: 'name', direction: 'ASC' },
        ],
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('data.age', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('data.name', 'ASC');
    });

    it('should handle pagination correctly', async () => {
      await service.queryData('test-session-id', {
        page: 2,
        pageSize: 5,
      });

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('should throw error when session not found', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(service.queryData('invalid-session-id')).rejects.toThrow(
        '会话 invalid-session-id 不存在'
      );
    });

    it('should throw error when schema not found', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession as any);
      schemaRepository.findOne.mockResolvedValue(null);

      await expect(service.queryData('test-session-id')).rejects.toThrow(
        '会话 test-session-id 没有数据表结构'
      );
    });
  });

  describe('aggregateData', () => {
    beforeEach(() => {
      sessionRepository.findOne.mockResolvedValue(mockSession as any);
      schemaRepository.findOne.mockResolvedValue(mockSchema as any);
    });

    it('should perform sum aggregation', async () => {
      queryBuilder.getRawMany.mockResolvedValue([{ aggregatedValue: '83' }]);

      const result = await service.aggregateData('test-session-id', 'age', AggregationType.SUM);

      expect(result).toEqual({
        field: 'age',
        aggregation: 'sum',
        value: 83,
      });

      expect(queryBuilder.select).toHaveBeenCalledWith('SUM(data.age)', 'aggregatedValue');
    });

    it('should perform grouped aggregation', async () => {
      const groupedResults = [
        { groupValue: '2023-01-01', aggregatedValue: '25' },
        { groupValue: '2023-01-02', aggregatedValue: '30' },
      ];
      queryBuilder.getRawMany.mockResolvedValue(groupedResults);

      const result = await service.aggregateData('test-session-id', 'age', AggregationType.AVG, 'created_at');

      expect(result).toEqual({
        field: 'age',
        aggregation: 'avg',
        value: 0,
        groupBy: 'created_at',
        groups: [
          { groupValue: '2023-01-01', aggregatedValue: 25 },
          { groupValue: '2023-01-02', aggregatedValue: 30 },
        ],
      });

      expect(queryBuilder.select).toHaveBeenCalledWith('data.created_at', 'groupValue');
      expect(queryBuilder.addSelect).toHaveBeenCalledWith('AVG(data.age)', 'aggregatedValue');
      expect(queryBuilder.groupBy).toHaveBeenCalledWith('data.created_at');
    });

    it('should throw error for invalid field', async () => {
      await expect(
        service.aggregateData('test-session-id', 'invalid_field', AggregationType.SUM)
      ).rejects.toThrow('字段 invalid_field 不存在');
    });
  });

  describe('getFieldStats', () => {
    beforeEach(() => {
      sessionRepository.findOne.mockResolvedValue(mockSession as any);
      schemaRepository.findOne.mockResolvedValue(mockSchema as any);
    });

    it('should get field statistics for string field', async () => {
      dataSource.query
        .mockResolvedValueOnce([{
          total_count: '3',
          non_null_count: '3',
          null_count: '0',
          unique_count: '3',
        }])
        .mockResolvedValueOnce([
          { value: '张三', count: '1' },
          { value: '李四', count: '1' },
          { value: '王五', count: '1' },
        ]);

      const result = await service.getFieldStats('test-session-id', 'name');

      expect(result).toEqual({
        field: 'name',
        type: 'string',
        count: 3,
        nullCount: 0,
        uniqueCount: 3,
        topValues: [
          { value: '张三', count: 1 },
          { value: '李四', count: 1 },
          { value: '王五', count: 1 },
        ],
      });
    });

    it('should get field statistics for numeric field', async () => {
      dataSource.query
        .mockResolvedValueOnce([{
          total_count: '3',
          non_null_count: '3',
          null_count: '0',
          unique_count: '3',
        }])
        .mockResolvedValueOnce([{
          min_value: 25,
          max_value: 30,
          avg_value: '27.67',
          sum_value: '83',
        }])
        .mockResolvedValueOnce([
          { value: 25, count: '1' },
          { value: 28, count: '1' },
          { value: 30, count: '1' },
        ]);

      const result = await service.getFieldStats('test-session-id', 'age');

      expect(result).toEqual({
        field: 'age',
        type: 'integer',
        count: 3,
        nullCount: 0,
        uniqueCount: 3,
        min: 25,
        max: 30,
        avg: 27.67,
        sum: 83,
        topValues: [
          { value: 25, count: 1 },
          { value: 28, count: 1 },
          { value: 30, count: 1 },
        ],
      });
    });
  });

  describe('getDataOverview', () => {
    beforeEach(() => {
      sessionRepository.findOne.mockResolvedValue(mockSession as any);
      schemaRepository.findOne.mockResolvedValue(mockSchema as any);
      annotationRepository.count.mockResolvedValue(2);
    });

    it('should get data overview', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '3' }])
        .mockResolvedValueOnce(mockData);

      const result = await service.getDataOverview('test-session-id');

      expect(result).toEqual({
        totalRecords: 3,
        fieldsCount: 5,
        annotatedFields: 2,
        dataTypes: {
          integer: 2,
          string: 2,
          date: 1,
        },
        sampleData: mockData,
      });
    });
  });
});