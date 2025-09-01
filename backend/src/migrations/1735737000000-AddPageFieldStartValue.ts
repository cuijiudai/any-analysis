import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPageFieldStartValue1735737000000 implements MigrationInterface {
  name = 'AddPageFieldStartValue1735737000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fetch_configs',
      new TableColumn({
        name: 'page_field_start_value',
        type: 'int',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fetch_configs', 'page_field_start_value');
  }
}