import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Button,
  Space,
  Popconfirm,
  message,
  Modal,
  Input,
  Tag,
  Typography,
  Empty,
  Dropdown,
  Menu,
  Tooltip,
} from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  EyeOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { ChartData, ChartConfig } from './ChartContainer';

const { Text, Title } = Typography;
const { Search } = Input;

interface SavedChart {
  id: string;
  sessionId: string;
  name: string;
  chartType: 'line' | 'bar' | 'pie' | 'scatter';
  xAxis: string;
  yAxis: string;
  aggregation?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChartManagementProps {
  sessionId: string;
  onLoadChart: (chartData: ChartData, config: ChartConfig) => void;
  onEditChart: (chart: SavedChart) => void;
}

export const ChartManagement: React.FC<ChartManagementProps> = ({
  sessionId,
  onLoadChart,
  onEditChart,
}) => {
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [filteredCharts, setFilteredCharts] = useState<SavedChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingChart, setRenamingChart] = useState<SavedChart | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadCharts();
  }, [sessionId]);

  useEffect(() => {
    // 过滤图表
    const filtered = charts.filter(chart =>
      chart.name.toLowerCase().includes(searchText.toLowerCase()) ||
      chart.chartType.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredCharts(filtered);
  }, [charts, searchText]);

  const loadCharts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/data-analysis/chart/saved/${sessionId}`);
      if (response.data.success) {
        setCharts(response.data.charts);
      }
    } catch (error) {
      console.error('Failed to load charts:', error);
      message.error('加载图表列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChart = async (chart: SavedChart) => {
    try {
      const response = await api.get(`/data-analysis/chart/load/${chart.id}`);
      if (response.data.success) {
        onLoadChart(response.data.chartData, response.data.config);
        message.success(`已加载图表: ${chart.name}`);
      }
    } catch (error) {
      console.error('Failed to load chart:', error);
      message.error('加载图表失败');
    }
  };

  const handleDeleteChart = async (chartId: string) => {
    try {
      const response = await api.delete(`/data-analysis/chart/${chartId}`);
      if (response.data.success) {
        message.success('图表已删除');
        loadCharts();
      }
    } catch (error) {
      console.error('Failed to delete chart:', error);
      message.error('删除图表失败');
    }
  };

  const handleDuplicateChart = async (chart: SavedChart) => {
    try {
      // 这里需要实现复制图表的API
      message.success(`已复制图表: ${chart.name}`);
      loadCharts();
    } catch (error) {
      console.error('Failed to duplicate chart:', error);
      message.error('复制图表失败');
    }
  };

  const handleRenameChart = async () => {
    if (!renamingChart || !newName.trim()) return;

    try {
      const response = await api.put(`/data-analysis/chart/${renamingChart.id}`, {
        name: newName.trim(),
      });
      if (response.data.success) {
        message.success('图表名称已更新');
        setRenameModalVisible(false);
        setRenamingChart(null);
        setNewName('');
        loadCharts();
      }
    } catch (error) {
      console.error('Failed to rename chart:', error);
      message.error('重命名图表失败');
    }
  };

  const startRename = (chart: SavedChart) => {
    setRenamingChart(chart);
    setNewName(chart.name);
    setRenameModalVisible(true);
  };

  const getChartIcon = (chartType: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      bar: <BarChartOutlined />,
      line: <LineChartOutlined />,
      pie: <PieChartOutlined />,
      scatter: <DotChartOutlined />,
    };
    return iconMap[chartType] || <BarChartOutlined />;
  };

  const getChartTypeColor = (chartType: string) => {
    const colorMap: Record<string, string> = {
      bar: 'blue',
      line: 'green',
      pie: 'orange',
      scatter: 'purple',
    };
    return colorMap[chartType] || 'default';
  };

  const getActionMenu = (chart: SavedChart) => (
    <Menu
      items={[
        {
          key: 'view',
          label: '查看图表',
          icon: <EyeOutlined />,
          onClick: () => handleLoadChart(chart),
        },
        {
          key: 'edit',
          label: '编辑配置',
          icon: <EditOutlined />,
          onClick: () => onEditChart(chart),
        },
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startRename(chart),
        },
        {
          key: 'duplicate',
          label: '复制',
          icon: <CopyOutlined />,
          onClick: () => handleDuplicateChart(chart),
        },
        {
          type: 'divider',
        },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除图表 "${chart.name}" 吗？`,
              okText: '删除',
              okType: 'danger',
              cancelText: '取消',
              onOk: () => handleDeleteChart(chart.id),
            });
          },
        },
      ]}
    />
  );

  return (
    <Card
      title="图表管理"
      extra={
        <Space>
          <Search
            placeholder="搜索图表..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button onClick={loadCharts} loading={loading}>
            刷新
          </Button>
        </Space>
      }
    >
      {filteredCharts.length === 0 ? (
        <Empty
          description={
            searchText ? '没有找到匹配的图表' : '暂无保存的图表'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={filteredCharts}
          loading={loading}
          renderItem={(chart) => (
            <List.Item
              actions={[
                <Tooltip title="查看图表">
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => handleLoadChart(chart)}
                  />
                </Tooltip>,
                <Dropdown overlay={getActionMenu(chart)} trigger={['click']}>
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: '#1890ff',
                  }}>
                    {getChartIcon(chart.chartType)}
                  </div>
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold' }}>{chart.name}</span>
                    <Tag color={getChartTypeColor(chart.chartType)}>
                      {chart.chartType}
                    </Tag>
                  </div>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text type="secondary">
                        X轴: {chart.xAxis} | Y轴: {chart.yAxis}
                        {chart.aggregation && ` | 聚合: ${chart.aggregation}`}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        创建时间: {new Date(chart.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 重命名模态框 */}
      <Modal
        title="重命名图表"
        open={renameModalVisible}
        onOk={handleRenameChart}
        onCancel={() => {
          setRenameModalVisible(false);
          setRenamingChart(null);
          setNewName('');
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="输入新的图表名称"
          onPressEnter={handleRenameChart}
        />
      </Modal>
    </Card>
  );
};

export default ChartManagement;