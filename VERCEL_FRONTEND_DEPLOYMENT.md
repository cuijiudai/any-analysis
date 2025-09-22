# Vercel 前端部署指南

本指南将帮你将前端部署到 Vercel，后端部署到 Railway 或其他平台。

## 🎯 部署策略

- **前端**: Vercel (静态托管)
- **后端**: Railway/Render (Node.js 托管)
- **数据库**: PlanetScale/Neon/Railway (PostgreSQL)

## 🚀 快速部署步骤

### Step 1: 配置前端环境变量

在 Vercel 项目设置中添加：

```bash
REACT_APP_API_URL=https://your-backend.railway.app
```

### Step 2: 部署前端到 Vercel

1. **推送代码到 GitHub**:

   ```bash
   git add .
   git commit -m "Configure for Vercel frontend deployment"
   git push origin main
   ```

2. **在 Vercel 中导入项目**:

   - 访问 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "Import Project"
   - 选择你的 GitHub 仓库
   - 配置项目设置：
     - **Root Directory**: 留空 (项目根目录)
     - **Framework Preset**: 其他 (Other)
     - **Build Command**: `cd frontend && npm run build`
     - **Output Directory**: `frontend/build`
     - **Install Command**: `cd frontend && npm install`

3. **设置环境变量**:
   - 在项目设置中添加 `REACT_APP_API_URL`
   - 值为你的后端服务 URL

### Step 3: 部署后端到 Railway

1. **访问 [Railway](https://railway.app/)**
2. **创建新项目** -> "Deploy from GitHub repo"
3. **配置项目设置**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start:prod`
4. **设置环境变量**:
   ```bash
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=your-database-url
   JWT_SECRET=your-jwt-secret
   FRONTEND_URL=https://your-app.vercel.app
   ```

### Step 4: 配置数据库

#### 选项 A: Railway PostgreSQL

1. 在 Railway 项目中添加 PostgreSQL 插件
2. 环境变量会自动设置

#### 选项 B: PlanetScale

1. 创建 PlanetScale 数据库
2. 获取连接字符串并设置到 Railway

#### 选项 C: Neon

1. 创建 Neon 项目
2. 复制 DATABASE_URL 到 Railway

### Step 5: 运行数据库迁移

```bash
# 本地连接生产数据库运行迁移
export DATABASE_URL="your-production-database-url"
cd backend
npm run db:migrate
```

## 🔧 验证部署

1. **前端检查**:

   - 访问 Vercel 提供的 URL
   - 检查页面是否正常加载

2. **后端检查**:

   - 访问 `https://your-backend.railway.app/api/health`
   - 应该返回健康状态

3. **连接检查**:
   - 在前端尝试登录或其他 API 操作
   - 检查浏览器开发者工具的网络选项卡

## 🛠️ 故障排除

### 前端构建失败

```bash
# 本地测试构建
cd frontend
npm run build
```

### CORS 错误

确保后端 CORS 配置包含前端域名：

```typescript
app.enableCors({
  origin: ["http://localhost:3000", "https://your-app.vercel.app"],
  credentials: true,
});
```

### API 连接失败

1. 检查 `REACT_APP_API_URL` 环境变量
2. 确认后端服务正在运行
3. 检查网络请求在浏览器开发者工具中

## 📝 环境变量总结

### Vercel (前端)

```bash
REACT_APP_API_URL=https://your-backend.railway.app
```

### Railway (后端)

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
FRONTEND_URL=https://your-app.vercel.app
```

## 🎉 完成！

现在你的应用已经部署完成：

- 前端: `https://your-app.vercel.app`
- 后端: `https://your-backend.railway.app`

这种分离部署方式提供了更好的稳定性和性能！
