import { FriendsGateway } from '@app/gateways/friends/friends.gateway';
import { User, UserDocument } from '@app/model/database/user';
import { MAX_SEARCH_LENGTH } from '@common/constants';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class FriendsService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private friendsGateway: FriendsGateway,
    ) {}

    async searchUsers(currentUid: string, query: string) {
        if (!query || query.length < 1) return [];

        const users = await this.userModel
            .find({
                username: { $regex: query, $options: 'i' },
                firebaseUid: { $ne: currentUid },
            })
            .limit(MAX_SEARCH_LENGTH)
            .select('username firebaseUid status lastLoginAt -_id');

        return users.map((user) => ({
            uid: user.firebaseUid,
            username: user.username,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
        }));
    }

    async sendFriendRequest(currentUid: string, destinationUid: string) {
        if (currentUid === destinationUid) {
            throw new BadRequestException('server_msg.cannot_add_self');
        }

        const destUser = await this.getUser(destinationUid);

        if (destUser.friendList.includes(currentUid)) {
            throw new BadRequestException('server_msg.already_friends');
        }

        if (destUser.friendRequests.includes(currentUid)) {
            throw new BadRequestException('server_msg.request_already_sent');
        }

        await this.userModel.updateOne({ firebaseUid: destinationUid }, { $addToSet: { friendRequests: currentUid } });
        this.friendsGateway.notifyRequest(currentUid, destinationUid);
    }

    async acceptFriendRequest(currentUid: string, askerUid: string) {
        const currentUser = await this.getUser(currentUid);

        if (!currentUser.friendRequests.includes(askerUid)) {
            throw new BadRequestException("Aucune demande d'ami de ce joueur.");
        }

        await this.userModel.updateOne(
            { firebaseUid: currentUid },
            {
                $addToSet: { friendList: askerUid },
                $pull: { friendRequests: askerUid },
            },
        );

        await this.userModel.updateOne({ firebaseUid: askerUid }, { $addToSet: { friendList: currentUid } });
        this.friendsGateway.notifyReply(currentUid, askerUid);
    }

    async refuseFriendRequest(currentUid: string, askerUid: string) {
        await this.userModel.updateOne({ firebaseUid: currentUid }, { $pull: { friendRequests: askerUid } });
        this.friendsGateway.notifyReply(currentUid, askerUid);
    }

    async removeFriend(currentUid: string, friendUid: string) {
        await this.userModel.updateOne({ firebaseUid: currentUid }, { $pull: { friendList: friendUid } });

        await this.userModel.updateOne({ firebaseUid: friendUid }, { $pull: { friendList: currentUid } });

        this.friendsGateway.notifyReply(currentUid, friendUid);
    }

    async getFriendList(currentUid: string) {
        const user = await this.getUser(currentUid);
        return this.getUserFriendList(user.friendList);
    }

    async getPendingRequests(currentUid: string) {
        const user = await this.getUser(currentUid);
        return this.getUserFriendList(user.friendRequests);
    }

    async getSentRequests(currentUid: string) {
        const users = await this.userModel
            .find({
                friendRequests: currentUid,
            })
            .select('username firebaseUid status lastLoginAt -_id');

        return users.map((user) => ({
            uid: user.firebaseUid,
            username: user.username,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
        }));
    }

    async getUserByUid(uid: string) {
        return this.getUser(uid);
    }

    private async getUserFriendList(uids: string[]) {
        if (!uids.length) return [];

        const users = await this.userModel
            .find({
                firebaseUid: { $in: uids },
            })
            .select('username firebaseUid status lastLoginAt -_id');

        return users.map((user) => ({
            uid: user.firebaseUid,
            username: user.username,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
        }));
    }

    private async getUser(uid: string) {
        const user = await this.userModel.findOne({ firebaseUid: uid });
        if (!user) throw new NotFoundException('Utilisateur introuvable.');
        return user;
    }
}
