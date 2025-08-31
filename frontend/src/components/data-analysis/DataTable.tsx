import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Space, 
  Tooltip, 
  message, 
  Dropdown, 
  Menu,
  Typography,
  Tag,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Popover
} from 'antd';
import { 
  DownloadOutlined, 
  FilterOutlined, 
  ReloadOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import api from '../../services/api';

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

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

export interface SortCondition {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface DataTableProps {
  sessionId: string;
  height?: number;
  showToolbar?: boolean;
  showPagination?: boolean;
  defaultPageSize?: number;
  onRowSelect?: (selectedRows: any[]) => void;
  onDataChange?: (data: any[]) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  sessionId,
  height = 600,
  showToolbar = true,
  showPagination = true,
  defaultPageSize = 20,
  onRowSelect,
  onDataChange
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sorts, setSorts] = useState<SortCondition[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [filterVisible, setFilterVisible] = useState<Record<string, boolean>>({});

  // 加载数据
  const loadData = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const response = await api.post('/data-analysis/query', {
        sessionId,
        page: currentPage,
        pageSize,
        filters: filters.length > 0 ? filters : undefined,
        sorts: sorts.length > 0 ? sorts : undefined,
      });

      if (response.data.success) {
        // 确保 data 始终是数组
        const responseData = response.data.data || [];
        const dataArray = Array.isArray(responseData) ? responseData : [];
        
        setData(dataArray);
        setFields(response.data.fields || []);
        setTotal(response.data.total || 0);
        
        // 通知父组件数据变化
        onDataChange?.(dataArray);
      } else {
        message.error('加载数据失败');
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [sessionId, currentPage, pageSize, filters, sorts, onDataChange]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 处理表格变化（分页、排序、筛选）
  const handleTableChange: TableProps<any>['onChange'] = (
    pagination,
    tableFilters,
    sorter
  ) => {
    // 处理分页
    if (pagination) {
      setCurrentPage(pagination.current || 1);
      setPageSize(pagination.pageSize || defaultPageSize);
    }

    // 处理排序
    const newSorts: SortCondition[] = [];
    if (sorter && !Array.isArray(sorter)) {
      if (sorter.field && sorter.order) {
        newSorts.push({
          field: String(sorter.field),
          direction: sorter.order === 'ascend' ? 'ASC' : 'DESC',
        });
      }
    }
    setSorts(newSorts);
  };

  // 添加筛选条件
  const addFilter = (field: string, operator: FilterCondition['operator'], value: any) => {
    const newFilters = filters.filter(f => f.field !== field);
    if (value !== undefined && value !== null && value !== '') {
      newFilters.push({ field, operator, value });
    }
    setFilters(newFilters);
    setCurrentPage(1); // 重置到第一页
  };

  // 移除筛选条件
  const removeFilter = (field: string) => {
    setFilters(filters.filter(f => f.field !== field));
    setCurrentPage(1);
  };

  // 清除所有筛选
  const clearAllFilters = () => {
    setFilters([]);
    setCurrentPage(1);
  };

  // 导出数据
  const exportData = async () => {
    try {
      setLoading(true);
      const response = await api.post('/data-analysis/export', {
        sessionId,
        filters: filters.length > 0 ? filters : undefined,
        sorts: sorts.length > 0 ? sorts : undefined,
      });

      if (response.data.success) {
        // 创建CSV内容
        const csvContent = generateCSV(response.data.data, response.data.fields);
        
        // 下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `data_export_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        message.success('数据导出成功');
      }
    } catch (error) {
      console.error('导出数据失败:', error);
      message.error('导出数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成CSV内容
  const generateCSV = (data: any[], fields: FieldInfo[]): string => {
    const headers = fields.map(field => field.label).join(',');
    const rows = data.map(row => 
      fields.map(field => {
        const value = row[field.name];
        // 处理包含逗号或引号的值
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    );
    
    return [headers, ...rows].join('\n');
  };

  // 获取字段类型对应的筛选组件
  const getFilterComponent = (field: FieldInfo) => {
    const currentFilter = filters.find(f => f.field === field.name);
    
    switch (field.type) {
      case 'integer':
      case 'number':
      case 'decimal':
      case 'float':
        return (
          <div style={{ padding: 8, minWidth: 200 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="选择操作符"
                style={{ width: '100%' }}
                value={currentFilter?.operator}
                onChange={(operator) => {
                  if (operator === 'is_null' || operator === 'is_not_null') {
                    addFilter(field.name, operator, true);
                  }
                }}
              >
                <Option value="eq">等于</Option>
                <Option value="ne">不等于</Option>
                <Option value="gt">大于</Option>
                <Option value="gte">大于等于</Option>
                <Option value="lt">小于</Option>
                <Option value="lte">小于等于</Option>
                <Option value="is_null">为空</Option>
                <Option value="is_not_null">不为空</Option>
              </Select>
              
              {currentFilter?.operator && !['is_null', 'is_not_null'].includes(currentFilter.operator) && (
                <InputNumber
                  placeholder="输入数值"
                  style={{ width: '100%' }}
                  value={currentFilter?.value}
                  onChange={(value) => {
                    if (currentFilter?.operator) {
                      addFilter(field.name, currentFilter.operator, value);
                    }
                  }}
                />
              )}
              
              <Space>
                <Button 
                  size="small" 
                  onClick={() => removeFilter(field.name)}
                >
                  清除
                </Button>
              </Space>
            </Space>
          </div>
        );
        
      case 'date':
      case 'datetime':
        return (
          <div style={{ padding: 8, minWidth: 250 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="选择操作符"
                style={{ width: '100%' }}
                value={currentFilter?.operator}
                onChange={(operator) => {
                  if (operator === 'is_null' || operator === 'is_not_null') {
                    addFilter(field.name, operator, true);
                  }
                }}
              >
                <Option value="eq">等于</Option>
                <Option value="gt">晚于</Option>
                <Option value="lt">早于</Option>
                <Option value="between">范围</Option>
                <Option value="is_null">为空</Option>
                <Option value="is_not_null">不为空</Option>
              </Select>
              
              {currentFilter?.operator === 'between' ? (
                <RangePicker
                  style={{ width: '100%' }}
                  onChange={(dates, dateStrings) => {
                    if (dates && dates.length === 2) {
                      addFilter(field.name, 'between', dateStrings);
                    }
                  }}
                />
              ) : currentFilter?.operator && !['is_null', 'is_not_null'].includes(currentFilter.operator) && (
                <DatePicker
                  placeholder="选择日期"
                  style={{ width: '100%' }}
                  onChange={(date, dateString) => {
                    if (currentFilter?.operator) {
                      addFilter(field.name, currentFilter.operator, dateString);
                    }
                  }}
                />
              )}
              
              <Button 
                size="small" 
                onClick={() => removeFilter(field.name)}
              >
                清除
              </Button>
            </Space>
          </div>
        );
        
      default: // string 类型
        return (
          <div style={{ padding: 8, minWidth: 200 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="选择操作符"
                style={{ width: '100%' }}
                value={currentFilter?.operator}
                onChange={(operator) => {
                  if (operator === 'is_null' || operator === 'is_not_null') {
                    addFilter(field.name, operator, true);
                  }
                }}
              >
                <Option value="eq">等于</Option>
                <Option value="ne">不等于</Option>
                <Option value="like">包含</Option>
                <Option value="is_null">为空</Option>
                <Option value="is_not_null">不为空</Option>
              </Select>
              
              {currentFilter?.operator && !['is_null', 'is_not_null'].includes(currentFilter.operator) && (
                <Input
                  placeholder="输入文本"
                  value={currentFilter?.value}
                  onChange={(e) => {
                    if (currentFilter?.operator) {
                      addFilter(field.name, currentFilter.operator, e.target.value);
                    }
                  }}
                  onPressEnter={() => setFilterVisible({ ...filterVisible, [field.name]: false })}
                />
              )}
              
              <Button 
                size="small" 
                onClick={() => removeFilter(field.name)}
              >
                清除
              </Button>
            </Space>
          </div>
        );
    }
  };

  // 获取类型颜色
  const getTypeColor = (type: string): string => {
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
  };

  // 构建表格列
  const columns: ColumnsType<any> = (fields || []).map(field => {
    const hasFilter = (filters || []).some(f => f.field === field.name);
    
    return {
      title: (
        <Space>
          <span>{field.label}</span>
          <Tag color={getTypeColor(field.type)}>
            {field.type}
          </Tag>
          <Popover
            content={getFilterComponent(field)}
            title={`筛选 ${field.label}`}
            trigger="click"
            open={filterVisible[field.name]}
            onOpenChange={(visible) => 
              setFilterVisible({ ...filterVisible, [field.name]: visible })
            }
          >
            <Button
              type={hasFilter ? 'primary' : 'text'}
              size="small"
              icon={<FilterOutlined />}
            />
          </Popover>
        </Space>
      ),
      dataIndex: field.name,
      key: field.name,
      sorter: true,
      ellipsis: {
        showTitle: false,
      },
      render: (value: any) => (
        <Tooltip placement="topLeft" title={value}>
          {formatCellValue(value, field.type)}
        </Tooltip>
      ),
    };
  });

  // 格式化单元格值
  const formatCellValue = (value: any, type: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <Text type="secondary">-</Text>;
    }

    switch (type) {
      case 'date':
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'boolean':
        return value ? '是' : '否';
      case 'url':
        return (
          <a href={value} target="_blank" rel="noopener noreferrer">
            {value}
          </a>
        );
      case 'email':
        return <a href={`mailto:${value}`}>{value}</a>;
      default:
        return String(value);
    }
  };

  // 行选择配置
  const rowSelection = onRowSelect ? {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[], newSelectedRows: any[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
      setSelectedRows(newSelectedRows);
      onRowSelect(newSelectedRows);
    },
  } : undefined;

  return (
    <Card>
      {showToolbar && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              数据表格
            </Title>
            {filters.length > 0 && (
              <Tag color="blue">
                {filters.length} 个筛选条件
              </Tag>
            )}
            {selectedRowKeys.length > 0 && (
              <Tag color="green">
                已选择 {selectedRowKeys.length} 行
              </Tag>
            )}
          </Space>
          
          <Space>
            {filters.length > 0 && (
              <Button onClick={clearAllFilters}>
                清除筛选
              </Button>
            )}
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={exportData}
              loading={loading}
            >
              导出CSV
            </Button>
          </Space>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={Array.isArray(data) ? data : []}
        rowKey={(record, index) => record?.id || index}
        loading={loading}
        rowSelection={rowSelection}
        onChange={handleTableChange}
        pagination={showPagination ? {
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
        } : false}
        scroll={{ 
          y: height - (showToolbar ? 120 : 60),
          x: (fields || []).length * 150 
        }}
        size="small"
      />
    </Card>
  );
};