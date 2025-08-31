#!/bin/bash

echo "🚀 开始设置数据拉取与分析系统..."

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js (版本 >= 16)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js版本过低，请升级到16或更高版本"
    exit 1
fi

# 检查MySQL
if ! command -v mysql &> /dev/null; then
    echo "⚠️  未检测到MySQL，请确保MySQL已安装并运行"
fi

echo "📦 安装项目依赖..."
npm install

echo "📦 安装后端依赖..."
cd backend && npm install && cd ..

echo "📦 安装前端依赖..."
cd frontend && npm install && cd ..

echo "🗄️  初始化数据库..."
echo "请确保MySQL服务正在运行，并且可以使用root用户（无密码）连接"
echo "如需修改数据库配置，请编辑 backend/.env 文件"

# 尝试创建数据库
mysql -u root -e "CREATE DATABASE IF NOT EXISTS data_fetch_analysis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || echo "⚠️  请手动创建数据库或检查MySQL连接"

# 运行数据库迁移和种子数据
echo "📊 运行数据库迁移..."
cd backend && npm run db:create && npm run db:seed && cd .. || echo "⚠️  数据库初始化可能失败，请检查MySQL连接"

echo "✅ 设置完成！"
echo ""
echo "🎯 下一步："
echo "1. 确保MySQL服务正在运行"
echo "2. 运行 'npm run dev' 启动开发服务器"
echo "3. 访问 http://localhost:3000 查看应用"
echo ""
echo "📚 更多信息请查看 README.md"