import React, { useState, useEffect } from "react";
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Typography,
  Input,
  Select,
} from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { DataSession } from "../types";

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const SessionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DataSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 加载会话列表
  const loadSessions = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await api.get("/data-session", {
        params: {
          page,
          pageSize,
          search: searchText || undefined,
          status: statusFilter || undefined,
        },
      });

      if (response.data.success) {
        const data = response.data.data;
        const sessionsData = data?.sessions || [];

        // 确保数据是数组格式
        if (Array.isArray(sessionsData)) {
          setSessions(sessionsData);
          // 更新分页信息
          setPagination({
            current: data?.page || 1,
            pageSize: data?.pageSize || 10,
            total: data?.total || 0,
          });
        } else {
          console.error("Sessions data is not an array:", sessionsData);
          setSessions([]);
          message.error("数据格式错误");
        }
      } else {
        message.error("加载会话列表失败");
      }
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 删除会话
  const handleDelete = async (sessionId: string) => {
    try {
      const response = await api.delete(`/data-session/${sessionId}`);

      if (response.data.success) {
        message.success("会话删除成功");
        // 重新加载当前页
        loadSessions(pagination.current, pagination.pageSize);
      } else {
        message.error("删除失败");
      }
    } catch (error: any) {
      message.error(`删除失败: ${error.message}`);
    }
  };

  // 进入工作流页面
  const handleEnterWorkflow = (sessionId: string) => {
    navigate(`/workflow/${sessionId}`);
  };

  // 创建新会话
  const handleCreateNew = () => {
    navigate("/");
  };

  // 状态标签渲染
  const renderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      "configuring": { color: "blue", text: "配置中" },
      "fetching": { color: "processing", text: "拉取中" },
      "completed": { color: "success", text: "已完成" },
      "error": { color: "error", text: "错误" },
    };

    const config = statusMap[status] || { color: "default", text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: "会话名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, record: DataSession) => (
        <Button
          type="link"
          style={{
            padding: 0,
            height: "auto",
            fontWeight: 500,
            textAlign: "left",
            color: "#1890ff",
          }}
          onClick={() => handleEnterWorkflow(record.id)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: renderStatus,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: any, record: DataSession) => (
        <Popconfirm
          title="确定要删除这个会话吗？"
          description="删除后将无法恢复，包括所有相关数据。"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 初始加载
  useEffect(() => {
    loadSessions(1, pagination.pageSize); // 搜索或筛选时回到第一页
  }, [searchText, statusFilter]);

  return (
    <div style={{ padding: "24px" }}>
      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <Search
            placeholder="搜索会话名称..."
            allowClear
            style={{ width: 300 }}
            onSearch={setSearchText}
            enterButton={<SearchOutlined />}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            value={statusFilter || undefined}
            onChange={setStatusFilter}
          >
            <Option value="configuring">配置中</Option>
            <Option value="fetching">拉取中</Option>
            <Option value="completed">已完成</Option>
            <Option value="error">错误</Option>
          </Select>
        </Space>
      </Card>

      {/* 会话列表 */}
      <Card>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNew}
          >
            创建新会话
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              loadSessions(page, pageSize);
            },
            onShowSizeChange: (current, size) => {
              loadSessions(1, size); // 改变页面大小时回到第一页
            },
          }}
          locale={{
            emptyText: "暂无会话数据",
          }}
        />
      </Card>
    </div>
  );
};

export default SessionListPage;
