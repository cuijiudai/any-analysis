import React from 'react';
import { Card, Typography, Badge, Space, Button, Divider } from 'antd';
import { 
  BarChartOutlined, 
  TableOutlined,
  DownloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { DataTable } from './DataTable';

const { Title, Text } = Typography;

interface DataAnalysisWrapperProps {
  sessionId: string;
  onBack?: () => void;
  onSettings?: () => void;
}

export const DataAnalysisWrapper: React.FC<DataAnalysisWrapperProps> = ({
  sessionId,
  onBack,
  onSettings
}) => {
  return (
    <div className="data-analysis-wrapper">
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: 16
        }}
      >
        <div className="analysis-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Badge 
              count="3" 
              style={{ 
                backgroundColor: '#722ed1',
                marginRight: 12,
                fontSize: 12,
                minWidth: 20,
                height: 20,
                lineHeight: '20px'
              }}
            />
            <Title level={3} style={{ margin: 0, color: '#722ed1' }}>
              数据分析
            </Title>
          </div>
          <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
            浏览和分析已标注的数据，支持筛选、排序、导出等功能。
            可以创建图表和进行统计分析。
          </Text>
        </div>

        {/* 操作按钮 */}
        <div className="action-buttons" style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Button 
              type="dashed" 
              icon={<TableOutlined />}
              style={{ borderColor: '#722ed1', color: '#722ed1' }}
            >
              表格视图
            </Button>
            <Button 
              type="dashed" 
              icon={<BarChartOutlined />}
              style={{ borderColor: '#722ed1', color: '#722ed1' }}
            >
              图表视图
            </Button>
            <Button 
              type="primary" 
              ghost 
              icon={<DownloadOutlined />}
            >
              导出数据
            </Button>
            {onSettings && (
              <Button 
                icon={<SettingOutlined />}
                onClick={onSettings}
              >
                分析设置
              </Button>
            )}
          </Space>
        </div>

        <Divider style={{ margin: '24px 0' }} />
      </Card>

      {/* 数据表格 */}
      <DataTable 
        sessionId={sessionId}
        height={600}
        showToolbar={true}
        showPagination={true}
        defaultPageSize={20}
      />

      {/* 底部操作按钮 */}
      <Card 
        style={{ 
          marginTop: 16,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {onBack && (
              <Button onClick={onBack} size="large">
                返回字段标注
              </Button>
            )}
          </div>
          <Space>
            <Text type="secondary">
              数据分析完成，可以继续探索数据或创建新的分析会话
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default DataAnalysisWrapper;