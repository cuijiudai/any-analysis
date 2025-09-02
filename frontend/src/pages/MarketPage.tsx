import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List, 
  Tag, 
  Button, 
  Input, 
  Typography, 
  Avatar,
  message
} from 'antd';
import { 
  CopyOutlined,
  SearchOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Text, Paragraph } = Typography;
const { Search } = Input;

interface MarketSession {
  id: string;
  title: string;
  description: string;
  tags: string[];
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  user: {
    username: string;
    nickname: string;
  };
}

const MarketPage: React.FC = () => {
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadMarketSessions();
  }, [searchText]);

  const loadMarketSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/market/sessions', {
        params: {
          search: searchText || undefined,
        },
      });
      console.log('数据市场 API 返回:', response.data);
      if (response.data.success) {
        const data = response.data.data;
        let items = [];
        
        if (data?.items) {
          items = data.items;
        } else if (Array.isArray(data)) {
          items = data;
        } else {
          console.warn('未知的数据结构:', data);
        }
        
        console.log('解析后的数据:', items);
        setSessions(items);
      }
    } catch (error) {
      console.error('加载数据市场失败:', error);
      message.error('加载数据市场失败');
    } finally {
      setLoading(false);
    }
  };



  const handleCopy = async (item: MarketSession) => {
    try {
      const response = await api.post(`/market/sessions/${item.id}/copy`);
      if (response.data.success) {
        message.success('复制成功，正在跳转...');
        const sessionId = response.data.data.sessionId;
        navigate(`/workflow/${sessionId}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '复制失败');
    }
  };



  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
        <Search
          placeholder="搜索数据集..."
          enterButton={<SearchOutlined />}
          style={{ width: 400 }}
          onSearch={setSearchText}
          allowClear
        />
      </div>
      
      <List
        loading={loading}
        grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={sessions}
        locale={{ emptyText: '暂无分享的数据集' }}
        renderItem={(item) => (
          <List.Item>
            <Card
              hoverable
              actions={[
                <Button 
                  type="text" 
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(item)}
                >
                  复制
                </Button>
              ]}
            >
              <Card.Meta
                avatar={<Avatar>{item.user?.nickname?.[0] || item.user?.username?.[0] || 'U'}</Avatar>}
                title={item.title}
                description={
                  <div>
                    <Paragraph ellipsis={{ rows: 2 }}>
                      {item.description}
                    </Paragraph>
                    <div style={{ marginTop: 8 }}>
                      {item.tags?.map(tag => (
                        <Tag key={tag} color="blue">{tag}</Tag>
                      ))}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      by {item.user?.nickname || item.user?.username || '匿名用户'}
                    </Text>
                  </div>
                }
              />
            </Card>
          </List.Item>
        )}
      />


    </div>
  );
};

export default MarketPage;