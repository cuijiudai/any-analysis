import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { DynamicTableService } from './dynamic-table.service';
import { SchemaAnalysisResult } from '../utils/schema-analysis.service';

describe('DynamicTableService', () => {
  let service: DynamicTableService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    } as any;

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicTableService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<DynamicTableService>(DynamicTableService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTableFromSchema', () => {
    const mockSchemaResult: SchemaAnalysisResult = {
      tableName: 'data_test_session',
      totalFields: 3,
      fields: [
        {
          name: 'id',
          type: 'integer',
          mysqlType: 'BIGINT',
          nullable: false,
          sampleValues: [1, 2, 3],
        },
        {
          name: 'name',
          type: 'string',
          mysqlType: 'VARCHAR(255)',
          nullable: false,
          sampleValues: ['John', 'Jane'],
        },
        {
          name: 'email',
          type: 'email',
          mysqlType: 'VARCHAR(255)',
          nullable: true,
          sampleValues: ['john@example.com'],
        },
      ],
    };

    it('should create table successfully when table does not exist', async () => {
      // Mock table doesn't exist
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 0 }]) // checkTableExists
        .mockResolvedValueOnce(undefined) // CREATE TABLE
        .mockResolvedValueOnce(undefined); // CREATE INDEX

      const result = await service.createTableFromSchema(mockSchemaResult);

      expect(result.created).toBe(true);
      expect(result.tableName).toBe('data_test_session');
      expect(result.fieldsCreated).toBe(3);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should drop and recreate table when table exists', async () => {
      // Mock table exists
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 1 }]) // checkTableExists
        .mockResolvedValueOnce(undefined) // DROP TABLE
        .mockResolvedValueOnce(undefined) // CREATE TABLE
        .mockResolvedValueOnce(undefined); // CREATE INDEX

      const result = await service.createTableFromSchema(mockSchemaResult);

      expect(result.created).toBe(true);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE')
      );
    });

    it('should rollback transaction on error', async () => {
      mockQueryRunner.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.createTableFromSchema(mockSchemaResult);

      expect(result.created).toBe(false);
      expect(result.error).toBe('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should generate correct CREATE TABLE SQL', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 0 }]) // checkTableExists
        .mockResolvedValueOnce(undefined) // CREATE TABLE
        .mockResolvedValueOnce(undefined); // CREATE INDEX

      await service.createTableFromSchema(mockSchemaResult);

      const createTableCall = mockQueryRunner.query.mock.calls.find(call =>
        call[0].includes('CREATE TABLE')
      );

      expect(createTableCall[0]).toContain('CREATE TABLE `data_test_session`');
      expect(createTableCall[0]).toContain('`id` BIGINT NOT NULL');
      expect(createTableCall[0]).toContain('`name` VARCHAR(255) NOT NULL');
      expect(createTableCall[0]).toContain('`email` VARCHAR(255) NULL');
      expect(createTableCall[0]).toContain('AUTO_INCREMENT PRIMARY KEY');
    });
  });

  describe('insertDataToTable', () => {
    const mockData = [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' },
    ];

    const mockTableInfo = {
      tableName: 'data_test_session',
      exists: true,
      fields: [
        { name: 'id', type: 'BIGINT', nullable: false },
        { name: 'name', type: 'VARCHAR', nullable: false },
        { name: 'email', type: 'VARCHAR', nullable: true },
      ],
    };

    it('should insert data successfully', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 1 }]) // checkTableExists
        .mockResolvedValueOnce([
          { name: 'id', type: 'BIGINT', nullable: 'NO' },
          { name: 'name', type: 'VARCHAR', nullable: 'NO' },
          { name: 'email', type: 'VARCHAR', nullable: 'YES' },
        ]) // getTableInfo
        .mockResolvedValueOnce(undefined); // INSERT

      const result = await service.insertDataToTable('data_test_session', mockData);

      expect(result).toBe(2);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error if table does not exist', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ count: 0 }]); // checkTableExists

      await expect(
        service.insertDataToTable('nonexistent_table', mockData)
      ).rejects.toThrow('表 nonexistent_table 不存在');
    });

    it('should return 0 for empty data', async () => {
      const result = await service.insertDataToTable('data_test_session', []);
      expect(result).toBe(0);
    });

    it('should handle nested objects by flattening', async () => {
      const nestedData = [
        {
          id: 1,
          user: {
            name: 'John',
            profile: { age: 30 }
          }
        }
      ];

      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 1 }]) // checkTableExists
        .mockResolvedValueOnce([
          { name: 'id', type: 'BIGINT', nullable: 'NO' },
          { name: 'user_name', type: 'VARCHAR', nullable: 'NO' },
          { name: 'user_profile_age', type: 'INT', nullable: 'YES' },
        ]) // getTableInfo
        .mockResolvedValueOnce(undefined); // INSERT

      const result = await service.insertDataToTable('data_test_session', nestedData);
      expect(result).toBe(1);
    });
  });

  describe('getTableInfo', () => {
    it('should return table info when table exists', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 1 }]) // checkTableExists
        .mockResolvedValueOnce([
          { name: 'id', type: 'BIGINT', nullable: 'NO' },
          { name: 'name', type: 'VARCHAR', nullable: 'YES' },
        ]); // column info

      const result = await service.getTableInfo(mockQueryRunner, 'test_table');

      expect(result.exists).toBe(true);
      expect(result.tableName).toBe('test_table');
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0]).toEqual({
        name: 'id',
        type: 'BIGINT',
        nullable: false,
      });
    });

    it('should return empty info when table does not exist', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ count: 0 }]); // checkTableExists

      const result = await service.getTableInfo(mockQueryRunner, 'nonexistent_table');

      expect(result.exists).toBe(false);
      expect(result.fields).toHaveLength(0);
    });
  });

  describe('dropTable', () => {
    it('should drop table when it exists', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 1 }]) // checkTableExists
        .mockResolvedValueOnce(undefined); // DROP TABLE

      await service.dropTable(mockQueryRunner, 'test_table');

      expect(mockQueryRunner.query).toHaveBeenCalledWith('DROP TABLE `test_table`');
    });

    it('should not drop table when it does not exist', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ count: 0 }]); // checkTableExists

      await service.dropTable(mockQueryRunner, 'nonexistent_table');

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1); // Only checkTableExists
    });
  });

  describe('cleanupSessionTables', () => {
    it('should cleanup session table', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 1 }]) // checkTableExists
        .mockResolvedValueOnce(undefined); // DROP TABLE

      await service.cleanupSessionTables('abc-123-def-456');

      expect(mockQueryRunner.query).toHaveBeenCalledWith('DROP TABLE `data_abc_123_def_456`');
    });
  });

  describe('getTableStats', () => {
    it('should return table statistics', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ count: 100 }]) // row count
        .mockResolvedValueOnce([{ size_mb: 2.5, created: new Date('2023-01-01') }]); // stats

      const result = await service.getTableStats('test_table');

      expect(result.totalRows).toBe(100);
      expect(result.tableSize).toBe('2.5 MB');
      expect(result.created).toEqual(new Date('2023-01-01'));
    });
  });
});