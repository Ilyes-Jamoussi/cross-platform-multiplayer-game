import { ChatChannelService } from '@app/services/chat-channel/chat-channel.service';
import { GlobalChannelEvents } from '@common/gateway-events';
import { ChatChannelMessage } from '@common/types';
import { Logger } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class GlobalChannelGateway {
    @WebSocketServer() private readonly server: Server;

    constructor(
        private readonly chatChannelService: ChatChannelService,
        private readonly logger: Logger,
    ) {}

    @SubscribeMessage(GlobalChannelEvents.SendMessage)
    async handleSendMessage(@MessageBody() message: Omit<ChatChannelMessage, 'channelId'>): Promise<void> {
        const globalChannel = await this.chatChannelService.getGlobalChannel();
        const fullMessage: ChatChannelMessage = { ...message, channelId: globalChannel._id.toString() };
        await this.chatChannelService.addMessage(fullMessage);
        this.logger.log(`Global message from ${message.username}`);
        this.server.emit(GlobalChannelEvents.ReceiveMessage, fullMessage);
    }

    broadcastAccountDeleted(username: string): void {
        this.server.emit(GlobalChannelEvents.AccountDeleted, { username });
    }
}
