import { AppModule } from '@app/app.module';
import { INestApplicationContext, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import * as events from 'node:events';
import { MAX_LISTENERS } from '@common/constants';
import { Server, ServerOptions } from 'socket.io';

events.setMaxListeners(MAX_LISTENERS);

// The Angular desktop client sends the entire `Grid` object (including `imagePayload`,
// a base64 PNG of several hundred KB to several MB) with every `MovePlayer` event.
// Socket.IO's default limit (`maxHttpBufferSize = 1 MB`) triggered a `TransportError`
// and a hard WebSocket close on the first tile click. The Flutter mobile client
// sends a minimal payload (without `imagePayload`) and was therefore unaffected. We raise the
// limit to accept the unchanged desktop payload.
const SOCKET_IO_MAX_HTTP_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

class LargeBufferIoAdapter extends IoAdapter {
    constructor(app: INestApplicationContext) {
        super(app);
    }
    createIOServer(port: number, options?: ServerOptions): Server {
        return super.createIOServer(port, {
            ...options,
            maxHttpBufferSize: SOCKET_IO_MAX_HTTP_BUFFER_SIZE,
        });
    }
}

const bootstrap = async () => {
    const app = await NestFactory.create(AppModule);
    app.use(json({ limit: '10mb' }));
    app.use(urlencoded({ extended: true, limit: '10mb' }));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    app.enableCors();
    app.useWebSocketAdapter(new LargeBufferIoAdapter(app));
    const config = new DocumentBuilder()
        .setTitle('Poly Arena API')
        .setDescription('REST and WebSocket API for the Poly Arena multiplayer game server')
        .setVersion('1.0.0')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    SwaggerModule.setup('', app, document);

    await app.listen(process.env.PORT);
};

void bootstrap();
