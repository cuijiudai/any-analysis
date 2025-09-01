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
  Select,
} from "antd";
import {
  InfoCircleOutlined,
  BulbOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { FieldInfo, FieldAnnotation } from "../../types";
import { FieldType, FIELD_TYPE_LABELS, FIELD_TYPE_COLORS, FIELD_TYPE_ICONS } from "../../types/field-types";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

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

    const displayValues = values.slice(0, 3).map((value) => {
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

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {fields.map((field, index) => (
          <Card
            key={field.name}
            size="small"
            className="field-card"
            style={{
              border: field.annotation
                ? "1px solid #52c41a"
                : "1px solid #d9d9d9",
              backgroundColor: field.annotation ? "#f6ffed" : "#fafafa",
            }}
          >
            <div className="field-header" style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  {/* <span style={{ fontSize: 16, marginRight: 8 }}>
                    {getFieldTypeIcon(field.type)}
                  </span> */}
                  <Text strong style={{ fontSize: 16 }}>
                    {field.name}
                  </Text>
                  <div
                    style={{
                      marginLeft: 8,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Form.Item
                      name={`${field.name}_type`}
                      style={{ margin: 0 }}
                      initialValue={field.annotation?.fieldType || field.type}
                    >
                      <Select
                        size="small"
                        style={{ minWidth: 100 }}
                        onChange={(newType) =>
                          onFieldTypeChange?.(field.name, newType)
                        }
                        suffixIcon={<EditOutlined />}
                      >
                        {dataTypeOptions.map((option) => (
                          <Option key={option.value} value={option.value}>
                            <Space>
                              {/* <span>{option.icon}</span> */}
                              <Tag color={option.color} style={{ margin: 0 }}>
                                {option.label}
                              </Tag>
                            </Space>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </div>
                </div>

                {field.annotation && (
                  <Tag color="success" icon={<InfoCircleOutlined />}>
                    已标注
                  </Tag>
                )}
              </div>

              {/* 样本数据 */}
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  样本数据: {formatSampleValues(field.sampleValues)}
                </Text>
              </div>
            </div>

            <div className="field-annotation-inputs">
              {/* 标注标签 */}
              <Form.Item
                name={`${field.name}_label`}
                label={
                  <span>
                    字段标注
                    <Tooltip title="为这个字段提供一个有意义的中文标签">
                      <InfoCircleOutlined
                        style={{ marginLeft: 4, color: "#1890ff" }}
                      />
                    </Tooltip>
                  </span>
                }
                rules={[
                  { required: true, message: "请输入字段标注" },
                  { max: 100, message: "标注长度不能超过100个字符" },
                ]}
                style={{ marginBottom: 12 }}
              >
                <Input
                  placeholder="请输入字段的中文标注"
                  suffix={
                    field.suggestedLabel !==
                      form.getFieldValue(`${field.name}_label`) && (
                      <Tooltip title={`建议标注: ${field.suggestedLabel}`}>
                        <BulbOutlined style={{ color: "#faad14" }} />
                      </Tooltip>
                    )
                  }
                />
              </Form.Item>

              {/* 字段描述（可选） */}
              <Form.Item
                name={`${field.name}_description`}
                label={
                  <span>
                    字段描述 (可选)
                    <Tooltip title="为这个字段提供更详细的描述信息">
                      <InfoCircleOutlined
                        style={{ marginLeft: 4, color: "#1890ff" }}
                      />
                    </Tooltip>
                  </span>
                }
                rules={[{ max: 500, message: "描述长度不能超过500个字符" }]}
              >
                <TextArea
                  placeholder="请输入字段的详细描述（可选）"
                  rows={2}
                  showCount
                  maxLength={500}
                />
              </Form.Item>

              {/* 智能建议提示 */}
              {field.suggestedLabel && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <BulbOutlined
                      style={{ color: "#faad14", marginRight: 4 }}
                    />
                    智能建议: {field.suggestedLabel}
                  </Text>
                </div>
              )}
            </div>
          </Card>
        ))}
      </Space>
    </div>
  );
};
