import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUnconfiguredStatus1700000000002 implements MigrationInterface {
  name = 'RemoveUnconfiguredStatus1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 更新现有的unconfigured状态为unfetched
    await queryRunner.query(`
      UPDATE \`data_sessions\` 
      SET \`status\` = 'unfetched' 
      WHERE \`status\` = 'unconfigured'
    `);

    // 更新枚举定义，移除unconfigured
    await queryRunner.query(`
      ALTER TABLE \`data_sessions\` 
      MODIFY COLUMN \`status\` enum('unfetched', 'fetched', 'analyzed') 
      NOT NULL DEFAULT 'unfetched'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 恢复枚举定义
    await queryRunner.query(`
      ALTER TABLE \`data_sessions\` 
      MODIFY COLUMN \`status\` enum('unconfigured', 'unfetched', 'fetched', 'analyzed') 
      NOT NULL DEFAULT 'unconfigured'
    `);

    // 恢复状态映射
    await queryRunner.query(`
      UPDATE \`data_sessions\` 
      SET \`status\` = 'unconfigured' 
      WHERE \`status\` = 'unfetched'
    `);
  }
}