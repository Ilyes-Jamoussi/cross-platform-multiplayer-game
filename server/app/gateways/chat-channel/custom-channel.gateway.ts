import { ChatChannelService } from '@app/services/chat-channel/chat-channel.service';
import { CustomChannelEvents } from '@common/gateway-events';
import { ChannelDeletedPayload, ChatChannelMessage } from '@common/types';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const SYSTEM_USERNAME = 'system';

@WebSocketGateway({ cors: true })
export class CustomChannelGateway {
    @WebSocketServer() private readonly server: Server;

    constructor(
        private readonly chatChannelService: ChatChannelService,
        private readonly logger: Logger,
    ) {}

    @SubscribeMessage(CustomChannelEvents.SendMessage)
    async handleSendMessage(@MessageBody() message: ChatChannelMessage): Promise<void> {
        await this.chatChannelService.addMessage(message);
        this.logger.log(`Channel ${message.channelId} message from ${message.username}`);
        this.server.to(message.channelId).emit(CustomChannelEvents.ReceiveMessage, message);
    }

    @SubscribeMessage(CustomChannelEvents.RetrieveMessages)
    async handleRetrieveMessages(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string; username?: string }): Promise<void> {
        if (!data?.channelId) {
            client.emit(CustomChannelEvents.GiveMessages, { channelId: '', messages: [] });
            return;
        }
        const since = data.username ? await this.chatChannelService.getMemberJoinedAt(data.channelId, data.username) : undefined;
        const messages = await this.chatChannelService.getMessages(data.channelId, since);
        client.emit(CustomChannelEvents.GiveMessages, { channelId: data.channelId, messages });
    }

    @SubscribeMessage(CustomChannelEvents.Create)
    async handleCreate(@ConnectedSocket() client: Socket, @MessageBody() data: { name: string; username: string }): Promise<void> {
        try {
            const channel = await this.chatChannelService.createChannel(data.name, data.username);
            const channelId = channel._id.toString();
            this.logger.log(`Channel "${data.name}" created by ${data.username}`);
            await client.join(channelId);
            await this.sendSystemMessage(channelId, 'server_msg.channel_created', { username: data.username });
            const channels = await this.chatChannelService.getJoinedChannels(data.username);
            client.emit(CustomChannelEvents.GiveJoinedChannels, channels);
        } catch {
            client.emit(CustomChannelEvents.Error, 'server_msg.channel_name_taken');
        }
    }

    @SubscribeMessage(CustomChannelEvents.Join)
    async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string; username: string }): Promise<void> {
        const joined = await this.chatChannelService.joinChannel(data.channelId, data.username);
        if (joined) {
            await client.join(data.channelId);
            this.logger.log(`${data.username} joined channel ${data.channelId}`);
            await this.sendSystemMessage(data.channelId, 'server_msg.channel_joined', { username: data.username });
            const channels = await this.chatChannelService.getJoinedChannels(data.username);
            client.emit(CustomChannelEvents.GiveJoinedChannels, channels);
        }
    }

    @SubscribeMessage(CustomChannelEvents.Leave)
    async handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string; username: string }): Promise<void> {
        const result = await this.chatChannelService.leaveChannel(data.channelId, data.username);
        if (result.left) {
            await client.leave(data.channelId);
            this.logger.log(`${data.username} left channel ${data.channelId}`);
            if (result.deleted) {
                this.logger.log(`Channel ${data.channelId} deleted (empty)`);
                const payload: ChannelDeletedPayload = { channelId: data.channelId, channelName: '', deletedBy: data.username };
                this.server.emit(CustomChannelEvents.ChannelDeleted, payload);
            } else {
                await this.sendSystemMessage(data.channelId, 'server_msg.channel_left', { username: data.username });
                if (result.newOwner) {
                    await this.sendSystemMessage(data.channelId, 'server_msg.channel_new_owner', { username: result.newOwner });
                    this.server.emit(CustomChannelEvents.newOwner, { channelId: data.channelId, newOwner: result.newOwner });
                }
            }
            const channels = await this.chatChannelService.getJoinedChannels(data.username);
            client.emit(CustomChannelEvents.GiveJoinedChannels, channels);
        }
    }

    @SubscribeMessage(CustomChannelEvents.CloseChannel)
    async handleCloseChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string; username: string }): Promise<void> {
        const result = await this.chatChannelService.closeChannel(data.channelId, data.username);
        if (result.closed) {
            this.logger.log(`Channel ${data.channelId} closed by owner ${data.username}`);
            const payload: ChannelDeletedPayload = { channelId: data.channelId, channelName: result.channelName, deletedBy: data.username };
            this.server.emit(CustomChannelEvents.ChannelDeleted, payload);
        }
    }

    @SubscribeMessage(CustomChannelEvents.Search)
    async handleSearch(@ConnectedSocket() client: Socket, @MessageBody() data: { query: string; username: string }): Promise<void> {
        const channels = await this.chatChannelService.searchChannels(data.query, data.username);
        client.emit(CustomChannelEvents.SearchResults, channels);
    }

    @SubscribeMessage(CustomChannelEvents.GetJoinedChannels)
    async handleGetJoined(@ConnectedSocket() client: Socket, @MessageBody() username: string): Promise<void> {
        const channels = await this.chatChannelService.getJoinedChannels(username);
        for (const channel of channels) {
            await client.join(channel._id.toString());
        }
        client.emit(CustomChannelEvents.GiveJoinedChannels, channels);
    }

    private async sendSystemMessage(channelId: string, key: string, params: Record<string, string> = {}): Promise<void> {
        const content = JSON.stringify({ key, params });
        const message: ChatChannelMessage = {
            channelId,
            username: SYSTEM_USERNAME,
            content,
            timestamp: new Date().toISOString(),
        };
        await this.chatChannelService.addMessage(message);
        this.server.to(channelId).emit(CustomChannelEvents.ReceiveMessage, message);
    }
}
