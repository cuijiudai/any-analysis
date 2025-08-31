import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
  name = 'InitialMigration1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建数据会话表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`data_sessions\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`status\` enum('configuring', 'fetching', 'annotating', 'analyzing', 'completed') NOT NULL DEFAULT 'configuring',
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建拉取配置表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`fetch_configs\` (
        \`id\` varchar(36) NOT NULL,
        \`session_id\` varchar(36) NOT NULL,
        \`api_url\` text NOT NULL,
        \`method\` enum('GET', 'POST', 'PUT', 'DELETE') NOT NULL DEFAULT 'GET',
        \`headers\` json NULL,
        \`data\` json NULL,
        \`enable_pagination\` boolean NOT NULL DEFAULT false,
        \`page_field\` varchar(50) NULL,
        \`page_size\` int NOT NULL DEFAULT '20',
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`REL_session_id\` (\`session_id\`),
        CONSTRAINT \`FK_fetch_configs_session_id\` FOREIGN KEY (\`session_id\`) REFERENCES \`data_sessions\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建数据表结构定义表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`data_table_schemas\` (
        \`id\` varchar(36) NOT NULL,
        \`session_id\` varchar(36) NOT NULL,
        \`table_name\` varchar(255) NOT NULL,
        \`field_definitions\` json NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_session_table\` (\`session_id\`, \`table_name\`),
        CONSTRAINT \`FK_data_table_schemas_session_id\` FOREIGN KEY (\`session_id\`) REFERENCES \`data_sessions\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建字段标注表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`field_annotations\` (
        \`id\` varchar(36) NOT NULL,
        \`session_id\` varchar(36) NOT NULL,
        \`field_name\` varchar(255) NOT NULL,
        \`field_type\` varchar(50) NOT NULL,
        \`label\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_session_field\` (\`session_id\`, \`field_name\`),
        CONSTRAINT \`FK_field_annotations_session_id\` FOREIGN KEY (\`session_id\`) REFERENCES \`data_sessions\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建图表配置表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`chart_configs\` (
        \`id\` varchar(36) NOT NULL,
        \`session_id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`chart_type\` enum('line', 'bar', 'pie') NOT NULL,
        \`x_axis\` varchar(255) NOT NULL,
        \`y_axis\` varchar(255) NOT NULL,
        \`aggregation\` enum('sum', 'avg', 'count', 'none') NOT NULL DEFAULT 'none',
        \`filters\` json NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_chart_configs_session_id\` FOREIGN KEY (\`session_id\`) REFERENCES \`data_sessions\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建索引以优化查询性能
    await queryRunner.query(`
      CREATE INDEX \`IDX_data_sessions_status\` ON \`data_sessions\` (\`status\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_data_sessions_created_at\` ON \`data_sessions\` (\`created_at\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_fetch_configs_enable_pagination\` ON \`fetch_configs\` (\`enable_pagination\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_field_annotations_field_type\` ON \`field_annotations\` (\`field_type\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_chart_configs_chart_type\` ON \`chart_configs\` (\`chart_type\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.query(`DROP INDEX \`IDX_chart_configs_chart_type\` ON \`chart_configs\``);
    await queryRunner.query(`DROP INDEX \`IDX_field_annotations_field_type\` ON \`field_annotations\``);
    await queryRunner.query(`DROP INDEX \`IDX_fetch_configs_enable_pagination\` ON \`fetch_configs\``);
    await queryRunner.query(`DROP INDEX \`IDX_data_sessions_created_at\` ON \`data_sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_data_sessions_status\` ON \`data_sessions\``);

    // 删除表（按依赖关系逆序）
    await queryRunner.query(`DROP TABLE IF EXISTS \`chart_configs\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`field_annotations\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`data_table_schemas\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`fetch_configs\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`data_sessions\``);
  }
}