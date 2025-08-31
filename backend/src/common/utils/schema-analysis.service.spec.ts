import { Test, TestingModule } from '@nestjs/testing';
import { SchemaAnalysisService } from './schema-analysis.service';

describe('SchemaAnalysisService', () => {
  let service: SchemaAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaAnalysisService],
    }).compile();

    service = module.get<SchemaAnalysisService>(SchemaAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeDataStructure', () => {
    it('should analyze simple flat object structure', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', active: true },
        { id: 2, name: 'Jane', email: 'jane@example.com', active: false },
        { id: 3, name: 'Bob', email: 'bob@example.com', active: true },
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      expect(result.totalFields).toBe(4);
      expect(result.tableName).toBe('data_test_session');
      
      const idField = result.fields.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField?.type).toBe('integer');
      expect(idField?.mysqlType).toBe('BIGINT');
      expect(idField?.nullable).toBe(false);

      const nameField = result.fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.type).toBe('string');
      expect(nameField?.mysqlType).toBe('VARCHAR(255)');

      const emailField = result.fields.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.type).toBe('email');
      expect(emailField?.mysqlType).toBe('VARCHAR(255)');

      const activeField = result.fields.find(f => f.name === 'active');
      expect(activeField).toBeDefined();
      expect(activeField?.type).toBe('boolean');
      expect(activeField?.mysqlType).toBe('BOOLEAN');
    });

    it('should handle nested objects by flattening', () => {
      const data = [
        {
          id: 1,
          user: {
            name: 'John',
            profile: {
              age: 30,
              city: 'New York'
            }
          }
        },
        {
          id: 2,
          user: {
            name: 'Jane',
            profile: {
              age: 25,
              city: 'Los Angeles'
            }
          }
        }
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      expect(result.totalFields).toBe(4);
      
      const userNameField = result.fields.find(f => f.name === 'user_name');
      expect(userNameField).toBeDefined();
      expect(userNameField?.type).toBe('string');

      const userProfileAgeField = result.fields.find(f => f.name === 'user_profile_age');
      expect(userProfileAgeField).toBeDefined();
      expect(userProfileAgeField?.type).toBe('integer');

      const userProfileCityField = result.fields.find(f => f.name === 'user_profile_city');
      expect(userProfileCityField).toBeDefined();
      expect(userProfileCityField?.type).toBe('string');
    });

    it('should handle arrays by converting to JSON strings', () => {
      const data = [
        { id: 1, tags: ['javascript', 'react'], scores: [85, 90, 78] },
        { id: 2, tags: ['python', 'django'], scores: [92, 88, 95] },
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      const tagsField = result.fields.find(f => f.name === 'tags');
      expect(tagsField).toBeDefined();
      expect(tagsField?.type).toBe('string');
      expect(tagsField?.sampleValues[0]).toBe('["javascript","react"]');

      const scoresField = result.fields.find(f => f.name === 'scores');
      expect(scoresField).toBeDefined();
      expect(scoresField?.type).toBe('string');
    });

    it('should handle null and undefined values', () => {
      const data = [
        { id: 1, name: 'John', description: null },
        { id: 2, name: 'Jane', description: 'A description' },
        { id: 3, name: 'Bob', description: undefined },
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      const descriptionField = result.fields.find(f => f.name === 'description');
      expect(descriptionField).toBeDefined();
      expect(descriptionField?.nullable).toBe(true);
      expect(descriptionField?.type).toBe('string');
    });

    it('should detect different data types correctly', () => {
      const data = [
        {
          stringField: 'hello',
          integerField: 42,
          floatField: 3.14,
          booleanField: true,
          dateField: '2023-12-01T10:30:00Z',
          emailField: 'test@example.com',
          urlField: 'https://example.com',
        }
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      const stringField = result.fields.find(f => f.name === 'stringField');
      expect(stringField?.type).toBe('string');
      expect(stringField?.mysqlType).toBe('VARCHAR(255)');

      const integerField = result.fields.find(f => f.name === 'integerField');
      expect(integerField?.type).toBe('integer');
      expect(integerField?.mysqlType).toBe('BIGINT');

      const floatField = result.fields.find(f => f.name === 'floatField');
      expect(floatField?.type).toBe('number');
      expect(floatField?.mysqlType).toContain('DECIMAL');

      const booleanField = result.fields.find(f => f.name === 'booleanField');
      expect(booleanField?.type).toBe('boolean');
      expect(booleanField?.mysqlType).toBe('BOOLEAN');

      const dateField = result.fields.find(f => f.name === 'dateField');
      expect(dateField?.type).toBe('date');
      expect(dateField?.mysqlType).toBe('DATETIME');

      const emailField = result.fields.find(f => f.name === 'emailField');
      expect(emailField?.type).toBe('email');

      const urlField = result.fields.find(f => f.name === 'urlField');
      expect(urlField?.type).toBe('url');
    });

    it('should handle mixed types by choosing string', () => {
      const data = [
        { mixedField: 'hello' },
        { mixedField: 42 },
        { mixedField: true },
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      const mixedField = result.fields.find(f => f.name === 'mixedField');
      expect(mixedField?.type).toBe('string');
    });

    it('should determine appropriate VARCHAR length', () => {
      const data = [
        { shortText: 'hi' },
        { shortText: 'hello world' },
        { shortText: 'a'.repeat(100) },
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      const shortTextField = result.fields.find(f => f.name === 'shortText');
      expect(shortTextField?.mysqlType).toBe('VARCHAR(255)');
    });

    it('should use TEXT for long strings', () => {
      const data = [
        { longText: 'a'.repeat(1000) },
      ];

      const result = service.analyzeDataStructure(data, 'test-session');

      const longTextField = result.fields.find(f => f.name === 'longText');
      expect(longTextField?.mysqlType).toBe('TEXT');
    });

    it('should throw error for empty data', () => {
      expect(() => {
        service.analyzeDataStructure([], 'test-session');
      }).toThrow('数据为空，无法分析结构');
    });

    it('should throw error for null data', () => {
      expect(() => {
        service.analyzeDataStructure(null as any, 'test-session');
      }).toThrow('数据为空，无法分析结构');
    });
  });

  describe('table name generation', () => {
    it('should generate valid table name from session ID', () => {
      const data = [{ id: 1 }];
      const result = service.analyzeDataStructure(data, 'abc-123-def-456');
      
      expect(result.tableName).toBe('data_abc_123_def_456');
    });
  });
});