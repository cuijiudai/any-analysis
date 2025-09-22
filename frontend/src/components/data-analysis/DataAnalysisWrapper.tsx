import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Typography,
  Badge,
  Space,
  Button,
  Divider,
  message,
  Modal,
  Tabs,
} from "antd";
import {
  BarChartOutlined,
  TableOutlined,
  DownloadOutlined,
  SettingOutlined,
  PlusOutlined,
  DashboardOutlined,
  ClearOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from "@ant-design/icons";
import { DataTable, FilterCondition } from "./DataTable";
import { ChartContainer, ChartData, ChartConfig } from "./ChartContainer";
import { ChartConfigModal } from "./ChartConfigModal";
import { ChartManagement } from "./ChartManagement";
import { DataFilterPanel } from "./DataFilterPanel";
import { FieldInfo } from "../../types";
import api from "../../services/api";

const { Title, Text } = Typography;

interface SavedChart {
  id: string;
  sessionId: string;
  name: string;
  chartType: "line" | "bar" | "pie" | "scatter";
  xAxis: string;
  yAxis: string;
  aggregation?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

interface DataAnalysisWrapperProps {
  sessionId: string;
  onBack?: () => void;
  onSettings?: () => void;
}

export const DataAnalysisWrapper: React.FC<DataAnalysisWrapperProps> = ({
  sessionId,
  onBack,
  onSettings,
}) => {
  const [activeTab, setActiveTab] = useState<"table" | "management">("table");
  const [chartViewVisible, setChartViewVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartConfigVisible, setChartConfigVisible] = useState(false);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [currentChart, setCurrentChart] = useState<ChartData | null>(null);
  const [currentChartConfig, setCurrentChartConfig] =
    useState<ChartConfig | null>(null);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const [chartLoading, setChartLoading] = useState(false);

  const [editingChart, setEditingChart] = useState<SavedChart | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadFields();
      loadSavedCharts();
    }
  }, [sessionId]);

  const loadFields = async () => {
    try {
      // 从字段标注API获取字段信息
      const response = await api.get(`/field-annotation/fields/${sessionId}`);
      if (response.data.success) {
        const fieldsData = response.data.fields || [];
        const formattedFields: FieldInfo[] = fieldsData.map((field: any) => ({
          name: field.name,
          label: field.annotation?.label || field.suggestedLabel || field.name,
          type: field.type,
          suggestedLabel: field.suggestedLabel || field.name,
          sampleValues: field.sampleValues || [],
          annotation: field.annotation,
        }));
        setFields(formattedFields);
      } else {
        throw new Error(response.data.error || "获取字段信息失败");
      }
    } catch (error) {
      console.error("Failed to load fields:", error);
      message.error("获取字段信息失败");
      // 如果API失败，使用空数组而不是模拟数据
      setFields([]);
    }
  };

  const loadSavedCharts = async () => {
    try {
      const response = await api.get(`/data-analysis/chart/saved/${sessionId}`);
      if (response.data.success) {
        // Charts loaded successfully
      }
    } catch (error) {
      console.error("Failed to load saved charts:", error);
    }
  };

  const handleGenerateChart = async (config: ChartConfig) => {
    // 检查是否有筛选条件或数据
    if (totalFilteredCount === 0) {
      message.warning("请先在表格视图中筛选数据，然后再创建图表");
      setActiveTab("table");
      return;
    }

    setChartLoading(true);
    try {
      // 传递筛选条件而不是当前页数据
      const chartConfig = {
        ...config,
        filters: filters.length > 0 ? filters : undefined,
      };

      const response = await api.post(
        "/data-analysis/chart/generate",
        chartConfig
      );
      if (response.data.success) {
        setCurrentChart(response.data.chartData);
        setCurrentChartConfig(config);
        setChartViewVisible(true);
        message.success(`图表生成成功！基于 ${totalFilteredCount} 条筛选数据`);
      }
    } catch (error) {
      console.error("Failed to generate chart:", error);
      message.error("图表生成失败");
    } finally {
      setChartLoading(false);
    }
  };

  const handleSaveChart = async (config: ChartConfig & { name: string }) => {
    try {
      const response = await api.post("/data-analysis/chart/save", config);
      if (response.data.success) {
        message.success("图表配置已保存");
      }
    } catch (error) {
      console.error("Failed to save chart:", error);
      message.error("保存图表配置失败");
    }
  };

  const handleExportData = async () => {
    try {
      const response = await api.post("/data-analysis/export", {
        sessionId,
        filters: filters.length > 0 ? filters : undefined,
      });
      if (response.data.success) {
        // 创建下载链接
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `data_export_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        message.success("数据导出成功");
      }
    } catch (error) {
      console.error("Failed to export data:", error);
      message.error("数据导出失败");
    }
  };

  // 处理数据变化
  const handleDataChange = useCallback((data: any[], total?: number) => {
    setFilteredData(data);
    if (total !== undefined) {
      setTotalFilteredCount(total);
    }
    setTableLoading(false);
  }, []);

  // 应用筛选条件
  const handleApplyFilters = () => {
    setTableLoading(true);
    // DataTable 组件会通过 useEffect 监听 filters 变化并重新加载数据
  };

  const tabItems = [
    {
      key: "table",
      label: (
        <span>
          <TableOutlined style={{ marginRight: 6 }} />
          表格视图
        </span>
      ),
      children: (
        <>
          {/* 筛选面板 */}
          <DataFilterPanel
            sessionId={sessionId}
            fields={fields}
            filters={filters}
            onFiltersChange={setFilters}
            onApplyFilters={handleApplyFilters}
            loading={tableLoading}
          />

          {/* 数据表格 */}
          <DataTable
            sessionId={sessionId}
            height={500}
            showToolbar={true}
            showPagination={true}
            defaultPageSize={20}
            filters={filters}
            onDataChange={handleDataChange}
            onRowSelect={setSelectedRows}
            onFiltersChange={setFilters}
            createChartButton={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (totalFilteredCount === 0) {
                    message.warning("请先筛选数据，然后再创建图表");
                  } else {
                    setChartConfigVisible(true);
                  }
                }}
              >
                创建图表{totalFilteredCount > 0 && ` (${totalFilteredCount})`}
              </Button>
            }
          />
        </>
      ),
    },
    {
      key: "management",
      label: (
        <span>
          <DashboardOutlined style={{ marginRight: 6 }} />
          图表管理
        </span>
      ),
      children: (
        <ChartManagement
          sessionId={sessionId}
          onLoadChart={(chartData, config) => {
            setCurrentChart(chartData);
            setCurrentChartConfig(config);
            setChartViewVisible(true);
          }}
          onEditChart={chart => {
            setEditingChart(chart);
            setChartConfigVisible(true);
          }}
        />
      ),
    },
  ];

  return (
    <div className="data-analysis-wrapper">
      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as "table" | "management")}
        items={tabItems}
        size="large"
        style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          padding: "0 16px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        }}
      />

      {/* 图表配置模态框 */}
      <ChartConfigModal
        visible={chartConfigVisible}
        sessionId={sessionId}
        fields={fields}
        filteredData={filteredData}
        totalCount={totalFilteredCount}
        editingChart={editingChart}
        onClose={() => {
          setChartConfigVisible(false);
          setEditingChart(null);
        }}
        onGenerate={handleGenerateChart}
        onSave={handleSaveChart}
      />

      {/* 图表查看模态框 */}
      <Modal
        title={currentChartConfig?.title || "图表查看"}
        open={chartViewVisible}
        onCancel={() => {
          setChartViewVisible(false);
          setIsFullscreen(false);
        }}
        width={isFullscreen ? "100vw" : "90vw"}
        style={
          isFullscreen
            ? { top: 0, maxWidth: "none", margin: 0, padding: 0 }
            : { top: 20 }
        }
        bodyStyle={isFullscreen ? { padding: 0, height: "100vh" } : {}}
        footer={null}
      >
        <div style={{ position: "relative" }}>
          <Button
            type="text"
            icon={
              isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
            }
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 1000,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              border: "1px solid #d9d9d9",
            }}
          />
          <ChartContainer
            chartData={currentChart || undefined}
            config={currentChartConfig || undefined}
            loading={chartLoading}
            height={
              isFullscreen
                ? window.innerHeight - 100
                : Math.max(600, window.innerHeight - 200)
            }
            showToolbar={false}
          />
        </div>
      </Modal>
    </div>
  );
};

export default DataAnalysisWrapper;
