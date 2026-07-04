import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatChannelDocument = ChatChannel & Document;

export type ChatChannelMessageDocument = ChatChannelMessage & Document;

@Schema()
export class ChatChannelMessage {
    @Prop({ required: true })
    channelId: string;

    @Prop({ required: true })
    username: string;

    @Prop({ required: true })
    content: string;

    @Prop({ required: true })
    timestamp: string;
}

@Schema()
export class ChatChannel {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true, enum: ['global', 'custom'] })
    type: string;

    @Prop({ type: [String], default: [] })
    members: string[];

    @Prop()
    createdBy?: string;

    @Prop()
    owner?: string;

    @Prop({ type: Map, of: String, default: () => new Map<string, string>() })
    memberJoinedAt: Map<string, string>;

    @Prop({ default: () => new Date().toISOString() })
    createdAt: string;

    _id?: string;
}

export const chatChannelSchema = SchemaFactory.createForClass(ChatChannel);
export const chatChannelMessageSchema = SchemaFactory.createForClass(ChatChannelMessage);
