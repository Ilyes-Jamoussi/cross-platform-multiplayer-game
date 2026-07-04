import { BoardCell } from '@common/interfaces';
import { MAX_NB_ACTIONS } from '@common/constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateGameDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsString()
    gameMode: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    @IsIn(['public', 'private', 'private-shared'])
    state?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    owner?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    ownerName?: string;

    @ApiProperty()
    @IsNumber()
    gridSize: number;

    @ApiProperty()
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(MAX_NB_ACTIONS)
    nbActions?: number;

    @ApiProperty()
    @IsString()
    imagePayload: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    lastModified?: string;

    @ApiProperty()
    @IsArray()
    board: BoardCell[][];
}
