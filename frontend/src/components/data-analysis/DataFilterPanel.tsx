import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Input,
  Select,
  DatePicker,
  InputNumber,
} from "antd";
import {
  FilterOutlined,
  ClearOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { FilterCondition } from "./DataTable";
import { FieldInfo } from "../../types";
import {
  FieldType,
  FIELD_TYPE_COLORS,
  FIELD_TYPE_LABELS,
  isNumericType,
  isDateType,
} from "../../types/field-types";
import api from "../../services/api";

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface FieldStats {
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

interface DataFilterPanelProps {
  sessionId: string;
  fields: FieldInfo[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onApplyFilters: () => void;
  loading?: boolean;
  style?: React.CSSProperties;
}

export const DataFilterPanel: React.FC<DataFilterPanelProps> = ({
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
  const [enumValues, setEnumValues] = useState<
    Record<string, Array<{ value: any; count: number; label: string }>>
  >({});
  const [enumLoading, setEnumLoading] = useState<Record<string, boolean>>({});

  // 智能类型检测
  const detectFieldType = (field: FieldInfo, stats?: FieldStats): FieldType => {
    // 优先使用标注中的字段类型
    if (
      field.annotation?.fieldType &&
      Object.values(FieldType).includes(field.annotation.fieldType as FieldType)
    ) {
      return field.annotation.fieldType as FieldType;
    }

    const originalType = field.type.toLowerCase();

    // 如果已经是明确的枚举类型，直接返回
    if (Object.values(FieldType).includes(originalType as FieldType)) {
      return originalType as FieldType;
    }

    // 兼容旧的类型名称
    const typeMapping: Record<string, FieldType> = {
      "text": FieldType.STRING,
      "varchar": FieldType.STRING,
      "int": FieldType.INTEGER,
      "double": FieldType.DECIMAL,
      "timestamp": FieldType.DATETIME,
      "bool": FieldType.BOOLEAN,
    };

    if (typeMapping[originalType]) {
      return typeMapping[originalType];
    }

    // 基于统计信息进行智能检测
    if (stats) {
      // 检测是否为枚举类型（唯一值较少且为字符串）
      if (stats.uniqueCount <= 20 && stats.uniqueCount > 2) {
        return FieldType.ENUM;
      }

      // 检测是否为布尔类型
      if (stats.uniqueCount <= 2) {
        return FieldType.BOOLEAN;
      }

      // 检测是否为数字类型
      if (stats.min !== undefined && stats.max !== undefined) {
        return FieldType.DECIMAL;
      }
    }

    // 基于字段名称进行模糊匹配
    const fieldName = field.name.toLowerCase();

    // 日期相关
    if (
      fieldName.includes("date") ||
      fieldName.includes("time") ||
      fieldName.includes("created") ||
      fieldName.includes("updated")
    ) {
      return FieldType.DATETIME;
    }

    // 数字相关
    if (
      fieldName.includes("id") ||
      fieldName.includes("count") ||
      fieldName.includes("num") ||
      fieldName.includes("age") ||
      fieldName.includes("price")
    ) {
      return FieldType.DECIMAL;
    }

    // 布尔相关
    if (
      fieldName.includes("is_") ||
      fieldName.includes("has_") ||
      fieldName.includes("enabled") ||
      fieldName.includes("active")
    ) {
      return FieldType.BOOLEAN;
    }

    // URL相关
    if (
      fieldName.includes("url") ||
      fieldName.includes("link") ||
      fieldName.includes("href")
    ) {
      return FieldType.URL;
    }

    // Email相关
    if (fieldName.includes("email") || fieldName.includes("mail")) {
      return FieldType.EMAIL;
    }

    // 默认为字符串类型
    return FieldType.STRING;
  };

  // 按检测到的类型分组字段
  const groupedFields = useMemo(() => {
    return fields.reduce((groups, field) => {
      const detectedType = detectFieldType(field, fieldStats[field.name]);
      if (!groups[detectedType]) {
        groups[detectedType] = [];
      }
      groups[detectedType].push(field);
      return groups;
    }, {} as Record<FieldType, FieldInfo[]>);
  }, [fields, fieldStats]);

  // 加载字段统计信息
  const loadFieldStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await api.post("/data-analysis/field-stats", {
        sessionId,
        fields: fields.map(f => f.name),
      });

      if (response.data.success) {
        const stats: Record<string, FieldStats> = {};
        response.data.stats.forEach(
          (stat: FieldStats & { field: string; error?: string }) => {
            if (!stat.error) {
              stats[stat.field] = stat;
            }
          }
        );
        setFieldStats(stats);
      }
    } catch (error) {
      console.error("加载字段统计失败:", error);
      message.error("加载字段统计信息失败");
    } finally {
      setStatsLoading(false);
    }
  }, [sessionId, fields]);

  // 加载枚举值
  const loadEnumValues = useCallback(
    async (fieldName: string) => {
      setEnumLoading(prev => ({ ...prev, [fieldName]: true }));
      try {
        const response = await api.get(
          `/data-analysis/enum-values/${sessionId}/${fieldName}`
        );
        if (response.data.success) {
          setEnumValues(prev => ({
            ...prev,
            [fieldName]: response.data.values || [],
          }));
        }
      } catch (error) {
        console.error("加载枚举值失败:", error);
        // 如果API失败，使用统计数据中的值
        const stats = fieldStats[fieldName];
        if (stats?.topValues) {
          const values = stats.topValues.map(v => ({
            value: v.value,
            count: v.count,
            label: String(v.value),
          }));
          setEnumValues(prev => ({ ...prev, [fieldName]: values }));
        }
      } finally {
        setEnumLoading(prev => ({ ...prev, [fieldName]: false }));
      }
    },
    [sessionId, fieldStats]
  );

  // 加载字段统计信息
  useEffect(() => {
    if (sessionId && fields.length > 0) {
      loadFieldStats();
    }
  }, [sessionId, fields, loadFieldStats]);

  // 处理单个字段筛选条件变化
  const handleFieldFilterChange = (
    fieldName: string,
    condition: FilterCondition | null
  ) => {
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
        ? String(filter.value).substring(0, 20) + "..."
        : String(filter.value);

      return (
        <Tag
          key={index}
          closable
          onClose={() => clearSingleFilter(filter.field)}
          color={
            FIELD_TYPE_COLORS[detectFieldType(field!, fieldStats[filter.field])]
          }
          style={{ marginBottom: 4 }}
        >
          <Tooltip title={`${field?.label || filter.field}: ${filter.value}`}>
            {field?.label || filter.field}: {displayValue}
          </Tooltip>
        </Tag>
      );
    });
  };

  // 渲染字段筛选组件
  const renderFieldFilter = (field: FieldInfo) => {
    const fieldType = detectFieldType(field, fieldStats[field.name]);
    const currentFilter = filters.find(f => f.field === field.name);
    const stats = fieldStats[field.name];

    // 数值类型
    if (isNumericType(fieldType)) {
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="选择操作符"
            style={{ width: "100%" }}
            value={currentFilter?.operator}
            onChange={operator => {
              if (operator === "is_null" || operator === "is_not_null") {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: true,
                });
              } else {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: undefined,
                });
              }
            }}
          >
            <Option value="eq">等于</Option>
            <Option value="ne">不等于</Option>
            <Option value="gt">大于</Option>
            <Option value="gte">大于等于</Option>
            <Option value="lt">小于</Option>
            <Option value="lte">小于等于</Option>
            <Option value="between">范围</Option>
            <Option value="is_null">为空</Option>
            <Option value="is_not_null">不为空</Option>
          </Select>

          {currentFilter?.operator &&
            !["is_null", "is_not_null"].includes(currentFilter.operator) &&
            (currentFilter.operator === "between" ? (
              <Space>
                <InputNumber
                  placeholder="最小值"
                  value={
                    Array.isArray(currentFilter.value)
                      ? currentFilter.value[0]
                      : undefined
                  }
                  onChange={val => {
                    const newValue = [
                      val,
                      Array.isArray(currentFilter.value)
                        ? currentFilter.value[1]
                        : stats?.max,
                    ];
                    handleFieldFilterChange(field.name, {
                      ...currentFilter,
                      value: newValue,
                    });
                  }}
                  min={stats?.min}
                  max={stats?.max}
                />
                <InputNumber
                  placeholder="最大值"
                  value={
                    Array.isArray(currentFilter.value)
                      ? currentFilter.value[1]
                      : undefined
                  }
                  onChange={val => {
                    const newValue = [
                      Array.isArray(currentFilter.value)
                        ? currentFilter.value[0]
                        : stats?.min,
                      val,
                    ];
                    handleFieldFilterChange(field.name, {
                      ...currentFilter,
                      value: newValue,
                    });
                  }}
                  min={stats?.min}
                  max={stats?.max}
                />
              </Space>
            ) : (
              <InputNumber
                placeholder="输入数值"
                style={{ width: "100%" }}
                value={currentFilter.value}
                onChange={value => {
                  handleFieldFilterChange(field.name, {
                    ...currentFilter,
                    value,
                  });
                }}
                min={stats?.min}
                max={stats?.max}
              />
            ))}
        </Space>
      );
    }

    // 日期类型
    if (isDateType(fieldType)) {
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="选择操作符"
            style={{ width: "100%" }}
            value={currentFilter?.operator}
            onChange={operator => {
              if (operator === "is_null" || operator === "is_not_null") {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: true,
                });
              } else {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: undefined,
                });
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

          {currentFilter?.operator &&
            !["is_null", "is_not_null"].includes(currentFilter.operator) &&
            (currentFilter.operator === "between" ? (
              <RangePicker
                style={{ width: "100%" }}
                onChange={(dates, dateStrings) => {
                  if (dates && dates.length === 2) {
                    handleFieldFilterChange(field.name, {
                      ...currentFilter,
                      value: dateStrings,
                    });
                  }
                }}
              />
            ) : (
              <DatePicker
                placeholder="选择日期"
                style={{ width: "100%" }}
                onChange={(date, dateString) => {
                  handleFieldFilterChange(field.name, {
                    ...currentFilter,
                    value: dateString,
                  });
                }}
              />
            ))}
        </Space>
      );
    }

    // 布尔类型
    if (fieldType === FieldType.BOOLEAN) {
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="选择操作符"
            style={{ width: "100%" }}
            value={currentFilter?.operator}
            onChange={operator => {
              if (operator === "is_null" || operator === "is_not_null") {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: true,
                });
              } else {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: undefined,
                });
              }
            }}
          >
            <Option value="eq">等于</Option>
            <Option value="is_null">为空</Option>
            <Option value="is_not_null">不为空</Option>
          </Select>

          {currentFilter?.operator &&
            !["is_null", "is_not_null"].includes(currentFilter.operator) && (
              <Select
                placeholder="选择值"
                style={{ width: "100%" }}
                value={currentFilter.value}
                onChange={value => {
                  handleFieldFilterChange(field.name, {
                    ...currentFilter,
                    value,
                  });
                }}
              >
                <Option value={true}>是</Option>
                <Option value={false}>否</Option>
              </Select>
            )}
        </Space>
      );
    }

    // 枚举类型
    if (fieldType === FieldType.ENUM) {
      const fieldEnumValues = enumValues[field.name] || [];
      const fieldEnumLoading = enumLoading[field.name] || false;

      // 如果还没有加载过枚举值，则加载
      if (!enumValues[field.name] && !fieldEnumLoading) {
        loadEnumValues(field.name);
      }

      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="选择操作符"
            style={{ width: "100%" }}
            value={currentFilter?.operator}
            onChange={operator => {
              if (operator === "is_null" || operator === "is_not_null") {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: true,
                });
              } else {
                handleFieldFilterChange(field.name, {
                  field: field.name,
                  operator,
                  value: undefined,
                });
              }
            }}
          >
            <Option value="in">包含</Option>
            <Option value="eq">等于</Option>
            <Option value="ne">不等于</Option>
            <Option value="is_null">为空</Option>
            <Option value="is_not_null">不为空</Option>
          </Select>

          {currentFilter?.operator &&
            !["is_null", "is_not_null"].includes(currentFilter.operator) && (
              <Select
                mode={currentFilter.operator === "in" ? "multiple" : undefined}
                placeholder="选择枚举值"
                style={{ width: "100%" }}
                value={currentFilter.value}
                onChange={value => {
                  handleFieldFilterChange(field.name, {
                    ...currentFilter,
                    value,
                  });
                }}
                loading={fieldEnumLoading}
                showSearch
                filterOption={(input, option) =>
                  String(option?.children || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                maxTagCount={3}
              >
                {fieldEnumValues.map((item, index) => (
                  <Option key={index} value={item.value}>
                    <Space>
                      <span>{item.label}</span>
                      <Tag>{item.count}</Tag>
                    </Space>
                  </Option>
                ))}
              </Select>
            )}
        </Space>
      );
    }

    // 默认为字符串类型
    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        <Select
          placeholder="选择操作符"
          style={{ width: "100%" }}
          value={currentFilter?.operator}
          onChange={operator => {
            if (operator === "is_null" || operator === "is_not_null") {
              handleFieldFilterChange(field.name, {
                field: field.name,
                operator,
                value: true,
              });
            } else {
              handleFieldFilterChange(field.name, {
                field: field.name,
                operator,
                value: undefined,
              });
            }
          }}
        >
          <Option value="eq">等于</Option>
          <Option value="ne">不等于</Option>
          <Option value="like">包含</Option>
          <Option value="is_null">为空</Option>
          <Option value="is_not_null">不为空</Option>
        </Select>

        {currentFilter?.operator &&
          !["is_null", "is_not_null"].includes(currentFilter.operator) && (
            <Input
              placeholder="输入文本"
              value={currentFilter.value}
              onChange={e => {
                handleFieldFilterChange(field.name, {
                  ...currentFilter,
                  value: e.target.value,
                });
              }}
            />
          )}
      </Space>
    );
  };

  return (
    <Card
      style={{
        marginBottom: 16,
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        ...style,
      }}
    >
      {/* 筛选面板头部 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: expanded ? 16 : 0,
        }}
      >
        <Space>
          <Badge count={filters.length} showZero={false}>
            <FilterOutlined style={{ fontSize: 16, color: "#1890ff" }} />
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

          {/* <Button
            type="primary"
            size="small"
            icon={<SearchOutlined />}
            onClick={onApplyFilters}
            loading={loading}
          >
            应用筛选
          </Button> */}

          <Button
            type="text"
            size="small"
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "收起" : "展开"}
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
          <Divider style={{ margin: "16px 0" }} />

          <Spin spinning={statsLoading}>
            {fields.length === 0 ? (
              <Empty description="暂无字段数据" style={{ padding: "40px 0" }} />
            ) : (
              <Collapse
                ghost
                defaultActiveKey={Object.keys(groupedFields)}
                expandIconPosition="right"
              >
                {Object.entries(groupedFields).map(([type, typeFields]) => {
                  const activeFieldsInType = typeFields.filter(f =>
                    filters.some(filter => filter.field === f.name)
                  ).length;

                  return (
                    <Panel
                      key={type}
                      header={
                        <Space>
                          <Tag color={FIELD_TYPE_COLORS[type as FieldType]}>
                            {FIELD_TYPE_LABELS[type as FieldType]}
                          </Tag>
                          <Text type="secondary">
                            {typeFields.length} 个字段
                          </Text>
                          {activeFieldsInType > 0 && (
                            <Badge
                              count={activeFieldsInType}
                              size="small"
                              style={{ backgroundColor: "#52c41a" }}
                            />
                          )}
                        </Space>
                      }
                    >
                      <Row gutter={[16, 16]}>
                        {typeFields.map(field => {
                          const hasFilter = filters.some(
                            f => f.field === field.name
                          );

                          return (
                            <Col key={field.name} xs={24} sm={12} md={8} lg={6}>
                              <div
                                style={{
                                  padding: "12px",
                                  border: hasFilter
                                    ? "2px solid #1890ff"
                                    : "1px solid #f0f0f0",
                                  borderRadius: "6px",
                                  backgroundColor: hasFilter
                                    ? "#f6ffed"
                                    : "#fafafa",
                                  transition: "all 0.3s ease",
                                }}
                              >
                                <div
                                  style={{
                                    marginBottom: 8,
                                    fontWeight: 500,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <Tooltip title={field.name}>
                                    <span
                                      style={{
                                        maxWidth: "120px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {field.label}
                                    </span>
                                  </Tooltip>
                                  <Space>
                                    {hasFilter && (
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<ClearOutlined />}
                                        onClick={() => clearSingleFilter(field.name)}
                                        title="清除筛选"
                                        style={{ padding: 0, minWidth: 'auto' }}
                                      />
                                    )}
                                    <Tag
                                      color={
                                        FIELD_TYPE_COLORS[
                                          detectFieldType(
                                            field,
                                            fieldStats[field.name]
                                          )
                                        ]
                                      }
                                    >
                                      {
                                        FIELD_TYPE_LABELS[
                                          detectFieldType(
                                            field,
                                            fieldStats[field.name]
                                          )
                                        ]
                                      }
                                    </Tag>
                                  </Space>
                                </div>

                                {renderFieldFilter(field)}

                                {fieldStats[field.name] && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#999",
                                      marginTop: 8,
                                      padding: "4px 0",
                                      borderTop: "1px solid #f0f0f0",
                                    }}
                                  >
                                    {fieldStats[field.name].uniqueCount &&
                                      `${
                                        fieldStats[field.name].uniqueCount
                                      } 个不同值`}
                                    {fieldStats[field.name].min !== undefined &&
                                      ` | 范围: ${
                                        fieldStats[field.name].min
                                      } - ${fieldStats[field.name].max}`}
                                    {fieldStats[field.name].nullCount !==
                                      undefined &&
                                      ` | 空值: ${
                                        fieldStats[field.name].nullCount
                                      }`}
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
