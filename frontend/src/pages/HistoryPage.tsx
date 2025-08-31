import React from 'react';
import { Card } from 'antd';

const HistoryPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card title="历史配置">
        <p>这里将显示所有历史的数据会话和配置</p>
      </Card>
    </div>
  );
};

export default HistoryPage;