// 数据会话相关类型
export interface DataSession {
  id: string;
  name: string;
  status: 'configuring' | 'fetching' | 'annotating' | 'analyzing' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// 拉取配置相关类型
export interface FetchConfig {
  id?: string;
  sessionId?: string;
  name?: string; // 配置名称，选填
  apiUrl: string;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
  enablePagination: boolean;
  pageField?: string; // 分页字段名，如 'page', 'pageNum' 等
  totalField?: string; // 总数字段名，如 'total', 'totalCount' 等，用于显示进度
  pageSize?: number;
  dataPath?: string; // 数据路径，如 'data.list' 或 'result.items'
}

// 冒烟测试相关类型
export interface SmokeTestRequest {
  apiUrl: string;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
  pageSize?: number;
  dataPath?: string;
}

export interface SmokeTestResponse {
  success: boolean;
  data: any[];
  message?: string;
  error?: string;
  responseTime?: number;
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

// Curl解析相关类型
export interface ParseCurlRequest {
  curlCommand: string;
}

export interface ParsedConfig {
  apiUrl: string;
  method: string;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
}

export interface ParseCurlResponse {
  success: boolean;
  config?: ParsedConfig;
  error?: string;
}

// 字段标注相关类型
export interface FieldInfo {
  name: string;
  type: string;
  label: string;
  suggestedLabel: string;
  sampleValues: any[];
  annotation?: FieldAnnotation;
}

export interface FieldAnnotation {
  id?: string;
  sessionId?: string;
  fieldName: string;
  fieldType?: string;
  label: string;
  description?: string;
  createdAt?: string;
}

export interface AnnotationSuggestion {
  fieldName: string;
  suggestedLabel: string;
  confidence: number;
  reason: string;
}

export interface AnnotationProgress {
  totalFields: number;
  annotatedFields: number;
  progress: number;
  missingAnnotations: string[];
}

export interface AnnotationValidation {
  isComplete: boolean;
  missingFields: string[];
  errors: string[];
}

// 数据分析相关类型
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like' | 'between' | 'is_null' | 'is_not_null';
  value?: any;
  values?: any[];
}

export interface SortCondition {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryOptions {
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  page?: number;
  pageSize?: number;
  fields?: string[];
}

export interface QueryResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  fields: Array<{
    name: string;
    label: string;
    type: string;
  }>;
}

export interface AggregationResult {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  value: number;
  groupBy?: string;
  groups?: Array<{
    groupValue: any;
    aggregatedValue: number;
  }>;
}

export interface FieldStats {
  field: string;
  type: string;
  count: number;
  nullCount: number;
  uniqueCount: number;
  min?: any;
  max?: any;
  avg?: number;
  sum?: number;
  topValues?: Array<{ value: any; count: number }>;
}

export interface DataOverview {
  totalRecords: number;
  fieldsCount: number;
  annotatedFields: number;
  dataTypes: Record<string, number>;
  sampleData: any[];
}

export interface ChartConfig {
  id?: string;
  sessionId: string;
  name?: string;
  chartType: 'line' | 'bar' | 'pie';
  xAxis: string;
  yAxis: string;
  aggregation?: 'sum' | 'avg' | 'count';
  filters?: FilterCondition[];
}

// 分页相关类型
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}