import { DataSource } from 'typeorm';
import { DataSession, SessionStatus } from '../entities/data-session.entity';
import { FetchConfig, HttpMethod } from '../entities/fetch-config.entity';

export class InitialDataSeed {
  public static async run(dataSource: DataSource): Promise<void> {
    const sessionRepository = dataSource.getRepository(DataSession);
    const configRepository = dataSource.getRepository(FetchConfig);

    // 检查是否已有数据
    const existingSessions = await sessionRepository.count();
    if (existingSessions > 0) {
      console.log('数据库已有数据，跳过种子数据创建');
      return;
    }

    // 创建示例数据会话
    const demoSession = sessionRepository.create({
      name: '示例数据会话',
      status: SessionStatus.CONFIGURING,
    });

    const savedSession = await sessionRepository.save(demoSession);

    // 创建示例拉取配置
    const demoConfig = configRepository.create({
      sessionId: savedSession.id,
      apiUrl: 'https://jsonplaceholder.typicode.com/posts',
      method: HttpMethod.GET,
      headers: {
        'Content-Type': 'application/json',
      },
      enablePagination: true,
      pageField: 'page',
      pageSize: 10,
    });

    await configRepository.save(demoConfig);

    console.log('种子数据创建完成');
  }
}