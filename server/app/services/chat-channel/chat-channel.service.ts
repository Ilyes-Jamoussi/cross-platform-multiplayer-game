import { ChatChannel, ChatChannelDocument, ChatChannelMessage, ChatChannelMessageDocument } from '@app/model/database/chat-channel';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatChannelMessage as ChatChannelMessageType } from '@common/types';

const GLOBAL_CHANNEL_NAME = 'Global';

@Injectable()
export class ChatChannelService implements OnModuleInit {
    constructor(
        @InjectModel(ChatChannel.name) private readonly channelModel: Model<ChatChannelDocument>,
        @InjectModel(ChatChannelMessage.name) private readonly messageModel: Model<ChatChannelMessageDocument>,
    ) {}

    async onModuleInit() {
        const exists = await this.channelModel.findOne({ type: 'global' });
        if (!exists) {
            await this.channelModel.create({ name: GLOBAL_CHANNEL_NAME, type: 'global', members: [] });
        }
    }

    async getGlobalChannel(): Promise<ChatChannelDocument> {
        return this.channelModel.findOne({ type: 'global' });
    }

    async addMessage(message: ChatChannelMessageType): Promise<ChatChannelMessageDocument> {
        return this.messageModel.create(message);
    }

    async getMessages(channelId: string, since?: string): Promise<ChatChannelMessageType[]> {
        const query: Record<string, unknown> = { channelId };
        if (since) {
            query.timestamp = { $gte: since };
        }
        return this.messageModel.find(query).sort({ timestamp: 1 }).lean();
    }

    async getMemberJoinedAt(channelId: string, username: string): Promise<string | undefined> {
        const channel = await this.channelModel.findById(channelId);
        return channel?.memberJoinedAt?.get(username);
    }

    async createChannel(name: string, createdBy: string): Promise<ChatChannelDocument> {
        const now = new Date().toISOString();
        return this.channelModel.create({
            name,
            type: 'custom',
            members: [createdBy],
            createdBy,
            owner: createdBy,
            memberJoinedAt: new Map([[createdBy, now]]),
        });
    }

    async joinChannel(channelId: string, username: string): Promise<boolean> {
        const channel = await this.channelModel.findById(channelId);
        if (!channel || channel.members.includes(username)) return false;
        const now = new Date().toISOString();
        await this.channelModel.findByIdAndUpdate(channelId, {
            $addToSet: { members: username },
            $set: { [`memberJoinedAt.${username}`]: now },
        });
        return true;
    }

    async leaveChannel(channelId: string, username: string): Promise<{ left: boolean; deleted: boolean; newOwner?: string }> {
        const channel = await this.channelModel.findById(channelId);
        if (!channel || channel.type === 'global') return { left: false, deleted: false };
        await this.channelModel.findByIdAndUpdate(channelId, {
            $pull: { members: username },
            $unset: { [`memberJoinedAt.${username}`]: '' },
        });
        const updated = await this.channelModel.findById(channelId);
        if (updated && updated.members.length === 0) {
            await this.messageModel.deleteMany({ channelId });
            await this.channelModel.findByIdAndDelete(channelId);
            return { left: true, deleted: true };
        }
        if (updated && updated.owner === username) {
            const newOwner = updated.members[0];
            await this.channelModel.findByIdAndUpdate(channelId, { owner: newOwner });
            return { left: true, deleted: false, newOwner };
        }
        return { left: true, deleted: false };
    }

    async closeChannel(channelId: string, username: string): Promise<{ closed: boolean; channelName: string }> {
        const channel = await this.channelModel.findById(channelId);
        if (!channel || channel.type === 'global') return { closed: false, channelName: '' };
        if (!channel.members.includes(username)) return { closed: false, channelName: '' };
        const channelName = channel.name;
        await this.messageModel.deleteMany({ channelId });
        await this.channelModel.findByIdAndDelete(channelId);
        return { closed: true, channelName };
    }

    async searchChannels(query: string, username: string): Promise<ChatChannelDocument[]> {
        return this.channelModel.find({ type: 'custom', name: { $regex: `^${query}`, $options: 'i' }, members: { $nin: [username] } });
    }

    async getJoinedChannels(username: string): Promise<ChatChannelDocument[]> {
        return this.channelModel.find({ type: 'custom', members: username });
    }

    async replaceUsername(oldUsername: string, newUsername: string): Promise<void> {
        await this.messageModel.updateMany({ username: oldUsername }, { $set: { username: newUsername } });
    }

    async removeUserFromAllChannels(username: string): Promise<void> {
        const channels = await this.channelModel.find({ members: username });
        for (const channel of channels) {
            if (channel.type === 'global') continue;
            await this.channelModel.findByIdAndUpdate(channel._id, {
                $pull: { members: username },
                $unset: { [`memberJoinedAt.${username}`]: '' },
            });
            const updated = await this.channelModel.findById(channel._id);
            if (updated && updated.members.length === 0) {
                await this.messageModel.deleteMany({ channelId: channel._id.toString() });
                await this.channelModel.findByIdAndDelete(channel._id);
            } else if (updated && updated.owner === username) {
                await this.channelModel.findByIdAndUpdate(channel._id, { owner: updated.members[0] });
            }
        }
    }
}
