import React, { useState, useEffect, useCallback } from 'react';
import {
  Input,
  Select,
  DatePicker,
  InputNumber,
  Space,
  Button,
  Tag,
  Tooltip,
  message,
} from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import { FilterCondition } from './DataTable';
import { FieldType, FIELD_TYPE_COLORS, isNumericType, isDateType, isTextType } from '../../types/field-types';
import api from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

export interface FieldInfo {
  name: string;
  label: string;
  type: string;
}

export interface FieldStats {
  field: string;
  distinctValues?: any[];
  min?: number;
  max?: number;
  avgLength?: number;
  nullCount?: number;
  totalCount?: number;
  commonValues?: Array<{ value: any; count: number }>;
}

// 字段类型检测工具
export const detectFieldType = (field: FieldInfo, stats?: FieldStats): FieldType => {
  const originalType = field.type.toLowerCase();
  
  // 如果已经是明确的枚举类型，直接返回
  if (Object.values(FieldType).includes(originalType as FieldType)) {
    return originalType as FieldType;
  }
  
  // 兼容旧的类型名称
  const typeMapping: Record<string, FieldType> = {
    'text': FieldType.STRING,
    'varchar': FieldType.STRING,
    'int': FieldType.INTEGER,
    'double': FieldType.DECIMAL,
    'timestamp': FieldType.DATETIME,
    'bool': FieldType.BOOLEAN,
  };
  
  if (typeMapping[originalType]) {
    return typeMapping[originalType];
  }
  
  // 基于统计信息进行智能检测
  if (stats) {
    // 检测是否为枚举类型（唯一值较少且为字符串）
    if (stats.distinctValues && stats.distinctValues.length <= 20 && stats.distinctValues.length > 2) {
      const allStrings = stats.distinctValues.every(v => typeof v === 'string');
      if (allStrings) {
        return FieldType.ENUM;
      }
    }
    
    // 检测是否为布尔类型
    if (stats.distinctValues && stats.distinctValues.length <= 2) {
      const booleanValues = stats.distinctValues.every(v => 
        v === true || v === false || v === 'true' || v === 'false' || 
        v === 1 || v === 0 || v === '1' || v === '0' ||
        v === 'yes' || v === 'no' || v === 'Y' || v === 'N'
      );
      if (booleanValues) {
        return FieldType.BOOLEAN;
      }
    }
    
    // 检测是否为数字类型
    if (stats.min !== undefined && stats.max !== undefined) {
      return FieldType.DECIMAL;
    }
  }
  
  // 基于字段名称进行模糊匹配
  const fieldName = field.name.toLowerCase();
  
  // 日期相关
  if (fieldName.includes('date') || fieldName.includes('time') || fieldName.includes('created') || fieldName.includes('updated')) {
    return FieldType.DATETIME;
  }
  
  // 数字相关
  if (fieldName.includes('id') || fieldName.includes('count') || fieldName.includes('num') || fieldName.includes('age') || fieldName.includes('price')) {
    return FieldType.DECIMAL;
  }
  
  // 布尔相关
  if (fieldName.includes('is_') || fieldName.includes('has_') || fieldName.includes('enabled') || fieldName.includes('active')) {
    return FieldType.BOOLEAN;
  }
  
  // URL相关
  if (fieldName.includes('url') || fieldName.includes('link') || fieldName.includes('href')) {
    return FieldType.URL;
  }
  
  // Email相关
  if (fieldName.includes('email') || fieldName.includes('mail')) {
    return FieldType.EMAIL;
  }
  
  // 默认为字符串类型
  return FieldType.STRING;
};

// 数据类型筛选scheme定义
export interface FilterScheme {
  type: FieldType;
  component: 'input' | 'select' | 'multiSelect' | 'numberRange' | 'dateRange' | 'slider' | 'switch' | 'checkbox' | 'radio';
  operators: FilterCondition['operator'][];
  defaultOperator: FilterCondition['operator'];
  placeholder?: string;
  maxOptions?: number; // 枚举类型最大选项数
}

// 预定义的筛选scheme
export const FILTER_SCHEMES: Record<FieldType, FilterScheme> = {
  // 文本类型
  [FieldType.STRING]: {
    type: FieldType.STRING,
    component: 'input',
    operators: ['eq', 'ne', 'like', 'is_null', 'is_not_null'],
    defaultOperator: 'like',
    placeholder: '输入关键词搜索',
  },
  
  // 数字类型
  [FieldType.INTEGER]: {
    type: FieldType.INTEGER,
    component: 'numberRange',
    operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
    defaultOperator: 'between',
    placeholder: '输入整数',
  },
  [FieldType.DECIMAL]: {
    type: FieldType.DECIMAL,
    component: 'numberRange',
    operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
    defaultOperator: 'between',
    placeholder: '输入小数',
  },
  
  // 日期类型
  [FieldType.DATE]: {
    type: FieldType.DATE,
    component: 'dateRange',
    operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
    defaultOperator: 'between',
    placeholder: '选择日期',
  },
  [FieldType.DATETIME]: {
    type: FieldType.DATETIME,
    component: 'dateRange',
    operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
    defaultOperator: 'between',
    placeholder: '选择日期时间',
  },
  
  // 布尔类型
  [FieldType.BOOLEAN]: {
    type: FieldType.BOOLEAN,
    component: 'select',
    operators: ['eq', 'is_null', 'is_not_null'],
    defaultOperator: 'eq',
    placeholder: '选择值',
  },
  
  // 枚举类型（新增）
  [FieldType.ENUM]: {
    type: FieldType.ENUM,
    component: 'multiSelect',
    operators: ['in', 'eq', 'ne', 'is_null', 'is_not_null'],
    defaultOperator: 'in',
    placeholder: '选择枚举值',
    maxOptions: 100, // 枚举类型可以有更多选项
  },
  
  // JSON类型
  [FieldType.JSON]: {
    type: FieldType.JSON,
    component: 'input',
    operators: ['eq', 'ne', 'like', 'is_null', 'is_not_null'],
    defaultOperator: 'like',
    placeholder: '输入JSON查询',
  },
  
  // URL类型
  [FieldType.URL]: {
    type: FieldType.URL,
    component: 'input',
    operators: ['eq', 'ne', 'like', 'is_null', 'is_not_null'],
    defaultOperator: 'like',
    placeholder: '输入URL',
  },
  
  // Email类型
  [FieldType.EMAIL]: {
    type: FieldType.EMAIL,
    component: 'input',
    operators: ['eq', 'ne', 'like', 'is_null', 'is_not_null'],
    defaultOperator: 'like',
    placeholder: '输入邮箱地址',
  },
};

interface FilterComponentProps {
  field: FieldInfo;
  stats?: FieldStats;
  value?: FilterCondition;
  onChange: (condition: FilterCondition | null) => void;
  sessionId: string;
}

export const FilterComponent: React.FC<FilterComponentProps> = ({
  field,
  stats,
  value,
  onChange,
  sessionId,
}) => {
  const [operator, setOperator] = useState<FilterCondition['operator']>(
    value?.operator || getScheme(field, stats).defaultOperator
  );
  const [filterValue, setFilterValue] = useState<any>(value?.value);
  const [enumValues, setEnumValues] = useState<Array<{ value: any; count: number }>>([]);
  const [enumLoading, setEnumLoading] = useState(false);

  // 获取字段的筛选scheme
  function getScheme(field: FieldInfo, stats?: FieldStats): FilterScheme {
    // 使用智能类型检测
    const detectedType = detectFieldType(field, stats);
    
    // 根据检测到的类型返回对应的scheme
    const scheme = FILTER_SCHEMES[detectedType];
    if (scheme) {
      return scheme;
    }
    
    // 默认返回字符串类型的scheme
    return FILTER_SCHEMES[FieldType.STRING];
  }

  const scheme = getScheme(field, stats);

  const loadEnumValues = useCallback(async () => {
    setEnumLoading(true);
    try {
      const response = await api.post('/data-analysis/field-values', {
        sessionId,
        fieldName: field.name,
        limit: scheme.maxOptions || 50,
      });
      
      if (response.data.success) {
        setEnumValues(response.data.values || []);
      }
    } catch (error) {
      console.error('加载字段值失败:', error);
      // 如果API失败，使用统计数据中的值
      if (stats?.distinctValues) {
        const values = stats.distinctValues.map((v, index) => ({
          value: v,
          count: stats.commonValues?.[index]?.count || 0,
        }));
        setEnumValues(values);
      }
    } finally {
      setEnumLoading(false);
    }
  }, [sessionId, field.name, scheme.maxOptions, stats]);

  // 加载枚举值（从对话数据聚合）
  useEffect(() => {
    if (scheme.component === 'multiSelect' || scheme.component === 'select') {
      loadEnumValues();
    }
  }, [scheme.component, loadEnumValues]);

  // 更新筛选条件
  const updateFilter = (newOperator?: FilterCondition['operator'], newValue?: any) => {
    const finalOperator = newOperator || operator;
    const finalValue = newValue !== undefined ? newValue : filterValue;
    
    if (finalValue === undefined || finalValue === null || finalValue === '' || 
        (Array.isArray(finalValue) && finalValue.length === 0)) {
      onChange(null);
      return;
    }
    
    onChange({
      field: field.name,
      operator: finalOperator,
      value: finalValue,
    });
  };

  // 清除筛选
  const clearFilter = () => {
    setFilterValue(undefined);
    onChange(null);
  };

  // 渲染操作符选择器
  const renderOperatorSelect = () => (
    <Select
      size="small"
      value={operator}
      onChange={(op) => {
        setOperator(op);
        if (op === 'is_null' || op === 'is_not_null') {
          updateFilter(op, true);
        } else {
          updateFilter(op, filterValue);
        }
      }}
      style={{ width: 100 }}
    >
      {scheme.operators.map(op => (
        <Option key={op} value={op}>
          {getOperatorLabel(op)}
        </Option>
      ))}
    </Select>
  );

  // 获取操作符标签
  const getOperatorLabel = (op: FilterCondition['operator']): string => {
    const labels: Record<FilterCondition['operator'], string> = {
      eq: '等于',
      ne: '不等于',
      gt: '大于',
      gte: '大于等于',
      lt: '小于',
      lte: '小于等于',
      like: '包含',
      in: '包含',
      between: '范围',
      is_null: '为空',
      is_not_null: '不为空',
    };
    return labels[op] || op;
  };

  // 渲染筛选值输入组件
  const renderValueInput = () => {
    if (operator === 'is_null' || operator === 'is_not_null') {
      return null;
    }

    switch (scheme.component) {
      case 'input':
        return (
          <Input
            size="small"
            placeholder={scheme.placeholder}
            value={filterValue}
            onChange={(e) => {
              setFilterValue(e.target.value);
              updateFilter(operator, e.target.value);
            }}
            suffix={<SearchOutlined />}
            allowClear
            style={{ width: 200 }}
          />
        );

      case 'select':
        if (detectFieldType(field, stats) === FieldType.BOOLEAN) {
          return (
            <Select
              size="small"
              placeholder={scheme.placeholder}
              value={filterValue}
              onChange={(val) => {
                setFilterValue(val);
                updateFilter(operator, val);
              }}
              allowClear
              style={{ width: 120 }}
            >
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          );
        }
        break;

      case 'multiSelect':
        return (
          <Select
            size="small"
            mode="multiple"
            placeholder={scheme.placeholder}
            value={filterValue}
            onChange={(vals) => {
              setFilterValue(vals);
              updateFilter(operator, vals);
            }}
            loading={enumLoading}
            allowClear
            showSearch
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ minWidth: 200, maxWidth: 300 }}
            maxTagCount={3}
          >
            {enumValues.map((item, index) => (
              <Option key={index} value={item.value}>
                <Space>
                  <span>{item.value || '(空值)'}</span>
                  <Tag>{item.count}</Tag>
                </Space>
              </Option>
            ))}
          </Select>
        );

      case 'numberRange':
        if (operator === 'between') {
          return (
            <Space>
              <InputNumber
                size="small"
                placeholder="最小值"
                value={Array.isArray(filterValue) ? filterValue[0] : undefined}
                onChange={(val) => {
                  const newValue = [val, Array.isArray(filterValue) ? filterValue[1] : stats?.max];
                  setFilterValue(newValue);
                  updateFilter(operator, newValue);
                }}
                min={stats?.min}
                max={stats?.max}
                style={{ width: 100 }}
              />
              <span>-</span>
              <InputNumber
                size="small"
                placeholder="最大值"
                value={Array.isArray(filterValue) ? filterValue[1] : undefined}
                onChange={(val) => {
                  const newValue = [Array.isArray(filterValue) ? filterValue[0] : stats?.min, val];
                  setFilterValue(newValue);
                  updateFilter(operator, newValue);
                }}
                min={stats?.min}
                max={stats?.max}
                style={{ width: 100 }}
              />
            </Space>
          );
        } else {
          return (
            <InputNumber
              size="small"
              placeholder={scheme.placeholder}
              value={filterValue}
              onChange={(val) => {
                setFilterValue(val);
                updateFilter(operator, val);
              }}
              min={stats?.min}
              max={stats?.max}
              style={{ width: 120 }}
            />
          );
        }

      case 'dateRange':
        if (operator === 'between') {
          return (
            <RangePicker
              size="small"
              onChange={(dates, dateStrings) => {
                setFilterValue(dateStrings);
                updateFilter(operator, dateStrings);
              }}
              style={{ width: 240 }}
            />
          );
        } else {
          return (
            <DatePicker
              size="small"
              placeholder={scheme.placeholder}
              onChange={(date, dateString) => {
                setFilterValue(dateString);
                updateFilter(operator, dateString);
              }}
              style={{ width: 140 }}
            />
          );
        }

      default:
        return null;
    }
  };

  return (
    <Space size="small" style={{ display: 'flex', alignItems: 'center' }}>
      {renderOperatorSelect()}
      {renderValueInput()}
      <Button
        type="text"
        size="small"
        icon={<ClearOutlined />}
        onClick={clearFilter}
        title="清除筛选"
      />
    </Space>
  );
};

// 获取字段类型颜色
export const getTypeColor = (type: string): string => {
  // 首先尝试从枚举类型获取颜色
  if (Object.values(FieldType).includes(type as FieldType)) {
    return FIELD_TYPE_COLORS[type as FieldType];
  }
  
  const lowerType = type.toLowerCase();
  
  // 兼容旧的类型名称
  const typeMapping: Record<string, FieldType> = {
    'text': FieldType.STRING,
    'varchar': FieldType.STRING,
    'int': FieldType.INTEGER,
    'double': FieldType.DECIMAL,
    'timestamp': FieldType.DATETIME,
    'bool': FieldType.BOOLEAN,
  };
  
  if (typeMapping[lowerType]) {
    return FIELD_TYPE_COLORS[typeMapping[lowerType]];
  }
  
  // 模糊匹配
  if (lowerType.includes('int') || lowerType.includes('num')) {
    return FIELD_TYPE_COLORS[FieldType.DECIMAL];
  }
  
  if (lowerType.includes('date') || lowerType.includes('time')) {
    return FIELD_TYPE_COLORS[FieldType.DATETIME];
  }
  
  if (lowerType.includes('bool')) {
    return FIELD_TYPE_COLORS[FieldType.BOOLEAN];
  }
  
  // 默认颜色
  return 'default';
};