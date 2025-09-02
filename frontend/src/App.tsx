import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Layout, Menu, Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import MainWorkflowPage from "./pages/MainWorkflowPage";
import WorkflowPage from "./pages/WorkflowPage";
import DataViewPage from "./pages/DataViewPage";
import HistoryPage from "./pages/HistoryPage";
import SessionListPage from "./pages/SessionListPage";
import LoginPage from "./pages/LoginPage";
import MarketPage from "./pages/MarketPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

const { Header, Content } = Layout;

const AppHeader: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/sessions')) return 'sessions';
    if (path.startsWith('/market')) return 'market';
    return '';
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <Header
      style={{
        background: "#fff",
        borderBottom: "1px solid #e8e8e8",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: "20px", color: "#1890ff", marginRight: 24 }}>
          数据拉取与分析系统
        </h1>
        <Menu mode="horizontal" style={{ border: "none", flex: 1 }} selectedKeys={[getSelectedKey()]}>
          <Menu.Item key="home">
            <Link to="/">首页</Link>
          </Menu.Item>
          <Menu.Item key="sessions">
            <Link to="/sessions">会话列表</Link>
          </Menu.Item>
          <Menu.Item key="market">
            <Link to="/market">数据市场</Link>
          </Menu.Item>
        </Menu>
      </div>
      <div>
        {isAuthenticated ? (
          <Button 
            type="text" 
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            {user?.nickname || user?.username}
          </Button>
        ) : (
          <Button type="primary">
            <Link to="/login">登录</Link>
          </Button>
        )}
      </div>
    </Header>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Layout style={{ height: "100vh" }}>
      <AppHeader />
      <Content>
        <Routes>
          <Route path="/" element={<ProtectedRoute><MainWorkflowPage /></ProtectedRoute>} />
          <Route path="/fetch/:sessionId" element={<ProtectedRoute><MainWorkflowPage /></ProtectedRoute>} />
          <Route path="/view/:sessionId" element={<ProtectedRoute><DataViewPage /></ProtectedRoute>} />
          <Route path="/workflow/:sessionId" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
          <Route path="/sessions" element={<ProtectedRoute><SessionListPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/market" element={<MarketPage />} />
        </Routes>
      </Content>
      </Layout>
    </AuthProvider>
  );
};

export default App;
