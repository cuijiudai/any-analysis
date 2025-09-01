import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNameAndDataPathToFetchConfig1700000000002 implements MigrationInterface {
  name = 'AddNameAndDataPathToFetchConfig1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`fetch_configs\` 
      ADD COLUMN \`name\` varchar(255) NULL,
      ADD COLUMN \`data_path\` varchar(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`fetch_configs\` 
      DROP COLUMN \`name\`,
      DROP COLUMN \`data_path\`
    `);
  }
}