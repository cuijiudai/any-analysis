import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSessionStatus1700000000001 implements MigrationInterface {
  name = 'UpdateSessionStatus1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 更新会话状态枚举
    await queryRunner.query(`
      ALTER TABLE \`data_sessions\` 
      MODIFY COLUMN \`status\` enum('unconfigured', 'unfetched', 'fetched', 'analyzed') 
      NOT NULL DEFAULT 'unconfigured'
    `);

    // 更新现有数据的状态映射
    await queryRunner.query(`
      UPDATE \`data_sessions\` 
      SET \`status\` = CASE 
        WHEN \`status\` = 'configuring' THEN 'unconfigured'
        WHEN \`status\` = 'fetching' THEN 'unfetched'
        WHEN \`status\` = 'annotating' THEN 'fetched'
        WHEN \`status\` = 'analyzing' THEN 'fetched'
        WHEN \`status\` = 'completed' THEN 'analyzed'
        ELSE 'unconfigured'
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 恢复旧的状态映射
    await queryRunner.query(`
      UPDATE \`data_sessions\` 
      SET \`status\` = CASE 
        WHEN \`status\` = 'unconfigured' THEN 'configuring'
        WHEN \`status\` = 'unfetched' THEN 'fetching'
        WHEN \`status\` = 'fetched' THEN 'annotating'
        WHEN \`status\` = 'analyzed' THEN 'completed'
        ELSE 'configuring'
      END
    `);

    // 恢复旧的枚举定义
    await queryRunner.query(`
      ALTER TABLE \`data_sessions\` 
      MODIFY COLUMN \`status\` enum('configuring', 'fetching', 'annotating', 'analyzing', 'completed') 
      NOT NULL DEFAULT 'configuring'
    `);
  }
}