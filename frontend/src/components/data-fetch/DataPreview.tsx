import React from 'react';
import { Table, Card, Typography, Tag, Empty, Tooltip } from 'antd';
import { SmokeTestResponse } from '../../types';

const { Title, Text } = Typography;

interface DataPreviewProps {
  testResult?: SmokeTestResponse;
  loading?: boolean;
}

const DataPreview: React.FC<DataPreviewProps> = ({
  testResult,
  loading = false,
}) => {
  const renderDataTable = () => {
    if (!testResult?.data || !Array.isArray(testResult.data) || testResult.data.length === 0) {
      return (
        <Empty
          description="暂无数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 动态生成表格列
    const sampleItem = testResult.data[0];
    if (!sampleItem || typeof sampleItem !== 'object') {
      return (
        <Empty
          description="数据格式不正确"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 显示所有字段，不做限制
    const columns = Object.keys(sampleItem).map(key => ({
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
          return <Text type="secondary">null</Text>;
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

    const dataSource = testResult.data
      .filter(item => item && typeof item === 'object')
      .map((item, index) => ({
        ...item,
        key: index,
      }));

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showQuickJumper: false, // 禁用快速跳转（搜索）
          showTotal: undefined, // 禁用记录数显示
        }}
        scroll={{ 
          x: columns.length * 150, // 根据字段数量动态计算宽度
          y: 400 
        }}
        size="small"
        loading={loading}
      />
    );
  };

  const renderDataStructure = () => {
    if (!testResult?.dataStructure) {
      return null;
    }

    const { fields, totalFields } = testResult.dataStructure;

    return (
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>
          数据结构分析 
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {totalFields} 个字段
          </Tag>
        </Title>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {fields.map((field) => {
            const colorMap: Record<string, string> = {
              string: 'blue',
              number: 'green',
              integer: 'green',
              boolean: 'orange',
              array: 'purple',
              object: 'red',
              date: 'cyan',
              email: 'magenta',
              url: 'geekblue',
            };

            return (
              <Tag 
                key={field.name} 
                color={colorMap[field.type] || 'default'}
                style={{ margin: 0 }}
              >
                {field.name}: {field.type}
              </Tag>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card 
      title="数据预览"
      size="small"
      extra={
        testResult?.success && (
          <Text type="secondary">
            响应时间: {testResult.responseTime}ms
          </Text>
        )
      }
    >
      {testResult?.success ? (
        <div>
          {testResult.message && (
            <div style={{ marginBottom: 16 }}>
              <Text type="success">{testResult.message}</Text>
            </div>
          )}

          {renderDataStructure()}
          {renderDataTable()}
        </div>
      ) : testResult?.error ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="danger">{testResult.error}</Text>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="secondary">
            请先配置API并执行测试拉取
          </Text>
        </div>
      )}
    </Card>
  );
};

export default DataPreview;