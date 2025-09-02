import React, { useState, useEffect } from "react";
import {
  Switch,
  Typography,
  Tooltip,
  Row,
  Col,
  InputNumber,
  Form,
  Select,
  Space,
} from "antd";
import {
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;
const { Option } = Select;

interface FetchModeSelectorProps {
  value?: boolean; // 改为布尔值，表示是否启用分页
  onChange?: (enablePagination: boolean) => void;
  disabled?: boolean;
  onPageFieldChange?: (pageField: string) => void;
  pageField?: string;
  suggestedPageFields?: string[]; // 建议的分页字段
  onTotalFieldChange?: (totalField: string) => void;
  totalField?: string;
  suggestedTotalFields?: string[]; // 建议的总数字段
  onPaginationTypeChange?: (paginationType: string) => void;
  paginationType?: string;
  onStepSizeChange?: (stepSize: number) => void;
  stepSize?: number;
}

const FetchModeSelector: React.FC<FetchModeSelectorProps> = ({
  value = false,
  onChange,
  disabled = false,
  onPageFieldChange,
  pageField,
  suggestedPageFields = [],
  onTotalFieldChange,
  totalField,
  suggestedTotalFields = [],
  onPaginationTypeChange,
  paginationType = "page",
  onStepSizeChange,
  stepSize = 20,
}) => {
  const [enablePagination, setEnablePagination] = useState(value);

  // 常见的分页字段名
  const commonPageFields = [
    "page",
    "pageNum",
    "pageIndex",
    "pageNumber",
    "p",
    "pageNo",
    "current",
    "offset",
  ];

  // 常见的总数字段名
  const commonTotalFields = [
    "total",
    "totalCount",
    "totalRecords",
    "count",
    "totalElements",
    "totalSize",
    "totalItems",
  ];

  // 合并建议字段和常见字段
  const allPageFields = Array.from(
    new Set([...suggestedPageFields, ...commonPageFields])
  );

  useEffect(() => {
    setEnablePagination(value);
  }, [value]);

  const handleSwitchChange = (checked: boolean) => {
    setEnablePagination(checked);
    onChange?.(checked);
  };

  const handlePageFieldChange = (field: string) => {
    onPageFieldChange?.(field);
  };

  const handleTotalFieldChange = (field: string) => {
    onTotalFieldChange?.(field);
  };

  const handlePaginationTypeChange = (type: string) => {
    onPaginationTypeChange?.(type);
  };

  const handleStepSizeChange = (size: number | null) => {
    if (size !== null) {
      onStepSizeChange?.(size);
    }
  };

  return (
    <div>
      <Row align="middle" gutter={16}>
        <Col>
          <Switch
            checked={enablePagination}
            onChange={handleSwitchChange}
            disabled={disabled}
          />
        </Col>
        <Col>
          <Space>
            <Text strong>拉取全部</Text>
            <Tooltip title="系统将自动从第1页开始拉取所有可用数据，直到API返回空数据或错误。请选择API中用于分页的字段名和总数字段名（可选），系统会显示拉取进度。">
              <InfoCircleOutlined style={{ color: "#999", fontSize: 14 }} />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {enablePagination && (
        <div
          style={{
            padding: 16,
            backgroundColor: "#f6ffed",
            borderRadius: 6,
            marginTop: 16,
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label={
                  <span>
                    分页方式
                    <Tooltip title="选择分页方式：页码方式传递页码和每页数量，索引方式传递开始索引和每页数量">
                      <InfoCircleOutlined
                        style={{ marginLeft: 4, color: "#999" }}
                      />
                    </Tooltip>
                  </span>
                }
                name="paginationType"
              >
                <Select
                  value={paginationType}
                  onChange={handlePaginationTypeChange}
                  disabled={disabled}
                >
                  <Option value="page">页码方式</Option>
                  <Option value="offset">索引方式</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col
              span={8}
              style={{
                display: paginationType === "offset" ? "block" : "none",
              }}
            >
              <Form.Item
                label={
                  <span>
                    步长
                    <Tooltip title="索引方式下每次递增的数量，默认为20">
                      <InfoCircleOutlined
                        style={{ marginLeft: 4, color: "#999" }}
                      />
                    </Tooltip>
                  </span>
                }
                name="stepSize"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  max={1000}
                  value={stepSize}
                  onChange={handleStepSizeChange}
                  disabled={disabled}
                  placeholder="20"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label={
                  <span>
                    分页字段
                    <Tooltip title="选择API中用于表示当前页码或索引的字段名，如 'page', 'offset' 等">
                      <InfoCircleOutlined
                        style={{ marginLeft: 4, color: "#999" }}
                      />
                    </Tooltip>
                  </span>
                }
                name="pageField"
                rules={[
                  {
                    required: enablePagination,
                    message: "启用分页时必须选择分页字段",
                  },
                ]}
              >
                <Select
                  placeholder="选择或输入分页字段名"
                  value={pageField}
                  onChange={handlePageFieldChange}
                  disabled={disabled}
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {suggestedPageFields.length > 0 && (
                    <Option disabled key="suggested-header">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        — 从API中检测到的字段 —
                      </Text>
                    </Option>
                  )}
                  {suggestedPageFields.map(field => (
                    <Option key={`suggested-${field}`} value={field}>
                      <Text strong>{field}</Text>
                      <Text
                        type="secondary"
                        style={{ marginLeft: 8, fontSize: 12 }}
                      >
                        (检测到)
                      </Text>
                    </Option>
                  ))}

                  {commonPageFields.length > 0 && (
                    <Option disabled key="common-header">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        — 常见分页字段 —
                      </Text>
                    </Option>
                  )}
                  {commonPageFields.map(field => (
                    <Option key={`common-${field}`} value={field}>
                      {field}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label={
                  <span>
                    总数字段 (可选)
                    <Tooltip title="选择API响应中表示总记录数的字段名，用于显示拉取进度，如 'total', 'totalCount' 等">
                      <InfoCircleOutlined
                        style={{ marginLeft: 4, color: "#999" }}
                      />
                    </Tooltip>
                  </span>
                }
                name="totalField"
              >
                <Select
                  placeholder="选择或输入总数字段名"
                  value={totalField}
                  onChange={handleTotalFieldChange}
                  disabled={disabled}
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {suggestedTotalFields && suggestedTotalFields.length > 0 && (
                    <Option disabled key="suggested-total-header">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        — 从API中检测到的字段 —
                      </Text>
                    </Option>
                  )}
                  {suggestedTotalFields?.map(field => (
                    <Option key={`suggested-total-${field}`} value={field}>
                      <Text strong>{field}</Text>
                      <Text
                        type="secondary"
                        style={{ marginLeft: 8, fontSize: 12 }}
                      >
                        (检测到)
                      </Text>
                    </Option>
                  ))}

                  {commonTotalFields.length > 0 && (
                    <Option disabled key="common-total-header">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        — 常见总数字段 —
                      </Text>
                    </Option>
                  )}
                  {commonTotalFields.map(field => (
                    <Option key={`common-total-${field}`} value={field}>
                      {field}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ExclamationCircleOutlined style={{ marginRight: 4 }} />
              系统将使用指定的分页字段自动递增页码，从1开始拉取直到获取所有数据。如果指定了总数字段，将显示精确的拉取进度。
            </Text>
          </div>
        </div>
      )}

      {!enablePagination && (
        <div
          style={{
            padding: 16,
            backgroundColor: "#fafafa",
            borderRadius: 6,
            marginTop: 16,
          }}
        >
          <Text type="secondary">
            <InfoCircleOutlined style={{ marginRight: 8, color: "#999" }} />
            未启用拉取全部，系统将只拉取API返回的第一页数据。
            如果API支持分页，建议开启拉取全部以获取完整数据。
          </Text>
        </div>
      )}
    </div>
  );
};

export default FetchModeSelector;
