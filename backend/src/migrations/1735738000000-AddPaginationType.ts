import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaginationType1735738000000 implements MigrationInterface {
  name = 'AddPaginationType1735738000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fetch_configs',
      new TableColumn({
        name: 'pagination_type',
        type: 'enum',
        enum: ['page', 'offset'],
        default: "'page'",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fetch_configs', 'pagination_type');
  }
}