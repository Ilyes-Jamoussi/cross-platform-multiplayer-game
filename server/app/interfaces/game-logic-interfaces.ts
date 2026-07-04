import { BoardCell, MovePlayer, Player, RoomData } from '@common/interfaces';
import { Position } from '@common/types';

export interface MoveAction {
    room: RoomData;
    movingPlayer: Player;
    data: MovePlayer;
    index: number;
    playerInRoom: Player;
    nextPosition: Position;
}

export interface ItemPickup {
    tile: BoardCell;
    playerInRoom: Player;
    movingPlayer: Player;
    roomId: string;
}
