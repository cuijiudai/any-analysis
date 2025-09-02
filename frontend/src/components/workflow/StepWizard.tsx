import React, { useState, useEffect } from "react";
import { Steps, Card, Button, Space, message, Progress, Alert } from "antd";
import {
  SettingOutlined,
  TagsOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import FetchConfigForm from "../data-fetch/FetchConfigForm";
import FetchedDataPreview from "../data-fetch/FetchedDataPreview";
import { FieldAnnotationForm } from "../field-annotation";
import { FetchConfig, SmokeTestResponse, DataSession } from "../../types";
import api from "../../services/api";

const { Step } = Steps;

interface StepWizardProps {
  sessionId?: string;
  onSessionChange?: (session: DataSession) => void;
}

interface FetchProgress {
  status:
    | "starting"
    | "analyzing"
    | "creating_table"
    | "fetching"
    | "completed"
    | "error";
  currentPage?: number;
  totalPages?: number;
  fetchedRecords: number;
  totalRecords?: number;
  message: string;
  error?: string;
  percentage?: number;
}

const StepWizard: React.FC<StepWizardProps> = ({
  sessionId,
  onSessionChange,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [session, setSession] = useState<DataSession | null>(null);
  const [fetchConfig, setFetchConfig] = useState<FetchConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(
    null
  );
  const [smokeTestResult, setSmokeTestResult] =
    useState<SmokeTestResponse | null>(null);

  // 步骤定义
  const steps = [
    {
      title: "数据拉取",
      description: "配置API参数并测试连接",
      icon: <SettingOutlined />,
      content: "config",
    },
    {
      title: "字段标注",
      description: "为数据字段添加标注",
      icon: <TagsOutlined />,
      content: "annotation",
    },
    {
      title: "数据分析",
      description: "查看和分析拉取的数据",
      icon: <BarChartOutlined />,
      content: "analysis",
    },
  ];

  // 创建新会话
  const createSession = async () => {
    try {
      setLoading(true);
      const response = await api.post("/data-session/create", {
        name: `数据分析会话 ${new Date().toLocaleString()}`,
      });

      if (response.data.success) {
        const newSession = response.data.data;
        setSession(newSession);
        onSessionChange?.(newSession);
        message.success("会话创建成功");
        return newSession.id;
      }
    } catch (error: any) {
      message.error(
        "创建会话失败: " + (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // 加载会话信息
  const loadSession = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/data-session/${id}`);

      if (response.data.success) {
        const sessionData = response.data.data;
        setSession(sessionData);

        // 根据会话状态设置当前步骤
        switch (sessionData.status) {
          case "unfetched":
            setCurrentStep(0);
            break;
          case "fetched":
            setCurrentStep(1);
            break;
          case "analyzed":
            setCurrentStep(2);
            break;
          default:
            setCurrentStep(0);
        }
      }
    } catch (error: any) {
      message.error(
        "加载会话失败: " + (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // 保存拉取配置
  const handleSaveConfig = async (config: FetchConfig) => {
    if (!session) return;

    try {
      const response = await api.post("/data-fetch/save-config", {
        ...config,
        sessionId: session.id,
      });

      if (response.data.success) {
        setFetchConfig(config);
        message.success("配置保存成功");
      }
    } catch (error: any) {
      message.error(
        "保存配置失败: " + (error.response?.data?.error || error.message)
      );
    }
  };

  // 开始数据拉取
  const handleStartFetch = async (config: FetchConfig) => {
    if (!session) return;

    try {
      setLoading(true);

      // 先保存配置
      await handleSaveConfig(config);

      // 开始拉取
      const response = await api.post(`/data-fetch/execute/${session.id}`);

      if (response.data.success) {
        message.success("数据拉取已开始");
        // 开始监控进度
        startProgressMonitoring();
      }
    } catch (error: any) {
      message.error(
        "开始拉取失败: " + (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // 监控拉取进度
  const startProgressMonitoring = () => {
    if (!session) return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/data-fetch/progress/${session.id}`);

        if (response.data.success && response.data.data) {
          const progress = response.data.data;
          setFetchProgress(progress);

          if (["completed", "error"].includes(progress.status)) {
            clearInterval(interval);

            if (progress.status === "completed") {
              message.success("数据拉取完成");
              setCurrentStep(1); // 进入标注步骤
            } else {
              message.error("数据拉取失败: " + progress.error);
            }
          }
        }
      } catch (error) {
        console.error("获取进度失败:", error);
        clearInterval(interval);
      }
    }, 2000);

    // 清理定时器
    setTimeout(() => clearInterval(interval), 300000); // 5分钟后自动停止
  };

  // 处理冒烟测试完成
  const handleSmokeTestComplete = (result: SmokeTestResponse) => {
    setSmokeTestResult(result);
  };

  // 下一步
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 初始化
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      createSession();
    }
  }, [sessionId]);

  // 渲染步骤内容
  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.content) {
      case "config":
        return (
          <div>
            <FetchConfigForm
              onSaveConfig={handleSaveConfig}
              onStartFetch={handleStartFetch}
              onSmokeTestComplete={handleSmokeTestComplete}
              loading={loading}
              initialValues={fetchConfig || undefined}
            />

            {/* 拉取进度 */}
            {fetchProgress && (
              <Card title="拉取进度" style={{ marginTop: 16 }} size="small">
                <Progress
                  percent={fetchProgress.percentage || 0}
                  status={
                    fetchProgress.status === "error" ? "exception" : "active"
                  }
                  strokeColor={{
                    "0%": "#108ee9",
                    "100%": "#87d068",
                  }}
                />
                <div style={{ marginTop: 8 }}>
                  <p>
                    <strong>状态:</strong> {fetchProgress.message}
                  </p>
                  {fetchProgress.currentPage && fetchProgress.totalPages && (
                    <p>
                      <strong>进度:</strong> {fetchProgress.currentPage}/
                      {fetchProgress.totalPages} 页
                    </p>
                  )}
                  <p>
                    <strong>已拉取记录:</strong> {fetchProgress.fetchedRecords}{" "}
                    条
                  </p>
                  {fetchProgress.error && (
                    <Alert
                      message={fetchProgress.error}
                      type="error"
                      showIcon
                    />
                  )}
                </div>
              </Card>
            )}
          </div>
        );

      case "annotation":
        return (
          <div>
            {session && (
              <FieldAnnotationForm
                sessionId={session.id}
                onComplete={handleNext}
                onBack={handlePrev}
              />
            )}
          </div>
        );

      case "analysis":
        return (
          <div>
            {session && (
              <FetchedDataPreview
                sessionId={session.id}
                visible={true}
                height={500}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // 检查步骤是否可以进行
  const canProceedToNext = () => {
    switch (currentStep) {
      case 0:
        return (
          fetchProgress?.status === "completed" || smokeTestResult?.success
        );
      case 1:
        return true; // TODO: 检查标注是否完成
      case 2:
        return false; // 最后一步
      default:
        return false;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 步骤导航 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} size="small">
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              icon={
                index < currentStep ? (
                  <CheckCircleOutlined />
                ) : index === currentStep && loading ? (
                  <LoadingOutlined />
                ) : (
                  step.icon
                )
              }
            />
          ))}
        </Steps>
      </Card>

      {/* 会话信息 */}
      {session && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <span>
              <strong>会话:</strong> {session.name}
            </span>
            <span>
              <strong>状态:</strong> {session.status}
            </span>
            <span>
              <strong>创建时间:</strong>{" "}
              {new Date(session.createdAt).toLocaleString()}
            </span>
          </Space>
        </Card>
      )}

      {/* 步骤内容 */}
      <div style={{ minHeight: 400 }}>{renderStepContent()}</div>

      {/* 导航按钮 */}
      <div style={{ marginTop: 24, textAlign: "right" }}>
        <Space>
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            上一步
          </Button>
          <Button
            type="primary"
            onClick={handleNext}
            disabled={!canProceedToNext()}
          >
            {currentStep === steps.length - 1 ? "完成" : "下一步"}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default StepWizard;
