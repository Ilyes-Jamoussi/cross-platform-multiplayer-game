import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
    @ApiProperty()
    @Prop({ required: true, unique: true })
    firebaseUid: string;

    @ApiProperty()
    @Prop({ required: true, unique: true })
    email: string;

    @ApiProperty()
    @Prop({ required: true, unique: true, maxlength: 10 })
    username: string;

    @ApiProperty()
    @Prop()
    avatar?: string;

    @ApiProperty()
    @Prop({ default: 1000 })
    virtualCurrency: number;

    @ApiProperty()
    @Prop({ type: [String], default: ['background-default'] })
    ownedBackgrounds: string[];

    @ApiProperty()
    @Prop({ default: 'background-default' })
    selectedBackground: string;

    @ApiProperty()
    @Prop({ type: [String], default: ['music-default'] })
    ownedMusics: string[];

    @ApiProperty()
    @Prop({ default: 'music-default' })
    selectedMusic: string;

    @ApiProperty()
    @Prop({ type: [String], default: [] })
    ownedAvatars: string[];

    @ApiProperty()
    @Prop({ default: Date.now })
    createdAt: Date;

    @ApiProperty()
    @Prop({ default: Date.now })
    lastLoginAt: Date;

    @ApiProperty()
    @Prop()
    sessionToken?: string;

    @ApiProperty()
    @Prop({ type: [String], default: [] })
    friendList: string[];

    @ApiProperty()
    @Prop({ type: [String], default: [] })
    friendRequests: string[];

    @ApiProperty()
    @Prop({ default: 'offline', enum: ['online', 'offline', 'inCombat'] })
    status: string;

    @ApiProperty()
    @Prop({ default: 'blue-theme' })
    theme: string;

    @ApiProperty()
    @Prop({ default: 'fr' })
    language: string;

    @ApiProperty()
    @Prop({ default: 0 })
    gamesPlayedClassic: number;

    @ApiProperty()
    @Prop({ default: 0 })
    gamesPlayedCTF: number;

    @ApiProperty()
    @Prop({ default: 0 })
    gamesWon: number;

    @ApiProperty()
    @Prop({ default: 0 })
    totalGameTime: number;

    @ApiProperty()
    @Prop({ default: 0 })
    tutorialStep: number;
}

export const userSchema = SchemaFactory.createForClass(User);
