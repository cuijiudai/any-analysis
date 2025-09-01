import { DataSource } from 'typeorm';

async function checkFieldAnnotationTable() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: '',
    database: 'data_fetch_analysis',
    entities: [],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('数据库连接成功');

    // 检查字段标注表是否存在
    const queryRunner = dataSource.createQueryRunner();
    
    try {
      const tables = await queryRunner.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'field_annotations'
      `);
      
      if (tables.length === 0) {
        console.log('❌ field_annotations 表不存在，正在创建...');
        
        // 手动创建表
        await queryRunner.query(`
          CREATE TABLE field_annotations (
            id VARCHAR(36) PRIMARY KEY,
            session_id VARCHAR(36) NOT NULL,
            field_name VARCHAR(255) NOT NULL,
            field_type VARCHAR(50) NOT NULL,
            label VARCHAR(255) NOT NULL,
            description TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_session_field (session_id, field_name)
          )
        `);
        console.log('✅ field_annotations 表创建完成');
      } else {
        console.log('✅ field_annotations 表存在');
        
        // 检查表结构
        const columns = await queryRunner.query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'field_annotations'
          ORDER BY ORDINAL_POSITION
        `);
        
        console.log('表结构:');
        columns.forEach((col: any) => {
          const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
          console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
      }
      
      // 检查指定会话是否存在
      const sessions = await queryRunner.query(`
        SELECT id, name FROM data_sessions 
        WHERE id = '7828ad6d-ce64-4808-9f28-9f35cff199fd'
      `);
      
      if (sessions.length > 0) {
        console.log('✅ 指定会话存在:', sessions[0]);
      } else {
        console.log('❌ 指定会话不存在');
      }
      
      // 测试插入一条记录
      console.log('测试插入字段标注...');
      
      const testAnnotation = {
        sessionId: '7828ad6d-ce64-4808-9f28-9f35cff199fd',
        fieldName: 'TEST_FIELD',
        fieldType: 'string',
        label: 'Test Label',
        description: 'Test Description'
      };
      
      await queryRunner.query(`
        INSERT IGNORE INTO field_annotations (id, session_id, field_name, field_type, label, description)
        VALUES (UUID(), ?, ?, ?, ?, ?)
      `, [
        testAnnotation.sessionId,
        testAnnotation.fieldName,
        testAnnotation.fieldType,
        testAnnotation.label,
        testAnnotation.description
      ]);
      
      console.log('✅ 测试插入成功');
      
    } finally {
      await queryRunner.release();
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await dataSource.destroy();
    console.log('数据库连接已关闭');
  }
}

checkFieldAnnotationTable();