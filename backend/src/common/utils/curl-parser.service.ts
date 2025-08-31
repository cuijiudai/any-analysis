import { Injectable, BadRequestException } from '@nestjs/common';

export interface ParsedCurlConfig {
  success: boolean;
  config?: {
    apiUrl: string;
    method: string;
    headers: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: any;
  };
  error?: string;
}

@Injectable()
export class CurlParserService {
  /**
   * 解析curl命令
   */
  parseCurlCommand(curlCommand: string): ParsedCurlConfig {
    try {
      if (!curlCommand || !curlCommand.trim()) {
        throw new Error('curl命令不能为空');
      }

      // 清理命令，移除换行符和多余空格
      const cleanCommand = this.cleanCurlCommand(curlCommand);

      // 提取URL
      const url = this.extractUrl(cleanCommand);
      if (!url) {
        throw new Error('无法解析URL');
      }

      // 提取请求方法
      const method = this.extractMethod(cleanCommand);

      // 提取请求头
      const headers = this.extractHeaders(cleanCommand);

      // 提取查询参数
      const queryParams = this.extractQueryParams(url);

      // 提取请求体
      const body = this.extractBody(cleanCommand);

      // 清理URL（移除查询参数）
      const cleanUrl = this.cleanUrl(url);

      return {
        success: true,
        config: {
          apiUrl: cleanUrl,
          method,
          headers,
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
          body,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `解析失败: ${error.message}`,
      };
    }
  }

  /**
   * 清理curl命令
   */
  private cleanCurlCommand(curlCommand: string): string {
    return curlCommand
      .replace(/\\\s*\n\s*/g, ' ') // 移除反斜杠换行
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();
  }

  /**
   * 提取URL
   */
  private extractUrl(command: string): string | null {
    // 匹配各种URL格式
    const patterns = [
      // curl -X GET "https://example.com"
      /curl\s+(?:-X\s+\w+\s+)?["']([^"']+)["']/,
      // curl -X GET https://example.com
      /curl\s+(?:-X\s+\w+\s+)?([^\s"']+)/,
      // curl "https://example.com"
      /curl\s+["']([^"']+)["']/,
      // curl https://example.com
      /curl\s+([^\s-][^\s]*)/,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && this.isValidUrl(match[1])) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 验证URL是否有效
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 提取请求方法
   */
  private extractMethod(command: string): string {
    const methodMatch = command.match(/-X\s+(\w+)/i);
    return methodMatch ? methodMatch[1].toUpperCase() : 'GET';
  }

  /**
   * 提取请求头
   */
  private extractHeaders(command: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // 匹配 -H "Header: Value" 格式
    const headerPattern = /-H\s+["']([^"']+)["']/g;
    let match;

    while ((match = headerPattern.exec(command)) !== null) {
      const headerLine = match[1];
      const colonIndex = headerLine.indexOf(':');
      
      if (colonIndex > 0) {
        const key = headerLine.substring(0, colonIndex).trim();
        const value = headerLine.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // 匹配 --header "Header: Value" 格式
    const longHeaderPattern = /--header\s+["']([^"']+)["']/g;
    while ((match = longHeaderPattern.exec(command)) !== null) {
      const headerLine = match[1];
      const colonIndex = headerLine.indexOf(':');
      
      if (colonIndex > 0) {
        const key = headerLine.substring(0, colonIndex).trim();
        const value = headerLine.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    return headers;
  }

  /**
   * 提取查询参数
   */
  private extractQueryParams(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const queryParams: Record<string, string> = {};
      
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      return queryParams;
    } catch {
      return {};
    }
  }

  /**
   * 清理URL（移除查询参数）
   */
  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * 提取请求体
   */
  private extractBody(command: string): any {
    // 匹配 -d "data" 格式
    const dataPatterns = [
      /-d\s+["']([^"']+)["']/,
      /--data\s+["']([^"']+)["']/,
      /--data-raw\s+["']([^"']+)["']/,
    ];

    for (const pattern of dataPatterns) {
      const match = command.match(pattern);
      if (match) {
        const data = match[1];
        
        // 尝试解析为JSON
        try {
          return JSON.parse(data);
        } catch {
          // 如果不是JSON，返回原始字符串
          return data;
        }
      }
    }

    // 匹配 --form 格式
    const formPattern = /--form\s+["']([^"']+)["']/g;
    const formData: Record<string, string> = {};
    let match;

    while ((match = formPattern.exec(command)) !== null) {
      const formField = match[1];
      const equalIndex = formField.indexOf('=');
      
      if (equalIndex > 0) {
        const key = formField.substring(0, equalIndex).trim();
        const value = formField.substring(equalIndex + 1).trim();
        formData[key] = value;
      }
    }

    if (Object.keys(formData).length > 0) {
      return formData;
    }

    return null;
  }

  /**
   * 验证解析结果
   */
  validateParsedConfig(config: ParsedCurlConfig['config']): string[] {
    const errors: string[] = [];

    if (!config) {
      errors.push('配置为空');
      return errors;
    }

    // 验证URL
    if (!config.apiUrl) {
      errors.push('URL不能为空');
    } else {
      try {
        new URL(config.apiUrl);
      } catch {
        errors.push('URL格式无效');
      }
    }

    // 验证请求方法
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(config.method)) {
      errors.push(`不支持的请求方法: ${config.method}`);
    }

    // 验证请求头
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        if (!key || typeof key !== 'string') {
          errors.push('请求头名称无效');
        }
        if (value === undefined || value === null) {
          errors.push(`请求头 ${key} 的值无效`);
        }
      });
    }

    return errors;
  }

  /**
   * 生成curl命令示例
   */
  generateCurlExamples(): string[] {
    return [
      'curl -X GET "https://api.example.com/users?page=1&size=20" -H "Authorization: Bearer token123" -H "Content-Type: application/json"',
      'curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -d \'{"name": "John", "email": "john@example.com"}\'',
      'curl -X PUT "https://api.example.com/users/1" -H "Authorization: Bearer token123" -d \'{"name": "Updated Name"}\'',
      'curl -X DELETE "https://api.example.com/users/1" -H "Authorization: Bearer token123"',
    ];
  }

  /**
   * 从配置生成curl命令
   */
  generateCurlCommand(config: {
    apiUrl: string;
    method?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: any;
  }): string {
    const { apiUrl, method = 'GET', headers = {}, queryParams = {}, body } = config;

    let url = apiUrl;

    // 添加查询参数
    if (Object.keys(queryParams).length > 0) {
      const urlObj = new URL(apiUrl);
      Object.entries(queryParams).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
      });
      url = urlObj.toString();
    }

    let curlCommand = `curl -X ${method} "${url}"`;

    // 添加请求头
    Object.entries(headers).forEach(([key, value]) => {
      curlCommand += ` -H "${key}: ${value}"`;
    });

    // 添加请求体
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      curlCommand += ` -d '${bodyStr}'`;
    }

    return curlCommand;
  }
}