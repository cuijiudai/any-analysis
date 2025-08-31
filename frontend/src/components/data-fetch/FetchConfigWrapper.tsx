import React from 'react';
import { Card, Typography, Badge, Space, Button, Divider, Row, Col, Progress, Alert } from 'antd';
import { 
  SettingOutlined, 
  RocketOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import FetchConfigForm from './FetchConfigForm';
import DataPreview from './DataPreview';
import FetchedDataPreview from './FetchedDataPreview';
import { FetchConfig, SmokeTestResponse } from '../../types';

const { Title, Text } = Typography;

interface FetchStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  totalPages?: number;
  completedPages?: number;
  totalRecords?: number;
  error?: string;
}

interface FetchConfigWrapperProps {
  initialValues?: FetchConfig;
  onConfigChange?: (config: FetchConfig) => void;
  onSmokeTestComplete?: (result: SmokeTestResponse) => void;
  onStartFetch?: (config: FetchConfig) => void;
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
  loading = false,
  fetchStatus,
  smokeTestResult,
  onEnterAnnotation,
  onEnterDataAnalysis,
  sessionId
}) => {
  return (
    <div className="fetch-config-wrapper">
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: 16
        }}
      >
        <div className="config-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Badge 
              count="1" 
              style={{ 
                backgroundColor: '#1890ff',
                marginRight: 12,
                fontSize: 12,
                minWidth: 20,
                height: 20,
                lineHeight: '20px'
              }}
            />
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
              数据拉取配置
            </Title>
          </div>
          <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
            配置API参数并拉取数据。完成配置后可以执行冒烟测试验证连接，
            然后开始正式的数据拉取。
          </Text>
        </div>

        {/* 操作按钮 */}
        <div className="action-buttons" style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Button 
              type="dashed" 
              icon={<SettingOutlined />}
              style={{ borderColor: '#1890ff', color: '#1890ff' }}
            >
              配置参数
            </Button>
            <Button 
              type="dashed" 
              icon={<RocketOutlined />}
              style={{ borderColor: '#1890ff', color: '#1890ff' }}
            >
              冒烟测试
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: '24px 0' }} />
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <FetchConfigForm
            initialValues={initialValues}
            onConfigChange={onConfigChange}
            onSmokeTestComplete={onSmokeTestComplete}
            onStartFetch={onStartFetch}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={14}>
          {/* 拉取进度显示 */}
          {fetchStatus?.status === 'running' && (
            <Card 
              title="数据拉取进度" 
              style={{ 
                marginBottom: 16,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}
            >
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Progress 
                  type="circle" 
                  percent={fetchStatus.progress || 0} 
                  status="active"
                  format={(percent) => `${percent}%`}
                  strokeColor={{
                    '0%': '#1890ff',
                    '100%': '#52c41a',
                  }}
                />
                <div style={{ marginTop: 16 }}>
                  <Text strong>正在拉取数据...</Text>
                  {fetchStatus.completedPages && fetchStatus.totalPages && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        已完成 {fetchStatus.completedPages} / {fetchStatus.totalPages} 页
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
          {fetchStatus?.status === 'completed' && (
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
              />
            </Card>
          )}

          {/* 拉取失败状态 */}
          {fetchStatus?.status === 'failed' && fetchStatus.error && (
            <Card 
              style={{ 
                marginBottom: 16,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
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
          {fetchStatus?.status === 'completed' && sessionId ? (
            <FetchedDataPreview 
              sessionId={sessionId}
              height={500}
            />
          ) : (
            <DataPreview testResult={smokeTestResult || undefined} />
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FetchConfigWrapper;