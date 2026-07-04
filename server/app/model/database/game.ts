import { BoardCell } from '@common/interfaces';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {
    @ApiProperty()
    @Prop({ required: true, unique: true })
    name: string;

    @ApiProperty()
    @Prop({ required: true })
    description: string;

    @ApiProperty()
    @Prop({ required: true })
    gameMode: string;

    @ApiProperty()
    @Prop({ required: true, enum: ['public', 'private', 'private-shared'], default: 'public' })
    state: string;

    @ApiProperty()
    @Prop({ required: true })
    owner: string;

    @ApiProperty()
    @Prop({ required: true })
    ownerName: string;

    @ApiProperty()
    @Prop({ required: true })
    gridSize: number;

    @ApiProperty()
    @Prop({ required: true, default: 1, min: 1, max: 5 })
    nbActions: number;

    @ApiProperty()
    @Prop({ required: true })
    imagePayload: string;

    @ApiProperty()
    @Prop({ default: new Date().toISOString() })
    lastModified?: string;

    @ApiProperty()
    @Prop()
    board: BoardCell[][];

    @ApiProperty()
    _id?: string;
}

export const gameSchema = SchemaFactory.createForClass(Game);
