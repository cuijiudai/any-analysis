import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  message,
  Spin,
  Typography,
  Row,
  Col,
  Statistic,
  Alert,
  Tag,
  Descriptions,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  SettingOutlined,
  BarChartOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { DataTable } from '../components/data-analysis/DataTable';
import api from '../services/api';
import { DataSession } from '../types';

const { Content } = Layout;
const { Title, Text } = Typography;

interface DataStats {
  totalRecords: number;
  totalFields: number;
  tableSize: string;
  created: string;
  lastUpdated: string;
}

interface FetchConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  totalPages?: number;
}

const DataViewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<DataSession | null>(null);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [fetchConfig, setFetchConfig] = useState<FetchConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载会话信息
  const loadSession = async () => {
    if (!sessionId) return;

    try {
      const response = await api.get(`/data-session/${sessionId}`);
      if (response.data.success) {
        setSession(response.data.data);
      } else {
        message.error('加载会话信息失败');
        navigate('/sessions');
      }
    } catch (error: any) {
      message.error(`加载会话失败: ${error.message}`);
      navigate('/sessions');
    }
  };

  // 加载数据统计
  const loadDataStats = async () => {
    if (!sessionId) return;

    try {
      const response = await api.get(`/data-analysis/stats/${sessionId}`);
      if (response.data.success) {
        setDataStats(response.data.data);
      }
    } catch (error: any) {
      console.error('加载数据统计失败:', error);
    }
  };

  // 加载拉取配置
  const loadFetchConfig = async () => {
    if (!sessionId) return;

    try {
      const response = await api.get(`/data-fetch/config/${sessionId}`);
      if (response.data.success) {
        setFetchConfig(response.data.data);
      }
    } catch (error: any) {
      console.error('加载拉取配置失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadSession(),
        loadDataStats(),
        loadFetchConfig(),
      ]);
      setLoading(false);
    };

    loadData();
  }, [sessionId]);

  // 刷新数据
  const handleRefresh = async () => {
    await Promise.all([
      loadDataStats(),
      loadFetchConfig(),
    ]);
    message.success('数据已刷新');
  };

  // 返回会话列表
  const handleGoBack = () => {
    navigate('/sessions');
  };

  // 编辑配置
  const handleEditConfig = () => {
    navigate(`/fetch/${sessionId}`);
  };

  // 进入工作流
  const handleEnterWorkflow = () => {
    navigate(`/workflow/${sessionId}`);
  };

  // 进入字段标注
  const handleFieldAnnotation = () => {
    navigate(`/workflow/${sessionId}?step=annotation`);
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'configuring': { color: 'blue', text: '配置中' },
      'fetching': { color: 'processing', text: '拉取中' },
      'annotating': { color: 'orange', text: '标注中' },
      'analyzing': { color: 'purple', text: '分析中' },
      'completed': { color: 'success', text: '已完成' },
    };

    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  if (loading) {
    return (
      <Content
        style={{
          padding: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spin size="large" />
      </Content>
    );
  }

  if (!session) {
    return (
      <Content style={{ padding: '24px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">会话不存在或已被删除</Text>
            <br />
            <Button
              type="primary"
              onClick={handleGoBack}
              style={{ marginTop: 16 }}
            >
              返回会话列表
            </Button>
          </div>
        </Card>
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
            返回列表
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            数据查看 - {session.name}
          </Title>
          {getStatusTag(session.status)}
        </Space>
        <Space>
          <Button
            icon={<SettingOutlined />}
            onClick={handleEditConfig}
          >
            编辑配置
          </Button>
          <Button
            icon={<TagsOutlined />}
            onClick={handleFieldAnnotation}
            disabled={session.status !== 'completed'}
          >
            字段标注
          </Button>
          <Button
            icon={<BarChartOutlined />}
            onClick={handleEnterWorkflow}
          >
            完整工作流
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 会话信息 */}
      <Card title="会话信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="会话名称">{session.name}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(session.status)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(session.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {new Date(session.updatedAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 拉取配置信息 */}
      {fetchConfig && (
        <Card title="拉取配置" style={{ marginBottom: 16 }}>
          <Descriptions column={2}>
            <Descriptions.Item label="API地址">{fetchConfig.url}</Descriptions.Item>
            <Descriptions.Item label="请求方法">{fetchConfig.method}</Descriptions.Item>
            {fetchConfig.totalPages && (
              <Descriptions.Item label="总页数">{fetchConfig.totalPages}</Descriptions.Item>
            )}
            {fetchConfig.headers && Object.keys(fetchConfig.headers).length > 0 && (
              <Descriptions.Item label="请求头" span={2}>
                <pre style={{ fontSize: '12px', margin: 0 }}>
                  {JSON.stringify(fetchConfig.headers, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* 数据统计 */}
      {dataStats ? (
        <Card title="数据统计" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="总记录数" 
                value={dataStats.totalRecords} 
                suffix="条"
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="字段数" 
                value={dataStats.totalFields} 
                suffix="个"
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="数据大小" 
                value={dataStats.tableSize} 
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="最后更新" 
                value={new Date(dataStats.lastUpdated).toLocaleString()} 
              />
            </Col>
          </Row>
        </Card>
      ) : (
        <Alert
          type="info"
          message="暂无数据统计"
          description="该会话尚未完成数据拉取，或数据已被清理。"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 数据表格 */}
      {session.status === 'completed' && sessionId ? (
        <Card title="历史拉取数据">
          <DataTable
            sessionId={sessionId}
            height={600}
            showToolbar={true}
            showPagination={true}
            defaultPageSize={20}
          />
        </Card>
      ) : (
        <Card title="数据预览">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">
              {session.status === 'configuring' && '数据拉取尚未开始'}
              {session.status === 'fetching' && '数据拉取进行中...'}
              {session.status === 'annotating' && '字段标注进行中...'}
              {session.status === 'analyzing' && '数据分析进行中...'}
            </Text>
            <br />
            {session.status === 'configuring' && (
              <Button
                type="primary"
                onClick={handleEditConfig}
                style={{ marginTop: 16 }}
              >
                开始配置拉取
              </Button>
            )}
          </div>
        </Card>
      )}
    </Content>
  );
};

export default DataViewPage;