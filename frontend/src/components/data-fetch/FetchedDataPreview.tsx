import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Card,
  Pagination,
  Spin,
  Alert,
  Input,
  Button,
  Space,
  Typography,
  Select,
  Tooltip,
  Tag,
  Dropdown,
  Menu,
  Modal,
  message,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FilterOutlined,
  EyeOutlined,
  ColumnHeightOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import api from "../../services/api";

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface FetchedDataPreviewProps {
  sessionId: string;
  visible?: boolean;
  height?: number;
}

interface DataRecord {
  [key: string]: any;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

interface ColumnFilter {
  field: string;
  operator: "contains" | "equals" | "not_equals" | "greater_than" | "less_than";
  value: string;
}

interface DataStats {
  totalRecords: number;
  totalFields: number;
  tableSize: string;
  created: string;
}

const FetchedDataPreview: React.FC<FetchedDataPreviewProps> = ({
  sessionId,
  visible = true,
  height = 400,
}) => {
  const [data, setData] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
  });
  const [searchText, setSearchText] = useState("");
  const [columns, setColumns] = useState<any[]>([]);
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [tableSize, setTableSize] = useState<"small" | "middle" | "large">(
    "small"
  );
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);

  // 加载数据统计
  const loadDataStats = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await api.get(`/data-fetch/stats/${sessionId}`);
      if (response.data.success) {
        setDataStats(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load data stats:", error);
    }
  }, [sessionId]);

  // 加载数据
  const loadData = useCallback(
    async (
      page: number = 1,
      pageSize: number = 20,
      search?: string,
      columnFilters?: ColumnFilter[]
    ) => {
      if (!sessionId) return;

      setLoading(true);
      setError(null);

      try {
        const params: any = {
          page,
          pageSize,
        };

        if (search) {
          params.search = search;
        }

        if (columnFilters && columnFilters.length > 0) {
          params.filters = JSON.stringify(columnFilters);
        }

        const response = await api.get(`/data-fetch/data/${sessionId}`, {
          params,
        });

        if (response.data.success) {
          const { data: records, pagination: paginationInfo } =
            response.data.data;

          setData(records);
          setPagination(paginationInfo);

          // 动态生成表格列
          if (records.length > 0) {
            generateColumns(records[0]);
          }
        } else {
          setError(response.data.error || "加载数据失败");
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || "网络错误");
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  // 动态生成表格列
  const generateColumns = (sampleRecord: DataRecord) => {
    const systemFields = ["id", "created_at", "updated_at"];
    const cols = Object.keys(sampleRecord)
      .filter(key => !systemFields.includes(key))
      .map(key => ({
        title: (
          <Space>
            <span>{key}</span>
            <Tooltip title="查看字段详情">
              <InfoCircleOutlined
                style={{ cursor: "pointer", color: "#1890ff", fontSize: 12 }}
                onClick={() => showColumnDetails(key, sampleRecord[key])}
              />
            </Tooltip>
          </Space>
        ),
        dataIndex: key,
        key,
        ellipsis: {
          showTitle: false,
        },
        sorter: false, // 禁用排序
        width: 150,
        // 移除搜索功能
        render: (value: any, record: DataRecord) => {
          if (value === null || value === undefined) {
            return <Text type="secondary">-</Text>;
          }

          if (typeof value === "boolean") {
            return (
              <Tag color={value ? "green" : "red"}>{value ? "是" : "否"}</Tag>
            );
          }

          if (typeof value === "object") {
            return (
              <Tooltip title={JSON.stringify(value, null, 2)}>
                <Text
                  code
                  style={{ cursor: "pointer" }}
                  onClick={() => showRecordDetail(record)}
                >
                  {JSON.stringify(value).substring(0, 30)}...
                </Text>
              </Tooltip>
            );
          }

          const strValue = String(value);

          // 检测特殊类型
          if (strValue.match(/^https?:\/\//)) {
            return (
              <a href={strValue} target="_blank" rel="noopener noreferrer">
                {strValue.length > 30
                  ? `${strValue.substring(0, 30)}...`
                  : strValue}
              </a>
            );
          }

          if (strValue.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
            return <Text copyable>{strValue}</Text>;
          }

          if (strValue.length > 50) {
            return (
              <Tooltip title={strValue}>
                <Text
                  ellipsis
                  style={{ cursor: "pointer", maxWidth: 120 }}
                  onClick={() => showRecordDetail(record)}
                >
                  {strValue}
                </Text>
              </Tooltip>
            );
          }

          return (
            <span
              style={{ cursor: "pointer" }}
              onClick={() => showRecordDetail(record)}
            >
              {strValue}
            </span>
          );
        },
      }));

    // 添加操作列
    cols.push({
      title: "操作",
      key: "action",
      fixed: "right",
      width: 80,
      render: (_: any, record: DataRecord) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => showRecordDetail(record)}
        >
          详情
        </Button>
      ),
    } as any);

    setColumns(cols);
  };

  // 显示列详情
  const showColumnDetails = (columnName: string, sampleValue: any) => {
    Modal.info({
      title: `字段详情: ${columnName}`,
      content: (
        <div>
          <p>
            <strong>字段名:</strong> {columnName}
          </p>
          <p>
            <strong>数据类型:</strong> {typeof sampleValue}
          </p>
          <p>
            <strong>示例值:</strong>
          </p>
          <div
            style={{
              background: "#f5f5f5",
              padding: 8,
              borderRadius: 4,
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {typeof sampleValue === "object"
                ? JSON.stringify(sampleValue, null, 2)
                : String(sampleValue)}
            </pre>
          </div>
        </div>
      ),
      width: 600,
    });
  };

  // 显示记录详情
  const showRecordDetail = (record: DataRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // 处理分页变化
  const handlePaginationChange = (page: number, pageSize?: number) => {
    loadData(page, pageSize || pagination.pageSize, searchText, filters);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    loadData(1, pagination.pageSize, value, filters);
  };

  // 刷新数据
  const handleRefresh = () => {
    loadData(pagination.page, pagination.pageSize, searchText, filters);
    loadDataStats();
  };

  // 导出数据
  const handleExport = async () => {
    try {
      message.loading("正在导出数据...", 0);

      const response = await api.get(`/data-fetch/export/${sessionId}`, {
        params: {
          format: "csv",
          filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `data_${sessionId}_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      message.destroy();
      message.success("数据导出成功");
    } catch (error) {
      message.destroy();
      message.error("数据导出失败");
    }
  };

  // 表格大小菜单
  const sizeMenu = (
    <Menu onClick={({ key }) => setTableSize(key as any)}>
      <Menu.Item key="small">紧凑</Menu.Item>
      <Menu.Item key="middle">默认</Menu.Item>
      <Menu.Item key="large">宽松</Menu.Item>
    </Menu>
  );

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  // 初始加载
  useEffect(() => {
    if (visible && sessionId) {
      loadData();
      loadDataStats();
    }
  }, [sessionId, visible, loadData, loadDataStats]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        {/* 数据统计 */}
        {dataStats && (
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
        )}
      </Card>

      <Card
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              拉取数据预览
            </Title>
            <Space>
              <Search
                placeholder="全局搜索..."
                allowClear
                onSearch={handleSearch}
                style={{ width: 200 }}
                enterButton={<SearchOutlined />}
              />
              <Dropdown overlay={sizeMenu} trigger={["click"]}>
                <Button icon={<ColumnHeightOutlined />} />
              </Dropdown>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={pagination.total === 0}
              >
                导出
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </div>
        }
        size="small"
      >
        {error && (
          <Alert
            message="加载失败"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" onClick={handleRefresh}>
                重试
              </Button>
            }
          />
        )}

        {selectedRowKeys.length > 0 && (
          <Alert
            message={`已选择 ${selectedRowKeys.length} 条记录`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                清除选择
              </Button>
            }
          />
        )}

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={data}
            pagination={false}
            scroll={{ x: true, y: height }}
            size={tableSize}
            rowKey="id"
            rowSelection={rowSelection}
            locale={{
              emptyText: loading ? "加载中..." : "暂无数据",
            }}
          />
        </Spin>

        {pagination.total > 0 && (
          <div style={{ marginTop: 16, textAlign: "right" }}>
            <Pagination
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              showSizeChanger
              showQuickJumper
              showTotal={undefined} // 禁用记录数显示
              onChange={handlePaginationChange}
              onShowSizeChange={handlePaginationChange}
              pageSizeOptions={["10", "20", "50", "100"]}
            />
          </div>
        )}
      </Card>

      {/* 记录详情弹窗 */}
      <Modal
        title="记录详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
        style={{ top: 20 }}
      >
        {selectedRecord && (
          <div style={{ maxHeight: 600, overflow: "auto" }}>
            {Object.entries(selectedRecord).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <Text strong>{key}: </Text>
                <div
                  style={{
                    marginTop: 4,
                    padding: 8,
                    background: "#f5f5f5",
                    borderRadius: 4,
                  }}
                >
                  {typeof value === "object" ? (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <Text copyable>{String(value)}</Text>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
};

export default FetchedDataPreview;
