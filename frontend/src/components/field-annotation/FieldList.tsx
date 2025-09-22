import React from "react";
import {
  Form,
  Input,
  Card,
  Tag,
  Tooltip,
  Space,
  Typography,
  FormInstance,
  Dropdown,
  Button,
} from "antd";
import {
  InfoCircleOutlined,
  BulbOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { FieldInfo, FieldAnnotation } from "../../types";
import {
  FieldType,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_COLORS,
  FIELD_TYPE_ICONS,
} from "../../types/field-types";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface FieldListProps {
  fields: (FieldInfo & { annotation?: FieldAnnotation })[];
  loading: boolean;
  form: FormInstance;
  onFieldTypeChange?: (fieldName: string, newType: string) => void;
}

export const FieldList: React.FC<FieldListProps> = ({
  fields,
  loading,
  form,
  onFieldTypeChange,
}) => {
  // 支持的数据类型选项
  const dataTypeOptions = Object.values(FieldType).map(type => ({
    value: type,
    label: FIELD_TYPE_LABELS[type],
    color: FIELD_TYPE_COLORS[type],
    icon: FIELD_TYPE_ICONS[type],
  }));

  const getFieldTypeColor = (type: string): string => {
    return FIELD_TYPE_COLORS[type as FieldType] || "default";
  };

  const getFieldTypeIcon = (type: string): string => {
    return FIELD_TYPE_ICONS[type as FieldType] || "📄";
  };

  const formatSampleValues = (values: any[]): string => {
    if (!values || values.length === 0) return "无样本数据";

    const displayValues = values.slice(0, 3).map(value => {
      if (value === null || value === undefined) return "null";
      if (typeof value === "string" && value.length > 20) {
        return `${value.substring(0, 20)}...`;
      }
      return String(value);
    });

    const result = displayValues.join(", ");
    if (values.length > 3) {
      return `${result} ... (共${values.length}个样本)`;
    }
    return result;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Text type="secondary">正在加载字段信息...</Text>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Text type="secondary">暂无字段信息</Text>
      </div>
    );
  }

  return (
    <div className="field-list">
      <div style={{ marginBottom: 16 }}>
        <Text strong>共 {fields.length} 个字段需要标注</Text>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {fields.map((field, index) => (
          <div
            key={field.name}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              border: field.annotation
                ? "1px solid #52c41a"
                : "1px solid #d9d9d9",
              borderRadius: "8px",
              backgroundColor: field.annotation ? "#f6ffed" : "#fafafa",
              gap: "16px",
            }}
          >
            {/* 字段名称和类型 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                minWidth: "200px",
              }}
            >
              <Tooltip
                title={
                  <div>
                    <div>
                      <strong>样本数据:</strong>{" "}
                      {formatSampleValues(field.sampleValues)}
                    </div>
                  </div>
                }
                placement="topLeft"
              >
                <Text strong style={{ fontSize: 16, cursor: "help" }}>
                  {field.name}
                </Text>
              </Tooltip>

              <div style={{ marginLeft: 12 }}>
                <Dropdown
                  menu={{
                    items: dataTypeOptions.map(option => ({
                      key: option.value,
                      label: (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '4px 8px',
                          borderRadius: '6px',
                          transition: 'all 0.2s'
                        }}>
                          <span style={{ fontSize: '14px', marginRight: '8px' }}>
                            {option.icon}
                          </span>
                          <span style={{ fontWeight: 500 }}>
                            {option.label}
                          </span>
                        </div>
                      ),
                    })),
                    onClick: ({ key }) => onFieldTypeChange?.(field.name, key),
                  }}
                  trigger={['click']}
                  placement="bottomLeft"
                >
                  <Button 
                    size="small" 
                    style={{ 
                      minWidth: 120,
                      height: 32,
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#40a9ff';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(64,169,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d9d9d9';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', marginRight: '6px' }}>
                        {getFieldTypeIcon(field.annotation?.fieldType || field.type)}
                      </span>
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: 500,
                        color: getFieldTypeColor(field.annotation?.fieldType || field.type) === 'default' ? '#666' : undefined
                      }}>
                        {FIELD_TYPE_LABELS[field.annotation?.fieldType as FieldType] || 
                         FIELD_TYPE_LABELS[field.type as FieldType] || 
                         field.type}
                      </span>
                    </div>
                    <DownOutlined style={{ fontSize: '10px', color: '#999' }} />
                  </Button>
                </Dropdown>
              </div>
            </div>

            {/* 字段标注输入框 */}
            <div style={{ flex: 1 }}>
              <Form.Item
                name={`${field.name}_label`}
                rules={[
                  { required: true, message: "请输入字段标注" },
                  { max: 100, message: "标注长度不能超过100个字符" },
                ]}
                style={{ margin: 0 }}
              >
                <Input
                  placeholder="请输入字段的中文标注"
                  suffix={
                    field.suggestedLabel && (
                      <Tooltip title={`智能建议: ${field.suggestedLabel}`}>
                        <BulbOutlined style={{ color: "#faad14" }} />
                      </Tooltip>
                    )
                  }
                />
              </Form.Item>
            </div>

            {/* 状态标识 */}
            <div style={{ minWidth: "60px", textAlign: "right" }}>
              {field.annotation && (
                <Tag color="success" icon={<InfoCircleOutlined />}>
                  已标注
                </Tag>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
