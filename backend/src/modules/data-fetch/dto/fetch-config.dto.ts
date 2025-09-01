import { IsString, IsNotEmpty, IsObject, IsOptional, IsEnum, IsInt, Min, Max, IsBoolean } from 'class-validator';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export class CreateFetchConfigDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

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

  @IsBoolean()
  @IsOptional()
  enablePagination?: boolean = false;

  @IsString()
  @IsOptional()
  pageField?: string; // 用户选择的分页字段名，如 'page', 'pageNum' 等

  @IsString()
  @IsOptional()
  totalField?: string; // 用户选择的总数字段名，如 'total', 'count' 等

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  dataPath?: string;
}

export class ExecuteFetchDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}