import { Injectable } from '@nestjs/common';
import { GameRoomService } from '@app/services/game-room/game-room.service';

@Injectable()
export class DebugService {
    constructor(private readonly gameRoomService: GameRoomService) {}

    toggleDebug(roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        room.isDebug = !room.isDebug;
        return room;
    }

    hasHostLeft(roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        if (room) {
            const isHostStillThere = room.players.some((player) => player.isHost);
            if (!isHostStillThere && room.isDebug) {
                room.isDebug = !room.isDebug;
                return true;
            }
        }
        return false;
    }
}
