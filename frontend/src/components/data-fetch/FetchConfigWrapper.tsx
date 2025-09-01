import React from "react";
import {
  Card,
  Typography,
  Badge,
  Space,
  Button,
  Divider,
  Row,
  Col,
  Progress,
  Alert,
} from "antd";
import {
  SettingOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import FetchConfigForm from "./FetchConfigForm";
import DataPreview from "./DataPreview";
import FetchedDataPreview from "./FetchedDataPreview";
import { FetchConfig, SmokeTestResponse } from "../../types";

const { Title, Text } = Typography;

interface FetchStatus {
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  totalPages?: number;
  completedPages?: number;
  totalRecords?: number;
  error?: string;
}

interface FetchConfigWrapperProps {
  initialValues?: Partial<FetchConfig>;
  onConfigChange?: (config: FetchConfig) => void;
  onSmokeTestComplete?: (result: SmokeTestResponse) => void;
  onStartFetch?: (config: FetchConfig) => void;
  onSaveConfig?: (config: FetchConfig) => void;
  loading?: boolean;
  fetchStatus?: FetchStatus | null;
  smokeTestResult?: SmokeTestResponse | null;
  onEnterAnnotation?: () => void;
  onEnterDataAnalysis?: () => void;
  sessionId?: string; // 添加sessionId用于显示历史数据
}

export const FetchConfigWrapper: React.FC<FetchConfigWrapperProps> = ({
  initialValues,
  onConfigChange,
  onSmokeTestComplete,
  onStartFetch,
  onSaveConfig,
  loading = false,
  fetchStatus,
  smokeTestResult,
  onEnterAnnotation,
  onEnterDataAnalysis,
  sessionId,
}) => {
  return (
    <div className="fetch-config-wrapper">
      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <FetchConfigForm
            initialValues={initialValues}
            onConfigChange={onConfigChange}
            onSmokeTestComplete={onSmokeTestComplete}
            onStartFetch={onStartFetch}
            onSaveConfig={onSaveConfig}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={14}>
          {/* 拉取进度显示 */}
          {fetchStatus?.status === "running" && (
            <Card
              title="数据拉取进度"
              style={{
                marginBottom: 16,
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div style={{ textAlign: "center", padding: "20px" }}>
                <Progress
                  type="circle"
                  percent={fetchStatus.progress || 0}
                  status="active"
                  format={percent => `${percent}%`}
                  strokeColor={{
                    "0%": "#1890ff",
                    "100%": "#52c41a",
                  }}
                />
                <div style={{ marginTop: 16 }}>
                  <Text strong>正在拉取数据...</Text>
                  {fetchStatus.completedPages && fetchStatus.totalPages && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        已完成 {fetchStatus.completedPages} /{" "}
                        {fetchStatus.totalPages} 页
                      </Text>
                    </div>
                  )}
                  {fetchStatus.totalRecords && (
                    <div>
                      <Text type="secondary">
                        已获取 {fetchStatus.totalRecords} 条记录
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* 拉取完成状态 */}
          {/* {fetchStatus?.status === 'completed' && (
            <Card 
              style={{ 
                marginBottom: 16,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}
            >
              <Alert
                type="success"
                message="数据拉取完成"
                description={`成功拉取 ${fetchStatus.totalRecords || 0} 条记录`}
                action={
                  <Space>
                    {onEnterAnnotation && (
                      <Button 
                        type="primary" 
                        icon={<ArrowRightOutlined />}
                        onClick={onEnterAnnotation}
                        style={{
                          background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                          border: 'none'
                        }}
                      >
                        进入字段标注
                      </Button>
                    )}
                    {onEnterDataAnalysis && (
                      <Button onClick={onEnterDataAnalysis}>
                        查看数据
                      </Button>
                    )}
                  </Space>
                }
                showIcon
                icon={<CheckCircleOutlined />}
                closable
              />
            </Card>
          )} */}

          {/* 拉取失败状态 */}
          {fetchStatus?.status === "failed" && fetchStatus.error && (
            <Card
              style={{
                marginBottom: 16,
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
            >
              <Alert
                type="error"
                message="数据拉取失败"
                description={fetchStatus.error}
                showIcon
              />
            </Card>
          )}

          {/* 数据预览 */}
          {fetchStatus?.status === "completed" && sessionId ? (
            <FetchedDataPreview sessionId={sessionId} height={500} />
          ) : (
            <DataPreview testResult={smokeTestResult || undefined} />
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FetchConfigWrapper;
