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
  Modal,
  Form,
} from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShareAltOutlined,
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
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DataSession | null>(
    null
  );
  const [form] = Form.useForm();

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

  // 分享会话
  const handleShare = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    setSelectedSession(session || null);
    setShareModalVisible(true);
    form.setFieldsValue({ 
      sessionId,
      title: session?.name || ''
    });
  };

  // 取消分享
  const handleCancelShare = async (sessionId: string) => {
    try {
      const response = await api.post(`/market/cancel/${sessionId}`);
      if (response.data.success) {
        message.success("取消分享成功");
        loadSessions(pagination.current, pagination.pageSize);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        message.error("请先登录");
        navigate("/login");
      } else {
        message.error(error.response?.data?.message || "取消分享失败");
      }
    }
  };

  // 提交分享
  const handleShareSubmit = async (values: any) => {
    try {
      const response = await api.post("/market/share", values);
      if (response.data.success) {
        message.success("分享成功");
        setShareModalVisible(false);
        form.resetFields();
        loadSessions(pagination.current, pagination.pageSize);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        message.error("请先登录");
        navigate("/login");
      } else {
        message.error(error.response?.data?.message || "分享失败");
      }
    }
  };

  // 状态标签渲染
  const renderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      "unfetched": { color: "blue", text: "未拉取" },
      "fetched": { color: "processing", text: "已拉取" },
      "analyzed": { color: "success", text: "已分析" },
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
      width: 160,
      render: (_: any, record: DataSession) => (
        <Space size="small">
          {record.isShared ? (
            <Popconfirm
              title="确定要取消分享吗？"
              description="取消后该数据集将不在数据市场展示。"
              onConfirm={() => handleCancelShare(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small">
                取消分享
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<ShareAltOutlined />}
              onClick={() => handleShare(record.id)}
            >
              分享
            </Button>
          )}
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
        </Space>
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
            <Option value="unfetched">未拉取</Option>
            <Option value="fetched">已拉取</Option>
            <Option value="analyzed">已分析</Option>
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

      {/* 分享对话框 */}
      <Modal
        title="分享会话到数据市场"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleShareSubmit} layout="vertical">
          <Form.Item name="sessionId" style={{ display: "none" }}>
            <Input type="hidden" />
          </Form.Item>

          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="为你的数据集起个标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: "请输入描述" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="描述你的数据集内容、来源和用途"
            />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="添加标签（如：金融、电商、API等）"
              tokenSeparators={[","]}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setShareModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                分享
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SessionListPage;
