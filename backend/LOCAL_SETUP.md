# 本地开发环境设置

## 前置条件

### 1. 安装 PostgreSQL

**macOS (使用 Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. 创建 PostgreSQL 用户 (如果需要)

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 PostgreSQL 命令行中创建用户
CREATE USER cuijiudai WITH PASSWORD '';
ALTER USER cuijiudai CREATEDB;
\q
```

## 快速开始

### 1. 设置本地数据库
```bash
npm run db:setup-local
```

### 2. 运行数据库迁移
```bash
npm run db:migrate
```

### 3. 创建种子数据
```bash
npm run db:seed
```

### 4. 启动本地开发服务器
```bash
npm run dev:local
```

## 环境配置

项目包含两个环境配置文件：

- `.env` - 云数据库配置 (Neon PostgreSQL)
- `.env.local` - 本地数据库配置

### 本地配置 (.env.local)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=cuijiudai
DB_PASSWORD=
DB_DATABASE=data_fetch_analysis
DB_TYPE=postgres
NODE_ENV=development
PORT=3001
```

## 常用命令

```bash
# 使用本地数据库启动开发服务器
npm run dev:local

# 使用云数据库启动开发服务器
npm run start:dev

# 数据库操作
npm run db:migrate    # 运行迁移
npm run db:seed       # 创建种子数据
npm run db:reset      # 重置数据库
npm run db:drop       # 删除数据库
```

## 故障排除

### PostgreSQL 连接问题
1. 确保 PostgreSQL 服务正在运行
2. 检查用户名和密码是否正确
3. 确保数据库已创建

### 端口冲突
如果端口 3001 被占用，可以修改 `.env.local` 中的 `PORT` 值。