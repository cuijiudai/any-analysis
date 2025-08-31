import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // 启用CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  // 设置全局API前缀
  app.setGlobalPrefix('api');

  await app.listen(3001);
  console.log('数据拉取与分析系统后端服务已启动在端口 3001');
}
bootstrap();