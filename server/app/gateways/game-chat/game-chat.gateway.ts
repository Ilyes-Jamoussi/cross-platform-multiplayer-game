import { GameChatEvents } from '@common/gateway-events';
import { MessagePayload } from '@common/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class GameChatGateway {
    @WebSocketServer()
    server: Server;

    constructor(private readonly logger: Logger) {}

    @SubscribeMessage(GameChatEvents.SendMessage)
    handleSendMessage(@MessageBody() data: MessagePayload) {
        this.logger.log(`Message sent by ${data.message.player.name}`);
        if (data.roomId.includes('-')) {
            this.server.to(data.roomId).emit(GameChatEvents.ReceiveTeamMessage, data);
        } else {
            this.server.to(data.roomId).emit(GameChatEvents.ReceiveMessage, data);
        }
    }
}
