import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  Input, 
  InputNumber, 
  DatePicker, 
  Button, 
  Space, 
  Divider,
  Tag,
  Collapse,
  Typography,
  message,
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  FilterOutlined,
  ClearOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { Text } = Typography;

export interface FieldInfo {
  name: string;
  label: string;
  type: string;
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like' | 'between' | 'is_null' | 'is_not_null';
  value?: any;
  values?: any[];
}

export interface FilterPanelProps {
  sessionId: string;
  fields: FieldInfo[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onApplyFilters: () => void;
}

interface FilterOption {
  label: string;
  value: any;
  count: number;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  sessionId,
  fields,
  filters,
  onFiltersChange,
  onApplyFilters
}) => {
  const [form] = Form.useForm();
  const [fieldOptions, setFieldOptions] = useState<Record<string, FilterOption[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  // 操作符选项
  const getOperatorOptions = (fieldType: string) => {
    const commonOptions = [
      { label: '等于', value: 'eq' },
      { label: '不等于', value: 'ne' },
      { label: '为空', value: 'is_null' },
      { label: '不为空', value: 'is_not_null' },
    ];

    switch (fieldType) {
      case 'integer':
      case 'number':
      case 'decimal':
      case 'float':
        return [
          ...commonOptions,
          { label: '大于', value: 'gt' },
          { label: '大于等于', value: 'gte' },
          { label: '小于', value: 'lt' },
          { label: '小于等于', value: 'lte' },
          { label: '范围', value: 'between' },
          { label: '在列表中', value: 'in' },
        ];
      case 'date':
      case 'datetime':
        return [
          ...commonOptions,
          { label: '晚于', value: 'gt' },
          { label: '早于', value: 'lt' },
          { label: '范围', value: 'between' },
        ];
      case 'string':
      default:
        return [
          ...commonOptions,
          { label: '包含', value: 'like' },
          { label: '在列表中', value: 'in' },
        ];
    }
  };

  // 加载字段选项
  const loadFieldOptions = async (fieldName: string) => {
    if (fieldOptions[fieldName] || loadingOptions[fieldName]) {
      return;
    }

    setLoadingOptions(prev => ({ ...prev, [fieldName]: true }));
    
    try {
      const response = await api.get(`/data-analysis/filter-options/${sessionId}/${fieldName}?limit=100`);
      
      if (response.data.success) {
        setFieldOptions(prev => ({
          ...prev,
          [fieldName]: response.data.options
        }));
      }
    } catch (error) {
      console.error('加载字段选项失败:', error);
    } finally {
      setLoadingOptions(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  // 添加筛选条件
  const addFilter = () => {
    const newFilters = [...filters, { field: '', operator: 'eq' as const }];
    onFiltersChange(newFilters);
  };

  // 删除筛选条件
  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onFiltersChange(newFilters);
  };

  // 更新筛选条件
  const updateFilter = (index: number, updates: Partial<FilterCondition>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onFiltersChange(newFilters);
  };

  // 清除所有筛选
  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  // 获取字段信息
  const getFieldInfo = (fieldName: string): FieldInfo | undefined => {
    return fields.find(f => f.name === fieldName);
  };

  // 渲染值输入组件
  const renderValueInput = (filter: FilterCondition, index: number) => {
    const fieldInfo = getFieldInfo(filter.field);
    if (!fieldInfo) return null;

    const { operator } = filter;
    
    // 空值操作符不需要输入值
    if (operator === 'is_null' || operator === 'is_not_null') {
      return null;
    }

    // 范围操作符
    if (operator === 'between') {
      if (fieldInfo.type === 'date' || fieldInfo.type === 'datetime') {
        return (
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={(dates, dateStrings) => {
              updateFilter(index, { values: dateStrings });
            }}
          />
        );
      } else {
        return (
          <Space>
            <InputNumber
              placeholder="最小值"
              onChange={(value) => {
                const values = filter.values || [null, null];
                values[0] = value;
                updateFilter(index, { values });
              }}
            />
            <Text>到</Text>
            <InputNumber
              placeholder="最大值"
              onChange={(value) => {
                const values = filter.values || [null, null];
                values[1] = value;
                updateFilter(index, { values });
              }}
            />
          </Space>
        );
      }
    }

    // 列表操作符
    if (operator === 'in') {
      return (
        <Select
          mode="multiple"
          placeholder="选择值"
          style={{ minWidth: 200 }}
          loading={loadingOptions[filter.field]}
          onFocus={() => loadFieldOptions(filter.field)}
          onChange={(values) => {
            updateFilter(index, { values });
          }}
        >
          {(fieldOptions[filter.field] || []).map(option => (
            <Option key={option.value} value={option.value}>
              <Space>
                <span>{option.label}</span>
                <Text type="secondary">({option.count})</Text>
              </Space>
            </Option>
          ))}
        </Select>
      );
    }

    // 单值输入
    switch (fieldInfo.type) {
      case 'integer':
      case 'number':
      case 'decimal':
      case 'float':
        return (
          <InputNumber
            placeholder="输入数值"
            value={filter.value}
            onChange={(value) => updateFilter(index, { value })}
          />
        );
      case 'date':
      case 'datetime':
        return (
          <DatePicker
            placeholder="选择日期"
            onChange={(date, dateString) => {
              updateFilter(index, { value: dateString });
            }}
          />
        );
      default:
        return (
          <Input
            placeholder="输入文本"
            value={filter.value}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
          />
        );
    }
  };

  // 获取筛选条件摘要
  const getFilterSummary = (filter: FilterCondition): string => {
    const fieldInfo = getFieldInfo(filter.field);
    if (!fieldInfo) return '';

    const operatorLabel = getOperatorOptions(fieldInfo.type)
      .find(op => op.value === filter.operator)?.label || filter.operator;

    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
      return `${fieldInfo.label} ${operatorLabel}`;
    }

    if (filter.operator === 'between' && filter.values) {
      return `${fieldInfo.label} ${operatorLabel} ${filter.values[0]} - ${filter.values[1]}`;
    }

    if (filter.operator === 'in' && filter.values) {
      return `${fieldInfo.label} ${operatorLabel} [${filter.values.slice(0, 3).join(', ')}${filter.values.length > 3 ? '...' : ''}]`;
    }

    return `${fieldInfo.label} ${operatorLabel} ${filter.value}`;
  };

  return (
    <Card 
      title={
        <Space>
          <FilterOutlined />
          <span>数据筛选</span>
          {filters.length > 0 && (
            <Tag color="blue">{filters.length} 个条件</Tag>
          )}
        </Space>
      }
      size="small"
      extra={
        <Space>
          <Button 
            type="primary" 
            size="small" 
            icon={<PlusOutlined />}
            onClick={addFilter}
          >
            添加条件
          </Button>
          {filters.length > 0 && (
            <Button 
              size="small" 
              icon={<ClearOutlined />}
              onClick={clearAllFilters}
            >
              清除全部
            </Button>
          )}
        </Space>
      }
    >
      {filters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
          <FilterOutlined style={{ fontSize: 24, marginBottom: 8 }} />
          <div>暂无筛选条件</div>
          <div style={{ fontSize: 12 }}>点击"添加条件"开始筛选数据</div>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {filters.map((filter, index) => (
            <Card key={index} size="small" style={{ backgroundColor: '#fafafa' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  {/* 字段选择 */}
                  <Select
                    placeholder="选择字段"
                    style={{ minWidth: 120 }}
                    value={filter.field || undefined}
                    onChange={(field) => {
                      const fieldInfo = getFieldInfo(field);
                      updateFilter(index, { 
                        field, 
                        operator: 'eq',
                        value: undefined,
                        values: undefined
                      });
                    }}
                  >
                    {fields.map(field => (
                      <Option key={field.name} value={field.name}>
                        <Space>
                          <span>{field.label}</span>
                          <Tag color={getTypeColor(field.type)}>
                            {field.type}
                          </Tag>
                        </Space>
                      </Option>
                    ))}
                  </Select>

                  {/* 操作符选择 */}
                  {filter.field && (
                    <Select
                      placeholder="选择操作符"
                      style={{ minWidth: 100 }}
                      value={filter.operator}
                      onChange={(operator) => {
                        updateFilter(index, { 
                          operator,
                          value: undefined,
                          values: undefined
                        });
                      }}
                    >
                      {getOperatorOptions(getFieldInfo(filter.field)?.type || 'string').map(op => (
                        <Option key={op.value} value={op.value}>
                          {op.label}
                        </Option>
                      ))}
                    </Select>
                  )}

                  {/* 值输入 */}
                  {filter.field && filter.operator && renderValueInput(filter, index)}

                  {/* 删除按钮 */}
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeFilter(index)}
                  />
                </Space>

                {/* 筛选条件摘要 */}
                {filter.field && (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    <InfoCircleOutlined style={{ marginRight: 4 }} />
                    {getFilterSummary(filter)}
                  </div>
                )}
              </Space>
            </Card>
          ))}

          <Divider />

          {/* 应用筛选按钮 */}
          <div style={{ textAlign: 'center' }}>
            <Button 
              type="primary" 
              icon={<FilterOutlined />}
              onClick={onApplyFilters}
            >
              应用筛选条件
            </Button>
          </div>
        </Space>
      )}
    </Card>
  );

  // 获取类型颜色
  function getTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      string: 'blue',
      integer: 'green',
      number: 'orange',
      decimal: 'orange',
      float: 'orange',
      boolean: 'purple',
      date: 'cyan',
      datetime: 'cyan',
      email: 'magenta',
      url: 'geekblue',
    };
    return colorMap[type] || 'default';
  }
};