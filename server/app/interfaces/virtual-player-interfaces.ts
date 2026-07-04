import { Path, Player, RoomData } from '@common/interfaces';
import { GridInfo } from '@app/interfaces/item-search-interface';
import { Position } from '@common/types';

export interface VirtualSeek {
    player: Player;
    gridInfo?: GridInfo;
    room: RoomData;
    roomId: string;
}

export interface VirtualPath {
    gridInfo: GridInfo;
    player: Player;
    path: Path;
}

export interface PathSeek {
    targetPositions: Position[];
    speed?: number;
    isLookingForFlag?: boolean;
}

export interface ItemSeek {
    isOffensive: boolean;
    isLookingForFlag?: boolean;
}
