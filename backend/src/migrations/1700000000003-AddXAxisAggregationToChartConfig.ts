import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddXAxisAggregationToChartConfig1700000000003 implements MigrationInterface {
  name = 'AddXAxisAggregationToChartConfig1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 x_axis_aggregation 字段
    await queryRunner.addColumn(
      'chart_configs',
      new TableColumn({
        name: 'x_axis_aggregation',
        type: 'enum',
        enum: ['none', 'group', 'date_group', 'range'],
        default: "'none'",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除 x_axis_aggregation 字段
    await queryRunner.dropColumn('chart_configs', 'x_axis_aggregation');
  }
}