import { IsString, IsNotEmpty, IsObject, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export class SmokeTestDto {
  @IsString()
  @IsNotEmpty()
  apiUrl: string;

  @IsEnum(HttpMethod)
  @IsOptional()
  method?: HttpMethod = HttpMethod.GET;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsObject()
  @IsOptional()
  queryParams?: Record<string, string>;

  @IsOptional()
  data?: any;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;

  @IsString()
  @IsOptional()
  dataPath?: string;
}

export interface SmokeTestResponse {
  success: boolean;
  data: any[];
  message?: string;
  error?: string;
  responseTime: number;
  dataStructure?: {
    fields: Array<{
      name: string;
      type: string;
      sampleValue: any;
    }>;
    totalFields: number;
  };
  suggestedPageFields?: string[]; // 建议的分页字段
}