import { User, UserDocument } from '@app/model/database/user';
import { PlayerStatus } from '@common/enums';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class FriendsGateway implements OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private userSockets = new Map<string, string>();

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly logger: Logger,
    ) {}

    @SubscribeMessage('registerFriendSocket')
    async handleRegister(@MessageBody() data: { uid: string }, @ConnectedSocket() client: Socket) {
        if (!data?.uid) return;

        client.data.uid = data.uid;
        this.userSockets.set(data.uid, client.id);

        await this.userModel.updateOne({ firebaseUid: data.uid }, { status: PlayerStatus.Online });
        this.logger.log(`User ${data.uid} ONLINE`);

        await this.broadcastStatusToFriends(data.uid, PlayerStatus.Online);
    }

    async handleDisconnect(client: Socket) {
        const uid = client.data.uid;
        if (uid) {
            this.userSockets.delete(uid);
            await this.userModel.updateOne({ firebaseUid: uid }, { status: PlayerStatus.Offline });
            this.logger.log(`User ${uid} OFFLINE`);
            await this.broadcastStatusToFriends(uid, PlayerStatus.Offline);
        } else {
            for (const [userId, socketId] of this.userSockets.entries()) {
                if (socketId === client.id) {
                    this.userSockets.delete(userId);
                    await this.userModel.updateOne({ firebaseUid: userId }, { status: PlayerStatus.Offline });
                    await this.broadcastStatusToFriends(userId, PlayerStatus.Offline);
                    break;
                }
            }
        }
    }

    async updateStatus(uid: string, status: PlayerStatus) {
        await this.userModel.updateOne({ firebaseUid: uid }, { status });
        this.logger.log(`User ${uid} status -> ${status}`);
        await this.broadcastStatusToFriends(uid, status);
    }

    getSocketIdForUser(uid: string): string | undefined {
        return this.userSockets.get(uid);
    }

    notifyRequest(senderId: string, destinationId: string) {
        const socketId = this.userSockets.get(destinationId);
        this.logger.log(`Notification demande: De ${senderId} vers ${destinationId}. Socket trouvé: ${socketId}`);
        if (socketId) {
            this.server.to(socketId).emit('requestNotification', {
                senderId,
                destinationId,
            });
        }
    }

    notifyReply(senderId: string, destinationId: string) {
        const socketId = this.userSockets.get(destinationId);
        this.logger.log(`Notification réponse: De ${senderId} vers ${destinationId}. Socket trouvé: ${socketId}`);
        if (socketId) {
            this.server.to(socketId).emit('requestReply', {
                senderId,
                destinationId,
            });
        }
    }

    private async broadcastStatusToFriends(uid: string, status: PlayerStatus) {
        const user = await this.userModel.findOne({ firebaseUid: uid }).select('friendList username').exec();
        if (!user?.friendList?.length) return;

        for (const friendUid of user.friendList) {
            const friendSocketId = this.userSockets.get(friendUid);
            if (friendSocketId) {
                this.server.to(friendSocketId).emit('statusUpdate', {
                    uid,
                    username: user.username,
                    status,
                });
            }
        }
    }
}
