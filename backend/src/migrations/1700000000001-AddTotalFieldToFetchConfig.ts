import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotalFieldToFetchConfig1700000000001 implements MigrationInterface {
  name = 'AddTotalFieldToFetchConfig1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 total_field 字段到 fetch_configs 表
    await queryRunner.query(`
      ALTER TABLE \`fetch_configs\` 
      ADD COLUMN \`total_field\` varchar(50) NULL 
      AFTER \`page_field\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除 total_field 字段
    await queryRunner.query(`
      ALTER TABLE \`fetch_configs\` 
      DROP COLUMN \`total_field\`
    `);
  }
}