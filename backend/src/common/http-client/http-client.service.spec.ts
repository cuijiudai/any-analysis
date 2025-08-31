import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { HttpClientService } from './http-client.service';

describe('HttpClientService', () => {
  let service: HttpClientService;
  let httpService: HttpService;

  const mockHttpService = {
    request: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpClientService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<HttpClientService>(HttpClientService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('request', () => {
    it('应该成功发送HTTP请求', async () => {
      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {
          headers: {} as any,
        },
      } as AxiosResponse;

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const result = await service.request({
        url: 'https://api.example.com/test',
        method: 'GET',
      });

      expect(result).toEqual({
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {},
      });
    });

    it('应该处理HTTP错误', async () => {
      const error = new Error('Network Error');
      mockHttpService.request.mockReturnValue(throwError(() => error));

      await expect(
        service.request({
          url: 'https://api.example.com/test',
          retries: 0, // 不重试以加快测试
        })
      ).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('应该发送GET请求', async () => {
      const mockResponse: AxiosResponse = {
        data: { id: 1, name: 'test' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const result = await service.get('https://api.example.com/users/1');

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/1',
          method: 'GET',
        })
      );
      expect(result.data).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('post', () => {
    it('应该发送POST请求', async () => {
      const mockResponse: AxiosResponse = {
        data: { id: 2, name: 'created' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const postData = { name: 'new user' };
      const result = await service.post('https://api.example.com/users', postData);

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users',
          method: 'POST',
          data: postData,
        })
      );
      expect(result.data).toEqual({ id: 2, name: 'created' });
    });
  });

  describe('testConnection', () => {
    it('应该测试连接成功', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const result = await service.testConnection('https://api.example.com/health');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toContain('连接成功');
      expect(typeof result.responseTime).toBe('number');
    });

    it('应该测试连接失败', async () => {
      const error = new Error('Connection refused');
      mockHttpService.request.mockReturnValue(throwError(() => error));

      const result = await service.testConnection('https://api.example.com/health');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
      expect(typeof result.responseTime).toBe('number');
    });
  });
});