import { IsString, IsNotEmpty, IsObject, IsOptional, IsEnum, IsInt, Min, Max, IsBoolean } from 'class-validator';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export enum PaginationType {
  PAGE = 'page',     // 页码方式：传递页码和每页数量
  OFFSET = 'offset', // 索引方式：传递开始索引和每页数量
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

  @IsEnum(PaginationType)
  @IsOptional()
  paginationType?: PaginationType = PaginationType.PAGE;

  @IsString()
  @IsOptional()
  pageField?: string; // 用户选择的分页字段名，如 'page', 'pageNum' 等

  @IsInt()
  @IsOptional()
  pageFieldStartValue?: number; // 分页字段的初始值

  @IsString()
  @IsOptional()
  totalField?: string; // 用户选择的总数字段名，如 'total', 'count' 等

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  pageSize?: number = 20;

  @IsInt()
  @Min(1)
  @IsOptional()
  stepSize?: number;

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