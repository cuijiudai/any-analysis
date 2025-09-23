#!/bin/bash

# 本地PostgreSQL数据库初始化脚本

echo "🚀 开始设置本地PostgreSQL数据库..."

# 检查PostgreSQL是否安装
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL未安装，请先安装PostgreSQL"
    echo "macOS: brew install postgresql"
    echo "Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# 检查PostgreSQL服务是否运行
if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    echo "❌ PostgreSQL服务未运行，请启动PostgreSQL服务"
    echo "macOS: brew services start postgresql"
    echo "Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

# 创建数据库（如果不存在）
echo "📦 创建数据库 'data_fetch_analysis'..."
createdb -h localhost -U cuijiudai data_fetch_analysis 2>/dev/null || echo "数据库可能已存在，继续..."

echo "✅ 本地数据库设置完成！"
echo ""
echo "📋 数据库信息："
echo "   主机: localhost"
echo "   端口: 5432"
echo "   数据库: data_fetch_analysis"
echo "   用户: cuijiudai"
echo ""
echo "🔧 接下来运行以下命令："
echo "   npm run db:migrate  # 运行数据库迁移"
echo "   npm run db:seed     # 创建种子数据"
echo "   npm run start:dev   # 启动开发服务器"