import React, { useState } from "react";
import { Button, message } from "antd";
import { ExperimentOutlined } from "@ant-design/icons";
import api from "../../services/api";
import { SmokeTestRequest, SmokeTestResponse } from "../../types";

interface SmokeTestButtonProps {
  apiUrl: string;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
  dataPath?: string;
  disabled?: boolean;
  onTestComplete?: (result: SmokeTestResponse) => void;
  style?: React.CSSProperties;
}

const SmokeTestButton: React.FC<SmokeTestButtonProps> = ({
  apiUrl,
  headers,
  queryParams = {},
  dataPath,
  disabled = false,
  onTestComplete,
  style,
}) => {
  const [loading, setLoading] = useState(false);

  const handleSmokeTest = async () => {
    if (!apiUrl.trim()) {
      message.error("请输入API URL");
      return;
    }

    setLoading(true);

    try {
      const requestData: SmokeTestRequest = {
        apiUrl: apiUrl.trim(),
        headers,
        queryParams,
        ...(dataPath && { dataPath }),
      };

      const response = await api.post("/data-fetch/smoke-test", requestData);

      if (response.data.success) {
        const result: SmokeTestResponse = {
          success: true,
          data: response.data.data?.sampleData || [],
          message: response.data.data?.message || response.data.message,
          responseTime: response.data.data?.responseTime,
          dataStructure: response.data.data?.dataStructure,
        };

        message.success("冒烟测试成功！");
        onTestComplete?.(result);
      } else {
        const result: SmokeTestResponse = {
          success: false,
          data: [],
          error: response.data.error,
        };

        message.error(`冒烟测试失败: ${response.data.error}`);
        onTestComplete?.(result);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "网络错误";

      const result: SmokeTestResponse = {
        success: false,
        data: [],
        error: errorMessage,
      };

      message.error(`冒烟测试失败: ${errorMessage}`);
      onTestComplete?.(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="default"
      icon={<ExperimentOutlined />}
      onClick={handleSmokeTest}
      loading={loading}
      disabled={disabled || !apiUrl.trim()}
      style={style}
    >
      {loading ? "测试中..." : "测试拉取"}
    </Button>
  );
};

export default SmokeTestButton;
