import React, { useState, useEffect } from 'react';
import { Row, Col, Layout, Button, Space, message, Card } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import FetchConfigWrapper from '../components/data-fetch/FetchConfigWrapper';
import FetchResultTable from '../components/data-fetch/FetchResultTable';
import WorkflowSteps from '../components/common/WorkflowSteps';
import { FetchConfig, SmokeTestResponse } from '../types';
import api from '../services/api';

const { Content } = Layout;

const MainWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [currentConfig, setCurrentConfig] = useState<FetchConfig | null>(null);
  const [smokeTestResult, setSmokeTestResult] = useState<SmokeTestResponse | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<any>(null);
  const [fetchedData, setFetchedData] = useState<any[]>([]);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 加载已有的配置（如果有sessionId）
  useEffect(() => {
    if (sessionId) {
      loadExistingConfig();
    }
  }, [sessionId]);

  const loadExistingConfig = async () => {
    if (!sessionId) return;

    try {
      const response = await api.get(`/data-fetch/config/${sessionId}`);
      if (response.data.success) {
        setCurrentConfig(response.data.data);
        message.success('已加载保存的拉取配置');
      }
    } catch (error: any) {
      console.log('拉取配置不存在，将创建新配置');
    }
  };

  const handleConfigChange = (config: FetchConfig) => {
    setCurrentConfig(config);
  };

  const handleSmokeTestComplete = (result: SmokeTestResponse) => {
    setSmokeTestResult(result);
    if (result.success) {
      setCurrentStep(1); // 测试成功后进入下一步
    }
  };

  const handleSaveConfig = async (config: FetchConfig) => {
    try {
      setLoading(true);
      
      let targetSessionId = sessionId;
      
      // 如果没有sessionId，创建新会话
      if (!targetSessionId) {
        const sessionResponse = await api.post('/data-session', {
          name: `数据拉取会话 - ${new Date().toLocaleString()}`
        });
        
        if (!sessionResponse.data.success) {
          throw new Error(sessionResponse.data.error || '创建会话失败');
        }
        
        targetSessionId = sessionResponse.data.data.id;
      }
      
      // 保存配置
      const configResponse = await api.post('/data-fetch/configure', {
        ...config,
        sessionId: targetSessionId
      });
      
      if (configResponse.data.success) {
        message.success('配置保存成功！');
        setCurrentStep(2); // 保存成功后进入下一步
        // 跳转到工作流页面
        navigate(`/workflow/${targetSessionId}`);
      } else {
        throw new Error(configResponse.data.error || '保存配置失败');
      }
    } catch (error: any) {
      message.error(`保存配置失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFetch = async (config: FetchConfig) => {
    try {
      setLoading(true);
      
      let targetSessionId = sessionId;
      
      // 如果没有sessionId，创建新会话
      if (!targetSessionId) {
        const sessionResponse = await api.post('/data-session', {
          name: `数据拉取会话 - ${new Date().toLocaleString()}`
        });
        
        if (!sessionResponse.data.success) {
          throw new Error(sessionResponse.data.error || '创建会话失败');
        }
        
        targetSessionId = sessionResponse.data.data.id;
      }
      
      setCurrentSessionId(targetSessionId || null);
      
      // 保存配置
      const configResponse = await api.post('/data-fetch/configure', {
        ...config,
        sessionId: targetSessionId
      });
      
      if (!configResponse.data.success) {
        throw new Error(configResponse.data.error || '保存配置失败');
      }
      
      // 立即显示开始拉取的提示和进度
      message.info('开始拉取数据...');
      setFetchStatus({
        status: 'running',
        progress: 0
      });
      
      // 开始拉取
      const executeResponse = await api.post('/data-fetch/execute', {
        sessionId: targetSessionId
      });
      
      if (executeResponse.data.success) {
        message.success('数据拉取成功！');
        setCurrentStep(2); // 进入数据展示步骤
        setFetchStatus({
          status: 'completed',
          totalRecords: executeResponse.data.totalRecords,
          pagesProcessed: executeResponse.data.pagesProcessed
        });
        
        // 加载拉取的数据
        if (targetSessionId) {
          await loadFetchedData(targetSessionId);
        }
      } else {
        setFetchStatus({
          status: 'failed',
          error: executeResponse.data.message || '开始拉取失败'
        });
        throw new Error(executeResponse.data.message || '开始拉取失败');
      }
    } catch (error: any) {
      message.error(`开始拉取失败: ${error.message}`);
      setFetchStatus({
        status: 'failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载拉取的数据
  const loadFetchedData = async (sessionId: string) => {
    try {
      // 先获取数据统计信息来确定总记录数
      const statsResponse = await api.get(`/data-fetch/stats/${sessionId}`);
      let totalRecords = 100; // 默认值
      
      if (statsResponse.data.success) {
        totalRecords = statsResponse.data.data.totalRecords || 100;
      }
      
      // 使用较大的pageSize来获取所有数据，最多1000条用于预览
      const pageSize = Math.min(totalRecords, 1000);
      const dataResponse = await api.get(`/data-fetch/data/${sessionId}?page=1&pageSize=${pageSize}`);
      if (dataResponse.data.success) {
        setFetchedData(dataResponse.data.data.data || []);
      }
    } catch (error: any) {
      console.error('加载数据失败:', error);
    }
  };

  const handleGoToList = () => {
    navigate('/sessions');
  };

  const layoutProps = isMobile 
    ? { 
        direction: 'vertical' as const,
        gutter: [0, 16] as [number, number]
      }
    : { 
        gutter: 16 
      };



  return (
    <Content style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      {/* 顶部操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          {sessionId ? '编辑数据拉取配置' : '数据拉取配置'}
        </h2>
        <Space>
          <Button 
            icon={<UnorderedListOutlined />}
            onClick={handleGoToList}
          >
            查看会话列表
          </Button>
        </Space>
      </div>

      {/* 步骤条 */}
      <WorkflowSteps current={currentStep} completedSteps={[]} />

      {currentStep < 2 ? (
        <FetchConfigWrapper
          initialValues={currentConfig || undefined}
          onConfigChange={handleConfigChange}
          onSmokeTestComplete={handleSmokeTestComplete}
          onSaveConfig={handleSaveConfig}
          onStartFetch={handleStartFetch}
          loading={loading}
          fetchStatus={fetchStatus}
          smokeTestResult={smokeTestResult}
          sessionId={currentSessionId || undefined}
        />
      ) : (
        <div>
          {fetchStatus && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space>
                <span>拉取状态: <strong style={{ color: '#52c41a' }}>完成</strong></span>
                <span>总记录数: <strong>{fetchStatus.totalRecords}</strong></span>
                {fetchStatus.pagesProcessed && (
                  <span>处理页数: <strong>{fetchStatus.pagesProcessed}</strong></span>
                )}
              </Space>
            </Card>
          )}
          
          <FetchResultTable
            data={fetchedData}
            title={`拉取结果 (共${fetchedData.length}条)`}
            showActions={true}
            mode="formal"
            sessionId={currentSessionId || undefined}
            onFieldAnnotation={(sessionId) => navigate(`/workflow/${sessionId}?step=annotation`)}
          />
        </div>
      )}
    </Content>
  );
};

export default MainWorkflowPage;