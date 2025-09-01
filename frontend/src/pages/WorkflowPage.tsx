import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Progress,
  Alert
} from 'antd';
import { 
  ArrowLeftOutlined, 
  ReloadOutlined,
  SettingOutlined,
  RocketOutlined,
  TagsOutlined
} from '@ant-design/icons';
import { DataAnalysisWrapper } from '../components/data-analysis/DataAnalysisWrapper';
import { FieldAnnotationForm } from '../components/field-annotation';
import { FetchConfigWrapper } from '../components/data-fetch';
import WorkflowSteps from '../components/common/WorkflowSteps';
import api from '../services/api';
import { DataSession, FetchConfig, SmokeTestResponse } from '../types';

const { Content } = Layout;
const { Title, Text } = Typography;

interface FetchStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  totalPages?: number;
  completedPages?: number;
  totalRecords?: number;
  error?: string;
}

interface DataStats {
  totalRecords: number;
  totalFields: number;
  tableSize: string;
  created: string;
}

const WorkflowPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [session, setSession] = useState<DataSession | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('config'); // 'config' | 'annotation' | 'data'
  const [currentConfig, setCurrentConfig] = useState<FetchConfig | null>(null);
  const [smokeTestResult, setSmokeTestResult] = useState<SmokeTestResponse | null>(null);
  const [progressInterval, setProgressInterval] = useState<ReturnType<typeof setInterval> | null>(null);

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

  // 加载拉取状态
  const loadFetchStatus = async () => {
    if (!sessionId) return;

    try {
      const response = await api.get(`/data-fetch/status/${sessionId}`);
      if (response.data.success) {
        setFetchStatus(response.data.data);
      }
    } catch (error: any) {
      console.error('加载拉取状态失败:', error);
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
        setCurrentConfig(response.data.data);
      }
    } catch (error: any) {
      // 配置不存在是正常的，不需要报错
      console.log('拉取配置不存在，将创建新配置');
    }
  };

  // 初始加载
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadSession(),
        loadFetchStatus(),
        loadDataStats(),
        loadFetchConfig(),
      ]);
      setLoading(false);
    };

    loadData();
    
    // 检查URL参数，确定当前步骤
    const step = searchParams.get('step');
    if (step === 'annotation') {
      setCurrentStep('annotation');
    } else if (step === 'data') {
      setCurrentStep('data');
    } else {
      // 默认从配置步骤开始
      setCurrentStep('config');
    }
  }, [sessionId, searchParams]);

  // 监控拉取进度
  useEffect(() => {
    if (fetchStatus?.status === 'running' && !progressInterval) {
      const interval = setInterval(async () => {
        await loadFetchStatus();
      }, 2000); // 每2秒检查一次进度
      
      setProgressInterval(interval);
    } else if (fetchStatus?.status !== 'running' && progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }

    // 根据拉取状态自动调整当前步骤
    if (fetchStatus?.status === 'completed' && currentStep === 'config') {
      // 如果拉取完成且当前在配置步骤，保持在配置步骤，让用户手动选择下一步
      // setCurrentStep('data');
    }

    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [fetchStatus?.status]);

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadFetchStatus(),
      loadDataStats(),
      loadFetchConfig(),
    ]);
    setRefreshing(false);
  };

  // 返回会话列表
  const handleGoBack = () => {
    navigate('/sessions');
  };

  // 获取当前步骤
  const getCurrentStep = () => {
    switch (currentStep) {
      case 'config':
        return 0;
      case 'annotation':
        return 1;
      case 'data':
        return 2;
      default:
        return 0;
    }
  };

  // 获取已完成的步骤
  const getCompletedSteps = () => {
    const completed: number[] = [];
    
    // 如果有数据拉取完成，则第一步完成
    if (fetchStatus?.status === 'completed') {
      completed.push(0);
    }
    
    // 只有当前在数据分析步骤时，字段标注才算完成
    if (currentStep === 'data') {
      completed.push(0, 1);
    }
    
    return completed;
  };

  // 处理配置变化
  const handleConfigChange = (config: FetchConfig) => {
    setCurrentConfig(config);
  };

  // 处理冒烟测试完成
  const handleSmokeTestComplete = (result: SmokeTestResponse) => {
    setSmokeTestResult(result);
  };

  // 开始数据拉取
  const handleStartFetch = async (config: FetchConfig) => {
    try {
      setFetchLoading(true);
      
      // 保存配置
      const configResponse = await api.post('/data-fetch/configure', {
        ...config,
        sessionId
      });
      
      if (!configResponse.data.success) {
        throw new Error(configResponse.data.error || '保存配置失败');
      }
      
      // 开始拉取
      const executeResponse = await api.post('/data-fetch/execute', {
        sessionId
      });
      
      if (executeResponse.data.success) {
        message.success('数据拉取已开始！');
        setFetchStatus({ status: 'running', progress: 0 });
        
        // 开始监控进度
        const interval = setInterval(async () => {
          await loadFetchStatus();
        }, 2000);
        setProgressInterval(interval);
      } else {
        throw new Error(executeResponse.data.message || '开始拉取失败');
      }
    } catch (error: any) {
      message.error(`开始拉取失败: ${error.message}`);
    } finally {
      setFetchLoading(false);
    }
  };

  // 处理字段标注完成
  const handleAnnotationComplete = () => {
    message.success('字段标注完成！');
    setCurrentStep('data');
    // 导航到数据分析步骤
    navigate(`/workflow/${sessionId}?step=data`, { replace: true });
  };

  // 步骤切换函数
  const handleStepChange = (stepIndex: number) => {
    const stepMap = ['config', 'annotation', 'data'];
    const step = stepMap[stepIndex];
    setCurrentStep(step);
    
    // 为每个步骤设置对应的URL参数
    if (step === 'config') {
      navigate(`/workflow/${sessionId}`, { replace: true });
    } else if (step === 'annotation') {
      navigate(`/workflow/${sessionId}?step=annotation`, { replace: true });
    } else if (step === 'data') {
      navigate(`/workflow/${sessionId}?step=data`, { replace: true });
    }
  };



  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
            <Button type="primary" onClick={handleGoBack} style={{ marginTop: 16 }}>
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBack}
          >
           
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {session.name}
          </Title>
        </Space>
        
      </div>

      {/* 步骤条 */}
      <WorkflowSteps 
        current={getCurrentStep()} 
        onChange={handleStepChange}
        completedSteps={getCompletedSteps()}
      />
      
      {fetchStatus?.error && (
        <Card style={{ marginBottom: 16 }}>
          <Alert
            type="error"
            message="拉取失败"
            description={fetchStatus.error}
            showIcon
          />
        </Card>
      )}

      {/* 数据统计 */}
      {dataStats && (
        <Card title="数据概览" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic 
                title="总记录数" 
                value={dataStats.totalRecords} 
                suffix="条"
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="字段数" 
                value={dataStats.totalFields} 
                suffix="个"
              />
            </Col>
           
            <Col span={8}>
              <Statistic 
                title="创建时间" 
                value={new Date(dataStats.created).toLocaleString()} 
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 数据拉取配置步骤 */}
      {currentStep === 'config' && (
        <FetchConfigWrapper
          initialValues={currentConfig || undefined}
          onConfigChange={handleConfigChange}
          onSmokeTestComplete={handleSmokeTestComplete}
          onStartFetch={handleStartFetch}
          loading={fetchLoading}
          fetchStatus={fetchStatus}
          smokeTestResult={smokeTestResult}
          onEnterAnnotation={() => handleStepChange(1)}
          onEnterDataAnalysis={() => handleStepChange(2)}
          sessionId={sessionId}
        />
      )}

      {/* 字段标注 */}
      {currentStep === 'annotation' && sessionId && (
        <FieldAnnotationForm
          sessionId={sessionId}
          onComplete={handleAnnotationComplete}
          onBack={() => handleStepChange(0)}
        />
      )}

      {/* 数据分析 */}
      {currentStep === 'data' && sessionId && (
        <>
          {fetchStatus?.status === 'completed' ? (
            <DataAnalysisWrapper 
              sessionId={sessionId}
              onBack={() => handleStepChange(1)}
            />
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">数据拉取尚未完成</Text>
                <br />
                <Text type="secondary">请先完成数据拉取后再进行数据分析</Text>
                <br />
                <Button 
                  type="primary" 
                  onClick={() => handleStepChange(0)}
                  style={{ marginTop: 16 }}
                >
                  返回数据配置
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* 等待状态 */}
      {fetchStatus?.status === 'pending' && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">数据拉取尚未开始</Text>
            <br />
            <Text type="secondary">请返回配置页面开始数据拉取</Text>
          </div>
        </Card>
      )}

      {/* 拉取中状态 */}
      {fetchStatus?.status === 'running' && (
        <Card title="数据拉取进度">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Progress 
              type="circle" 
              percent={fetchStatus.progress || 0} 
              status="active"
            />
            <div style={{ marginTop: 16 }}>
              <Text>正在拉取数据...</Text>
              {fetchStatus.completedPages && fetchStatus.totalPages && (
                <div>
                  <Text type="secondary">
                    已完成 {fetchStatus.completedPages} / {fetchStatus.totalPages} 页
                  </Text>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </Content>
  );
};

export default WorkflowPage;