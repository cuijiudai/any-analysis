import React from "react";
import { Steps, Card, Popover, Typography, Badge } from "antd";
import {
  SettingOutlined,
  TagsOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

interface WorkflowStepsProps {
  current: number;
  onChange?: (step: number) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  completedSteps?: number[]; // 已完成的步骤索引数组
}

const WorkflowSteps: React.FC<WorkflowStepsProps> = ({
  current,
  onChange,
  className,
  style,
  disabled = false,
  completedSteps = [],
}) => {
  // 步骤定义
  const steps = [
    {
      title: "数据拉取",
      icon: <SettingOutlined />,
      description: (
        <div style={{ maxWidth: 280 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ color: "#1890ff", fontSize: 14 }}>
              配置API参数并拉取数据
            </Text>
          </div>
          <div style={{ lineHeight: 1.6 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              • 设置API URL和请求参数
              <br />
              • 配置认证信息和请求头
              <br />
              • 选择拉取模式和分页设置
              <br />
              • 执行冒烟测试验证连接
              <br />• 开始正式数据拉取
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "字段标注",
      icon: <TagsOutlined />,
      description: (
        <div style={{ maxWidth: 280 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ color: "#52c41a", fontSize: 14 }}>
              为数据字段添加标注
            </Text>
          </div>
          <div style={{ lineHeight: 1.6 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              • 查看拉取到的数据字段
              <br />
              • 为每个字段添加中文标签
              <br />
              • 设置字段描述和含义
              <br />
              • 使用智能标注建议
              <br />• 验证标注完整性
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "数据分析",
      icon: <BarChartOutlined />,
      description: (
        <div style={{ maxWidth: 280 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ color: "#722ed1", fontSize: 14 }}>
              分析和可视化数据
            </Text>
          </div>
          <div style={{ lineHeight: 1.6 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              • 浏览和筛选数据表格
              <br />
              • 创建图表和可视化
              <br />
              • 执行数据统计分析
              <br />
              • 导出分析结果
              <br />• 保存分析配置
            </Text>
          </div>
        </div>
      ),
    },
  ];

  const handleStepClick = (stepIndex: number) => {
    if (onChange && !disabled) {
      onChange(stepIndex);
    }
  };

  const getStepStatus = (index: number) => {
    if (current === index) return "process";
    if (completedSteps.includes(index)) return "finish";
    return "wait";
  };

  const getStepColor = (index: number) => {
    if (current === index) return "#1890ff";
    if (completedSteps.includes(index)) return "#52c41a";
    return "#d9d9d9";
  };

  return (
    <Card
      className={className}
      style={{
        marginBottom: 16,
        background: "linear-gradient(135deg, #fafbfc 0%, #f0f2f5 100%)",
        border: "1px solid #e8e8e8",
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        ...style,
      }}
      bodyStyle={{ padding: "20px 24px" }}
    >
      <Steps
        current={current}
        size="default"
        items={steps.map((step, index) => ({
          title: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: onChange && !disabled ? "pointer" : "default",
                padding: "6px 12px",
                borderRadius: 8,
                transition: "all 0.2s ease",
                position: "relative",
              }}
              onClick={() => handleStepClick(index)}
              onMouseEnter={e => {
                if (onChange && !disabled) {
                  e.currentTarget.style.backgroundColor =
                    "rgba(24, 144, 255, 0.08)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={e => {
                if (onChange && !disabled) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <span
                style={{
                  marginRight: 8,
                  fontWeight: current === index ? 600 : 500,
                  color:
                    current === index
                      ? "#1890ff"
                      : completedSteps.includes(index)
                      ? "#52c41a"
                      : "#666",
                }}
              >
                {step.title}
              </span>

              {/* {completedSteps.includes(index) && (
                <Badge
                  count={
                    <CheckCircleOutlined
                      style={{ color: "#52c41a", fontSize: 12 }}
                    />
                  }
                  style={{ marginRight: 6 }}
                />
              )} */}

              <Popover
                content={step.description}
                title={null}
                trigger="hover"
                placement="bottom"
                overlayStyle={{ maxWidth: 320 }}
                overlayInnerStyle={{
                  padding: 16,
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                }}
                arrow={{ pointAtCenter: true }}
              >
                <InfoCircleOutlined
                  style={{
                    color: current === index ? "#1890ff" : "#bfbfbf",
                    fontSize: 14,
                    cursor: "help",
                    opacity: 0.8,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = "0.8";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                />
              </Popover>
            </div>
          ),
          icon: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: getStepColor(index),
                color:
                  current === index || completedSteps.includes(index)
                    ? "#fff"
                    : "#999",
                fontSize: 16,
                fontWeight: 500,
                transition: "all 0.3s ease",
                boxShadow:
                  current === index
                    ? "0 4px 12px rgba(24, 144, 255, 0.4)"
                    : completedSteps.includes(index)
                    ? "0 2px 8px rgba(82, 196, 26, 0.3)"
                    : "none",
                border: current === index ? "2px solid #fff" : "none",
                cursor: onChange && !disabled ? "pointer" : "default",
              }}
              onClick={() => handleStepClick(index)}
              onMouseEnter={e => {
                if (onChange && !disabled) {
                  e.currentTarget.style.transform = "scale(1.1)";
                }
              }}
              onMouseLeave={e => {
                if (onChange && !disabled) {
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              {completedSteps.includes(index) ? (
                <CheckCircleOutlined />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {index + 1}
                </span>
              )}
            </div>
          ),
          status: getStepStatus(index),
        }))}
      />
    </Card>
  );
};

export default WorkflowSteps;
