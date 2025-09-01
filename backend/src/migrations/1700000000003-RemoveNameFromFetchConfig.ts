import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveNameFromFetchConfig1700000000003 implements MigrationInterface {
  name = 'RemoveNameFromFetchConfig1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`fetch_configs\` 
      DROP COLUMN \`name\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`fetch_configs\` 
      ADD COLUMN \`name\` varchar(255) NULL
    `);
  }
}