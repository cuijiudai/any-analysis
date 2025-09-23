#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 读取本地环境配置
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');

// 备份当前 .env 文件（如果存在）
let backupCreated = false;
if (fs.existsSync(envPath)) {
  const backupPath = `${envPath}.backup.${Date.now()}`;
  fs.copyFileSync(envPath, backupPath);
  console.log(`📦 已备份当前 .env 文件到: ${path.basename(backupPath)}`);
  backupCreated = true;
}

// 复制本地配置
if (fs.existsSync(envLocalPath)) {
  fs.copyFileSync(envLocalPath, envPath);
  console.log('🔧 已切换到本地数据库配置');
} else {
  console.error('❌ 找不到 .env.local 文件');
  process.exit(1);
}

// 启动开发服务器
console.log('🚀 启动本地开发服务器...\n');

const child = spawn('npm', ['run', 'start:dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

// 处理进程退出
const cleanup = () => {
  console.log('\n🛑 正在停止服务器...');
  
  // 恢复原始配置（如果有备份）
  if (backupCreated) {
    const backupFiles = fs.readdirSync(path.dirname(envPath))
      .filter(file => file.startsWith('.env.backup.'))
      .sort()
      .reverse(); // 最新的备份在前
    
    if (backupFiles.length > 0) {
      const latestBackup = path.join(path.dirname(envPath), backupFiles[0]);
      fs.copyFileSync(latestBackup, envPath);
      console.log('🔄 已恢复原始 .env 配置');
      
      // 清理备份文件
      fs.unlinkSync(latestBackup);
      console.log('🗑️  已清理备份文件');
    }
  }
  
  process.exit(0);
};

// 监听退出信号
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

child.on('close', (code) => {
  cleanup();
});