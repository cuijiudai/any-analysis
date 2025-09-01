import React from 'react';
import { Table, Card, Typography, Tag, Empty, Tooltip, Space, Button } from 'antd';
import { EyeOutlined, DatabaseOutlined, TagsOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface FetchResultTableProps {
  data: any[];
  loading?: boolean;
  title?: string;
  showActions?: boolean;
  mode?: 'preview' | 'formal'; // 新增模式属性：预览模式或正式拉取模式
  sessionId?: string; // 新增会话ID，用于字段标注跳转
  onViewComplete?: () => void;
  onBackToList?: () => void;
  onFieldAnnotation?: (sessionId: string) => void; // 新增字段标注回调
}

const FetchResultTable: React.FC<FetchResultTableProps> = ({
  data,
  loading = false,
  title = "数据预览",
  showActions = true,
  mode = 'preview',
  sessionId,
  onViewComplete,
  onBackToList,
  onFieldAnnotation,
}) => {
  const renderDataTable = () => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <Empty
          description="暂无数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 动态生成表格列
    const sampleItem = data[0];
    if (!sampleItem || typeof sampleItem !== 'object') {
      return (
        <Empty
          description="数据格式不正确"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 过滤掉系统字段，显示所有业务字段
    const businessFields = Object.keys(sampleItem).filter(key => 
      !['id', 'session_id', 'page_number', 'data_index', 'created_at'].includes(key)
    );

    const columns = businessFields.map(key => ({
      title: key,
      dataIndex: key,
      key,
      width: 150,
      sorter: false, // 禁用排序
      ellipsis: {
        showTitle: false,
      },
      render: (value: any) => {
        if (value === null || value === undefined) {
          return <Text type="secondary">-</Text>;
        }
        if (typeof value === 'boolean') {
          return <Tag color={value ? 'success' : 'default'}>{String(value)}</Tag>;
        }
        if (typeof value === 'object') {
          const jsonStr = JSON.stringify(value);
          return (
            <Tooltip placement="topLeft" title={jsonStr}>
              <Text code>
                {jsonStr}
              </Text>
            </Tooltip>
          );
        }
        const strValue = String(value);
        return (
          <Tooltip placement="topLeft" title={strValue}>
            <span>{strValue}</span>
          </Tooltip>
        );
      },
    }));

    const dataSource = data
      .filter(item => item && typeof item === 'object')
      .map((item, index) => ({
        ...item,
        key: item.id || index,
      }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: false, // 禁用快速跳转（搜索）
          showTotal: undefined, // 禁用记录数显示
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        scroll={{ 
          x: columns.length * 150, // 根据字段数量动态计算宽度，支持横向滚动
          y: 400 
        }}
        size="small"
        loading={loading}
      />
    );
  };

  return (
    <Card 
      title={
        <Space>
          <DatabaseOutlined />
          {title}
        </Space>
      }
      extra={
        showActions && (
          <Space>
            {mode === 'formal' ? (
              // 正式拉取模式：显示字段标注按钮
              onFieldAnnotation && sessionId && (
                <Button 
                  type="primary"
                  icon={<TagsOutlined />}
                  onClick={() => onFieldAnnotation(sessionId)}
                >
                  字段标注
                </Button>
              )
            ) : (
              // 预览模式：显示原有按钮
              <>
                {onViewComplete && (
                  <Button 
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={onViewComplete}
                  >
                    查看完整数据
                  </Button>
                )}
                {onBackToList && (
                  <Button onClick={onBackToList}>
                    返回会话列表
                  </Button>
                )}
              </>
            )}
          </Space>
        )
      }
    >
      {renderDataTable()}
    </Card>
  );
};

export default FetchResultTable;