const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'data_fetch_analysis'
    });
    
    console.log('✅ 数据库连接成功！');
    
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ 查询测试成功:', rows);
    
    await connection.end();
    console.log('✅ 连接已关闭');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
  }
}

testConnection();