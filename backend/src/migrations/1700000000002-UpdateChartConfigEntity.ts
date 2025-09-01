import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateChartConfigEntity1700000000002 implements MigrationInterface {
  name = 'UpdateChartConfigEntity1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 scatter 图表类型到枚举
    await queryRunner.query(`
      ALTER TABLE \`chart_configs\` 
      MODIFY COLUMN \`chart_type\` enum('line', 'bar', 'pie', 'scatter') NOT NULL
    `);

    // 添加 min, max 聚合类型到枚举
    await queryRunner.query(`
      ALTER TABLE \`chart_configs\` 
      MODIFY COLUMN \`aggregation\` enum('sum', 'avg', 'count', 'min', 'max', 'none') NOT NULL DEFAULT 'none'
    `);

    // 添加 title 字段
    await queryRunner.query(`
      ALTER TABLE \`chart_configs\` 
      ADD COLUMN \`title\` varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 移除 title 字段
    await queryRunner.query(`
      ALTER TABLE \`chart_configs\` 
      DROP COLUMN \`title\`
    `);

    // 恢复原来的枚举值
    await queryRunner.query(`
      ALTER TABLE \`chart_configs\` 
      MODIFY COLUMN \`aggregation\` enum('sum', 'avg', 'count', 'none') NOT NULL DEFAULT 'none'
    `);

    await queryRunner.query(`
      ALTER TABLE \`chart_configs\` 
      MODIFY COLUMN \`chart_type\` enum('line', 'bar', 'pie') NOT NULL
    `);
  }
}