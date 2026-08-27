import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('KouKou Ferme API')
    .setDescription(
      'API de gestion avicole offline-first pour le Gabon — Module 1 : Gestion des Lots',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const configService = app.get(ConfigService);
  SwaggerModule.setup(
    configService.get('SWAGGER_PATH', 'api-docs'),
    app,
    document,
  );

  const port = configService.get('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`KouKou Ferme API démarré sur http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(
    `Swagger disponible sur http://localhost:${port}/${configService.get(
      'SWAGGER_PATH',
      'api-docs',
    )}`,
  );
}
await bootstrap();
