import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  Spin,
  Alert,
  Button,
  Space,
  Dropdown,
  Menu,
  message,
} from "antd";
import {
  DownloadOutlined,
  SettingOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

export interface ChartData {
  type: "line" | "bar" | "pie" | "scatter";
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  data: Array<{
    x: any;
    y: number;
    label?: string;
    category?: string;
  }>;
  categories?: string[];
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
  totalRecords: number;
}

export interface ChartConfig {
  sessionId: string;
  chartType: "line" | "bar" | "pie" | "scatter";
  xAxis: string;
  yAxis: string;
  xAxisAggregation?: "none" | "group" | "date_group" | "range";
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
  filters?: any[];
  title?: string;
  colorScheme?: string[];
  showLegend?: boolean;
  showDataLabels?: boolean;
}

interface ChartContainerProps {
  chartData?: ChartData;
  config?: ChartConfig;
  loading?: boolean;
  error?: string;
  height?: number;
  showToolbar?: boolean;
  onRefresh?: () => void;
  onSave?: () => void;
  onSettings?: () => void;
  onFullscreen?: () => void;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  chartData,
  config,
  loading = false,
  error,
  height = 400,
  showToolbar = true,
  onRefresh,
  onSave,
  onSettings,
  onFullscreen,
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const [chartOption, setChartOption] = useState<EChartsOption>({});

  useEffect(() => {
    if (chartData) {
      const option = generateEChartsOption(chartData, config);
      setChartOption(option);
    }
  }, [chartData, config]);

  const generateEChartsOption = (
    data: ChartData,
    config?: ChartConfig
  ): EChartsOption => {
    const baseOption: EChartsOption = {
      title: {
        text: data.title,
        left: "center",
        textStyle: {
          fontSize: 16,
          fontWeight: "bold",
        },
      },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (data.type === "pie") {
            return `${params.name}: ${params.value} (${params.percent}%)`;
          }
          return `${data.xAxisLabel}: ${params.name}<br/>${data.yAxisLabel}: ${params.value}`;
        },
      },
      legend: {
        show: config?.showLegend !== false,
        bottom: 10,
      },
      grid: {
        left: "4%",
        right: "4%",
        bottom: "10%",
        top: "10%",
        containLabel: true,
      },
    };

    switch (data.type) {
      case "line":
        return {
          ...baseOption,
          xAxis: {
            type: "category",
            name: data.xAxisLabel,
            nameLocation: "middle",
            nameGap: 30,
            data: data.data.map(item => item.label || item.x),
          },
          yAxis: {
            type: "value",
            name: data.yAxisLabel,
            nameLocation: "middle",
            nameGap: 50,
            nameRotate: 90,
          },
          series: [
            {
              name: data.yAxisLabel,
              type: "line",
              data: data.data.map(item => item.y),
              smooth: true,
              symbol: "circle",
              symbolSize: 6,
              lineStyle: {
                width: 2,
              },
              areaStyle: {
                opacity: 0.1,
              },
            },
          ],
        };

      case "bar":
        return {
          ...baseOption,
          xAxis: {
            type: "category",
            name: data.xAxisLabel,
            nameLocation: "middle",
            nameGap: 30,
            data: data.data.map(item => item.label || item.x),
            axisLabel: {
              rotate: data.data.length > 10 ? 45 : 0,
              interval: 0,
            },
          },
          yAxis: {
            type: "value",
            name: data.yAxisLabel,
            nameLocation: "middle",
            nameGap: 50,
            nameRotate: 90,
          },
          series: [
            {
              name: data.yAxisLabel,
              type: "bar",
              data: data.data.map(item => item.y),
              itemStyle: {
                borderRadius: [4, 4, 0, 0],
              },
              label: {
                show: config?.showDataLabels,
                position: "top",
              },
            },
          ],
        };

      case "pie":
        return {
          ...baseOption,
          tooltip: {
            trigger: "item",
            formatter: "{a} <br/>{b}: {c} ({d}%)",
          },
          series: [
            {
              name: data.title,
              type: "pie",
              radius: ["40%", "70%"],
              center: ["50%", "50%"],
              data: data.data.map(item => ({
                name: item.label || item.x,
                value: item.y,
              })),
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: "rgba(0, 0, 0, 0.5)",
                },
              },
              label: {
                show: config?.showDataLabels !== false,
                formatter: "{b}: {d}%",
              },
              labelLine: {
                show: config?.showDataLabels !== false,
              },
            },
          ],
        };

      case "scatter":
        return {
          ...baseOption,
          xAxis: {
            type: "value",
            name: data.xAxisLabel,
            scale: true,
          },
          yAxis: {
            type: "value",
            name: data.yAxisLabel,
            scale: true,
          },
          series: [
            {
              name: `${data.xAxisLabel} vs ${data.yAxisLabel}`,
              type: "scatter",
              data: data.data.map(item => [item.x, item.y]),
              symbolSize: 8,
              itemStyle: {
                opacity: 0.7,
              },
            },
          ],
        };

      default:
        return baseOption;
    }
  };

  const handleExport = (format: "png" | "jpg" | "svg") => {
    if (chartRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      // 将 'jpg' 转换为 ECharts 期望的 'jpeg'
      const echartsFormat = format === "jpg" ? "jpeg" : format;
      const dataURL = chartInstance.getDataURL({
        type: echartsFormat as "png" | "svg" | "jpeg",
        pixelRatio: 2,
        backgroundColor: "#fff",
      });

      // 创建下载链接
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `chart_${Date.now()}.${format}`;
      link.click();

      message.success(`图表已导出为 ${format.toUpperCase()} 格式`);
    }
  };

  const exportMenu = (
    <Menu
      items={[
        {
          key: "png",
          label: "PNG 图片",
          onClick: () => handleExport("png"),
        },
        {
          key: "jpg",
          label: "JPG 图片",
          onClick: () => handleExport("jpg"),
        },
        {
          key: "svg",
          label: "SVG 矢量图",
          onClick: () => handleExport("svg"),
        },
      ]}
    />
  );

  if (error) {
    return (
      <Card style={{ height }}>
        <Alert
          message="图表加载失败"
          description={error}
          type="error"
          showIcon
          action={
            onRefresh && (
              <Button size="small" onClick={onRefresh}>
                重试
              </Button>
            )
          }
        />
      </Card>
    );
  }

  return (
    <Card
      style={{ height }}
      bodyStyle={{ height: "100%", padding: showToolbar ? "16px" : "8px" }}
      title={
        showToolbar && chartData ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{chartData.title}</span>
            <Space>
              {onRefresh && (
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  title="刷新图表"
                />
              )}
              <Dropdown overlay={exportMenu} trigger={["click"]}>
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  title="导出图表"
                />
              </Dropdown>
              {onSettings && (
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={onSettings}
                  title="图表设置"
                />
              )}
              {onFullscreen && (
                <Button
                  type="text"
                  icon={<FullscreenOutlined />}
                  onClick={onFullscreen}
                  title="全屏显示"
                />
              )}
            </Space>
          </div>
        ) : undefined
      }
    >
      <div
        style={{
          height: showToolbar ? "calc(100% - 40px)" : "100%",
          position: "relative",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              zIndex: 10,
            }}
          >
            <Spin size="large" tip="正在生成图表..." />
          </div>
        )}

        {chartData && !loading && (
          <ReactECharts
            ref={chartRef}
            option={chartOption}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
            notMerge={true}
            lazyUpdate={true}
          />
        )}

        {!chartData && !loading && (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: 16,
            }}
          >
            请选择图表配置以生成图表
          </div>
        )}
      </div>

      {chartData && showToolbar && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 0",
            borderTop: "1px solid #f0f0f0",
            fontSize: 12,
            color: "#666",
            textAlign: "center",
          }}
        >
          数据点: {chartData.data.length} | 总记录: {chartData.totalRecords}
          {chartData.aggregation && ` | 聚合方式: ${chartData.aggregation}`}
        </div>
      )}
    </Card>
  );
};

export default ChartContainer;
