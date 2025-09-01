import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFieldTypeToEnum1700000000010 implements MigrationInterface {
  name = 'UpdateFieldTypeToEnum1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 更新 field_annotations 表的 field_type 列为枚举类型
    await queryRunner.query(`
      ALTER TABLE \`field_annotations\` 
      MODIFY COLUMN \`field_type\` enum(
        'string', 'integer', 'number', 'decimal', 'float', 
        'boolean', 'date', 'datetime', 'email', 'url', 'json', 'enum'
      ) NOT NULL DEFAULT 'string'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：将枚举类型改回 varchar
    await queryRunner.query(`
      ALTER TABLE \`field_annotations\` 
      MODIFY COLUMN \`field_type\` varchar(50) NOT NULL
    `);
  }
}