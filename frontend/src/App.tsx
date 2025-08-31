import React from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "antd";
import MainWorkflowPage from "./pages/MainWorkflowPage";
import WorkflowPage from "./pages/WorkflowPage";
import DataViewPage from "./pages/DataViewPage";
import HistoryPage from "./pages/HistoryPage";
import SessionListPage from "./pages/SessionListPage";

const { Header, Content } = Layout;

const App: React.FC = () => {
  return (
    <Layout style={{ height: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e8e8e8",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", color: "#1890ff" }}>
          数据拉取与分析系统
        </h1>
      </Header>
      <Content>
        <Routes>
          <Route path="/" element={<MainWorkflowPage />} />
          <Route path="/fetch/:sessionId" element={<MainWorkflowPage />} />
          <Route path="/view/:sessionId" element={<DataViewPage />} />
          <Route path="/workflow/:sessionId" element={<WorkflowPage />} />
          <Route path="/sessions" element={<SessionListPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </Content>
    </Layout>
  );
};

export default App;
