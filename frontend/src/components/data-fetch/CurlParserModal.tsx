import React, { useState } from 'react';
import { Modal, Button, Input, message, Typography, Divider, Space, Tag } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { ParseCurlRequest, ParseCurlResponse } from '../../types';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface CurlParserModalProps {
  visible: boolean;
  onClose: () => void;
  onParsed: (config: any) => void;
}

const CurlParserModal: React.FC<CurlParserModalProps> = ({
  visible,
  onClose,
  onParsed,
}) => {
  const [curlCommand, setCurlCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [examples] = useState([
    {
      title: 'GET 请求示例',
      command: 'curl -X GET "https://api.example.com/users?page=1&size=20" -H "Authorization: Bearer token123" -H "Content-Type: application/json"',
    },
    {
      title: 'POST 请求示例',
      command: 'curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -d \'{"name": "John", "email": "john@example.com"}\'',
    },
    {
      title: '带认证的 GET 请求',
      command: 'curl -X GET "https://jsonplaceholder.typicode.com/posts" -H "Authorization: Bearer your-token-here"',
    },
  ]);

  const handleParse = async () => {
    if (!curlCommand.trim()) {
      message.error('请输入curl命令');
      return;
    }

    setLoading(true);
    try {
      const requestData: ParseCurlRequest = {
        curlCommand: curlCommand.trim(),
      };

      const response = await api.post('/data-fetch/parse-curl', requestData);
      
      if (response.data.success) {
        onParsed(response.data.data);
        onClose();
        message.success('Curl命令解析成功！');
      } else {
        message.error(response.data.error || '解析失败');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '解析过程中发生错误';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (command: string) => {
    setCurlCommand(command);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleClose = () => {
    setCurlCommand('');
    onClose();
  };

  return (
    <Modal
      title="Curl 命令解析"
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button 
          key="parse" 
          type="primary" 
          loading={loading}
          onClick={handleParse}
          disabled={!curlCommand.trim()}
        >
          解析并填充
        </Button>,
      ]}
      width={900}
      style={{ top: 20 }}
    >
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            粘贴您的curl命令，系统将自动解析URL、请求头等信息并填充到配置表单中
          </Text>
        </div>
        
        <TextArea
          value={curlCommand}
          onChange={(e) => setCurlCommand(e.target.value)}
          placeholder="请粘贴curl命令..."
          rows={6}
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            支持解析：URL、请求方法、请求头、查询参数等
          </Text>
        </div>

        <Divider />

        <Title level={5}>常用示例</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          {examples.map((example, index) => (
            <div key={index} style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <Tag color="blue">{example.title}</Tag>
              </div>
              <div
                style={{
                  backgroundColor: '#f6f6f6',
                  padding: 12,
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  cursor: 'pointer',
                  border: '1px solid #d9d9d9',
                  position: 'relative',
                }}
                onClick={() => handleExampleClick(example.command)}
              >
                <div style={{ paddingRight: 30 }}>
                  {example.command}
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(example.command);
                  }}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  点击使用此示例
                </Text>
              </div>
            </div>
          ))}
        </Space>

        <Divider />

        <div style={{ fontSize: 12, color: '#666' }}>
          <Title level={5} style={{ fontSize: 14 }}>支持的格式</Title>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>基本curl命令：<code>curl "https://api.example.com"</code></li>
            <li>指定方法：<code>curl -X POST "https://api.example.com"</code></li>
            <li>添加请求头：<code>curl -H "Authorization: Bearer token"</code></li>
            <li>POST数据：<code>curl -d '{`{"key": "value"}`}'</code></li>
            <li>查询参数：URL中的查询参数会自动识别</li>
            <li>多行命令：支持反斜杠换行的curl命令</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default CurlParserModal;