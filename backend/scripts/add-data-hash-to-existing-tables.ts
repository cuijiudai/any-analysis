import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { createHash } from 'crypto';

// 加载环境变量
config();

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'data_fetch_analysis',
});

/**
 * 生成数据内容的哈希值，用于去重
 */
function generateDataHash(data: any): string {
  const systemFields = ['id', 'session_id', 'page_number', 'data_index', 'data_hash', 'created_at'];
  const cleanData: any = {};
  
  if (typeof data === 'object' && data !== null) {
    Object.keys(data).forEach(key => {
      if (!systemFields.includes(key.toLowerCase())) {
        cleanData[key] = data[key];
      }
    });
  } else {
    cleanData.value = data;
  }
  
  // 按键名排序以确保哈希的一致性
  const sortedKeys = Object.keys(cleanData).sort();
  const sortedData: any = {};
  sortedKeys.forEach(key => {
    sortedData[key] = cleanData[key];
  });
  
  const dataString = JSON.stringify(sortedData);
  return createHash('sha256').update(dataString).digest('hex');
}

async function addDataHashToExistingTables() {
  try {
    await dataSource.initialize();
    console.log('数据库连接成功');

    // 获取所有动态表
    const tables = await dataSource.query(`
      SHOW TABLES LIKE 'data_%'
    `);

    const dynamicTables = tables
      .map((row: any) => Object.values(row)[0] as string)
      .filter((tableName: string) => 
        tableName.startsWith('data_') && 
        !['data_sessions', 'data_table_schemas'].includes(tableName)
      );

    console.log(`找到 ${dynamicTables.length} 个动态表:`, dynamicTables);

    for (const tableName of dynamicTables) {
      console.log(`\n处理表: ${tableName}`);
      
      try {
        // 检查表是否已经有 data_hash 字段
        const columns = await dataSource.query(`
          SHOW COLUMNS FROM \`${tableName}\` LIKE 'data_hash'
        `);

        if (columns.length > 0) {
          console.log(`表 ${tableName} 已经有 data_hash 字段，跳过`);
          continue;
        }

        // 添加 data_hash 字段
        await dataSource.query(`
          ALTER TABLE \`${tableName}\` 
          ADD COLUMN \`data_hash\` VARCHAR(64) NULL 
          AFTER \`data_index\`
        `);
        console.log(`为表 ${tableName} 添加 data_hash 字段成功`);

        // 获取现有数据并计算哈希值
        const existingData = await dataSource.query(`
          SELECT * FROM \`${tableName}\`
        `);

        console.log(`表 ${tableName} 有 ${existingData.length} 条现有数据`);

        // 为每条现有数据计算并更新哈希值
        for (const row of existingData) {
          const dataHash = generateDataHash(row);
          
          await dataSource.query(`
            UPDATE \`${tableName}\` 
            SET \`data_hash\` = ? 
            WHERE \`id\` = ?
          `, [dataHash, row.id]);
        }

        console.log(`为表 ${tableName} 的所有现有数据计算哈希值完成`);

        // 将 data_hash 字段设置为 NOT NULL
        await dataSource.query(`
          ALTER TABLE \`${tableName}\` 
          MODIFY COLUMN \`data_hash\` VARCHAR(64) NOT NULL COMMENT '数据内容的哈希值，用于去重'
        `);

        // 添加唯一索引（如果不存在）
        try {
          await dataSource.query(`
            ALTER TABLE \`${tableName}\` 
            ADD UNIQUE KEY \`unique_session_data\` (\`session_id\`, \`data_hash\`)
          `);
          console.log(`为表 ${tableName} 添加唯一索引成功`);
        } catch (indexError: any) {
          if (indexError.message.includes('Duplicate key name')) {
            console.log(`表 ${tableName} 的唯一索引已存在，跳过`);
          } else {
            console.warn(`为表 ${tableName} 添加唯一索引失败:`, indexError.message);
          }
        }

        console.log(`表 ${tableName} 处理完成`);
      } catch (error: any) {
        console.error(`处理表 ${tableName} 时出错:`, error.message);
      }
    }

    console.log('\n所有动态表处理完成');
  } catch (error) {
    console.error('脚本执行失败:', error);
  } finally {
    await dataSource.destroy();
    console.log('数据库连接已关闭');
  }
}

// 运行脚本
addDataHashToExistingTables();