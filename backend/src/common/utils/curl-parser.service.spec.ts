import { Test, TestingModule } from '@nestjs/testing';
import { CurlParserService } from './curl-parser.service';

describe('CurlParserService', () => {
  let service: CurlParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurlParserService],
    }).compile();

    service = module.get<CurlParserService>(CurlParserService);
  });

  describe('parseCurlCommand', () => {
    it('应该解析简单的GET请求', () => {
      const curlCommand = 'curl -X GET "https://api.example.com/users"';
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config).toEqual({
        apiUrl: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
        queryParams: undefined,
        body: null,
      });
    });

    it('应该解析带请求头的请求', () => {
      const curlCommand = `curl -X GET "https://api.example.com/users" \\
        -H "Authorization: Bearer token123" \\
        -H "Content-Type: application/json"`;
      
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.headers).toEqual({
        'Authorization': 'Bearer token123',
        'Content-Type': 'application/json',
      });
    });

    it('应该解析带查询参数的请求', () => {
      const curlCommand = 'curl -X GET "https://api.example.com/users?page=1&size=20"';
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.apiUrl).toBe('https://api.example.com/users');
      expect(result.config?.queryParams).toEqual({
        page: '1',
        size: '20',
      });
    });

    it('应该解析POST请求with JSON数据', () => {
      const curlCommand = `curl -X POST "https://api.example.com/users" \\
        -H "Content-Type: application/json" \\
        -d '{"name": "John", "email": "john@example.com"}'`;
      
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.method).toBe('POST');
      expect(result.config?.body).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('应该解析POST请求with表单数据', () => {
      const curlCommand = `curl -X POST "https://api.example.com/users" \\
        --form "name=John" \\
        --form "email=john@example.com"`;
      
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.body).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('应该处理默认GET方法', () => {
      const curlCommand = 'curl "https://api.example.com/users"';
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.method).toBe('GET');
    });

    it('应该处理无效的curl命令', () => {
      const curlCommand = 'invalid command';
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(false);
      expect(result.error).toContain('解析失败');
    });

    it('应该处理空命令', () => {
      const result = service.parseCurlCommand('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('curl命令不能为空');
    });

    it('应该解析--header格式的请求头', () => {
      const curlCommand = `curl --header "Authorization: Bearer token" "https://api.example.com/users"`;
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.headers).toEqual({
        'Authorization': 'Bearer token',
      });
    });

    it('应该解析--data格式的请求体', () => {
      const curlCommand = `curl -X POST --data '{"test": "value"}' "https://api.example.com/users"`;
      const result = service.parseCurlCommand(curlCommand);

      expect(result.success).toBe(true);
      expect(result.config?.body).toEqual({
        test: 'value',
      });
    });
  });

  describe('validateParsedConfig', () => {
    it('应该验证有效配置', () => {
      const config = {
        apiUrl: 'https://api.example.com/users',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token' },
      };

      const errors = service.validateParsedConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('应该检测无效URL', () => {
      const config = {
        apiUrl: 'invalid-url',
        method: 'GET',
        headers: {},
      };

      const errors = service.validateParsedConfig(config);
      expect(errors).toContain('URL格式无效');
    });

    it('应该检测无效请求方法', () => {
      const config = {
        apiUrl: 'https://api.example.com/users',
        method: 'INVALID',
        headers: {},
      };

      const errors = service.validateParsedConfig(config);
      expect(errors).toContain('不支持的请求方法: INVALID');
    });

    it('应该检测空配置', () => {
      const errors = service.validateParsedConfig(undefined);
      expect(errors).toContain('配置为空');
    });
  });

  describe('generateCurlCommand', () => {
    it('应该生成简单的GET请求', () => {
      const config = {
        apiUrl: 'https://api.example.com/users',
        method: 'GET',
      };

      const curlCommand = service.generateCurlCommand(config);
      expect(curlCommand).toBe('curl -X GET "https://api.example.com/users"');
    });

    it('应该生成带请求头的请求', () => {
      const config = {
        apiUrl: 'https://api.example.com/users',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token',
          'Content-Type': 'application/json',
        },
      };

      const curlCommand = service.generateCurlCommand(config);
      expect(curlCommand).toContain('-H "Authorization: Bearer token"');
      expect(curlCommand).toContain('-H "Content-Type: application/json"');
    });

    it('应该生成带查询参数的请求', () => {
      const config = {
        apiUrl: 'https://api.example.com/users',
        queryParams: {
          page: '1',
          size: '20',
        },
      };

      const curlCommand = service.generateCurlCommand(config);
      expect(curlCommand).toContain('page=1');
      expect(curlCommand).toContain('size=20');
    });

    it('应该生成带请求体的POST请求', () => {
      const config = {
        apiUrl: 'https://api.example.com/users',
        method: 'POST',
        body: { name: 'John', email: 'john@example.com' },
      };

      const curlCommand = service.generateCurlCommand(config);
      expect(curlCommand).toContain('-d \'{"name":"John","email":"john@example.com"}\'');
    });
  });

  describe('generateCurlExamples', () => {
    it('应该生成curl命令示例', () => {
      const examples = service.generateCurlExamples();
      
      expect(examples).toBeInstanceOf(Array);
      expect(examples.length).toBeGreaterThan(0);
      examples.forEach(example => {
        expect(example).toContain('curl');
      });
    });
  });
});