import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Typography,
  Collapse,
  Empty,
  Spin,
  Tooltip,
  Badge,
  Divider,
  message,
} from 'antd';
import {
  FilterOutlined,
  ClearOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { FilterCondition } from './DataTable';
import { FilterComponent, FieldStats, getTypeColor, detectFieldType } from './FilterScheme';
import api from '../../services/api';

const { Text, Title } = Typography;
const { Panel } = Collapse;

export interface FieldInfo {
  name: string;
  label: string;
  type: string;
}

interface EnhancedFilterPanelProps {
  sessionId: string;
  fields: FieldInfo[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onApplyFilters: () => void;
  loading?: boolean;
  style?: React.CSSProperties;
}

export const EnhancedFilterPanel: React.FC<EnhancedFilterPanelProps> = ({
  sessionId,
  fields,
  filters,
  onFiltersChange,
  onApplyFilters,
  loading = false,
  style,
}) => {
  const [fieldStats, setFieldStats] = useState<Record<string, FieldStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // 按检测到的类型分组字段
  const groupedFields = fields.reduce((groups, field) => {
    const detectedType = detectFieldType(field, fieldStats[field.name]);
    if (!groups[detectedType]) {
      groups[detectedType] = [];
    }
    groups[detectedType].push(field);
    return groups;
  }, {} as Record<string, FieldInfo[]>);

  const loadFieldStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await api.post('/data-analysis/field-stats', {
        sessionId,
        fields: fields.map(f => f.name),
      });
      
      if (response.data.success) {
        const stats: Record<string, FieldStats> = {};
        response.data.stats.forEach((stat: FieldStats & { field: string; error?: string }) => {
          if (!stat.error) {
            stats[stat.field] = stat;
          }
        });
        setFieldStats(stats);
      }
    } catch (error) {
      console.error('加载字段统计失败:', error);
      message.error('加载字段统计信息失败');
    } finally {
      setStatsLoading(false);
    }
  }, [sessionId, fields]);

  // 加载字段统计信息
  useEffect(() => {
    if (sessionId && fields.length > 0) {
      loadFieldStats();
    }
  }, [sessionId, fields, loadFieldStats]);

  // 更新活跃筛选字段列表
  useEffect(() => {
    setActiveFilters(filters.map(f => f.field));
  }, [filters]);

  // 处理单个字段筛选条件变化
  const handleFieldFilterChange = (fieldName: string, condition: FilterCondition | null) => {
    const newFilters = filters.filter(f => f.field !== fieldName);
    if (condition) {
      newFilters.push(condition);
    }
    onFiltersChange(newFilters);
  };

  // 清除所有筛选
  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  // 清除单个筛选
  const clearSingleFilter = (fieldName: string) => {
    const newFilters = filters.filter(f => f.field !== fieldName);
    onFiltersChange(newFilters);
  };

  // 获取筛选摘要
  const getFilterSummary = () => {
    if (filters.length === 0) return null;
    
    return filters.map((filter, index) => {
      const field = fields.find(f => f.name === filter.field);
      const displayValue = Array.isArray(filter.value) 
        ? `${filter.value.length} 项`
        : String(filter.value).length > 20 
          ? String(filter.value).substring(0, 20) + '...'
          : String(filter.value);
          
      return (
        <Tag
          key={index}
          closable
          onClose={() => clearSingleFilter(filter.field)}
          color={getTypeColor(field?.type || 'default')}
          style={{ marginBottom: 4 }}
        >
          <Tooltip title={`${field?.label || filter.field}: ${filter.value}`}>
            {field?.label || filter.field}: {displayValue}
          </Tooltip>
        </Tag>
      );
    });
  };

  return (
    <Card
      style={{
        marginBottom: 16,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        ...style,
      }}
    >
      {/* 筛选面板头部 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: expanded ? 16 : 0,
      }}>
        <Space>
          <Badge count={filters.length} showZero={false}>
            <FilterOutlined style={{ fontSize: 16, color: '#1890ff' }} />
          </Badge>
          <Title level={5} style={{ margin: 0 }}>
            数据筛选
          </Title>
          {filters.length > 0 && (
            <Tag color="blue">{filters.length} 个筛选条件</Tag>
          )}
        </Space>
        
        <Space>
          <Tooltip title="刷新字段统计">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadFieldStats}
              loading={statsLoading}
            />
          </Tooltip>
          
          {filters.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={clearAllFilters}
            >
              清除全部
            </Button>
          )}
          
          <Button
            type="primary"
            size="small"
            icon={<SearchOutlined />}
            onClick={onApplyFilters}
            loading={loading}
          >
            应用筛选
          </Button>
          
          <Button
            type="text"
            size="small"
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '收起' : '展开'}
          </Button>
        </Space>
      </div>

      {/* 筛选条件摘要（收起状态下显示） */}
      {!expanded && filters.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Space wrap size={[4, 4]}>
            {getFilterSummary()}
          </Space>
        </div>
      )}

      {/* 筛选面板主体（展开状态下显示） */}
      {expanded && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          
          <Spin spinning={statsLoading}>
            {fields.length === 0 ? (
              <Empty 
                description="暂无字段数据" 
                style={{ padding: '40px 0' }}
              />
            ) : (
              <Collapse 
                ghost 
                defaultActiveKey={Object.keys(groupedFields)}
                expandIconPosition="right"
              >
                {Object.entries(groupedFields).map(([type, typeFields]) => {
                  const activeFieldsInType = typeFields.filter(f => 
                    activeFilters.includes(f.name)
                  ).length;
                  
                  return (
                    <Panel
                      key={type}
                      header={
                        <Space>
                          <Tag color={getTypeColor(type)}>{type}</Tag>
                          <Text type="secondary">
                            {typeFields.length} 个字段
                          </Text>
                          {activeFieldsInType > 0 && (
                            <Badge 
                              count={activeFieldsInType} 
                              size="small"
                              style={{ backgroundColor: '#52c41a' }}
                            />
                          )}
                        </Space>
                      }
                    >
                      <Row gutter={[16, 16]}>
                        {typeFields.map((field) => {
                          const hasFilter = activeFilters.includes(field.name);
                          
                          return (
                            <Col key={field.name} xs={24} sm={12} md={8} lg={6}>
                              <div style={{ 
                                padding: '12px', 
                                border: hasFilter ? '2px solid #1890ff' : '1px solid #f0f0f0',
                                borderRadius: '6px',
                                backgroundColor: hasFilter ? '#f6ffed' : '#fafafa',
                                transition: 'all 0.3s ease',
                              }}>
                                <div style={{ 
                                  marginBottom: 8, 
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <Tooltip title={field.name}>
                                    <span style={{ 
                                      maxWidth: '120px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {field.label}
                                    </span>
                                  </Tooltip>
                                  <Space>
                                    {hasFilter && (
                                      <Badge 
                                        status="processing" 
                                        title="已应用筛选"
                                      />
                                    )}
                                    <Tag color={getTypeColor(detectFieldType(field, fieldStats[field.name]))}>
                                      {detectFieldType(field, fieldStats[field.name])}
                                    </Tag>
                                  </Space>
                                </div>
                                
                                <FilterComponent
                                  field={field}
                                  stats={fieldStats[field.name]}
                                  value={filters.find(f => f.field === field.name)}
                                  onChange={(condition) => handleFieldFilterChange(field.name, condition)}
                                  sessionId={sessionId}
                                />
                                
                                {fieldStats[field.name] && (
                                  <div style={{ 
                                    fontSize: 11, 
                                    color: '#999', 
                                    marginTop: 8,
                                    padding: '4px 0',
                                    borderTop: '1px solid #f0f0f0'
                                  }}>
                                    {fieldStats[field.name].distinctValues && 
                                      `${fieldStats[field.name].distinctValues!.length} 个不同值`}
                                    {fieldStats[field.name].min !== undefined && 
                                      ` | 范围: ${fieldStats[field.name].min} - ${fieldStats[field.name].max}`}
                                    {fieldStats[field.name].nullCount !== undefined &&
                                      ` | 空值: ${fieldStats[field.name].nullCount}`}
                                  </div>
                                )}
                              </div>
                            </Col>
                          );
                        })}
                      </Row>
                    </Panel>
                  );
                })}
              </Collapse>
            )}
          </Spin>
        </>
      )}
    </Card>
  );
};