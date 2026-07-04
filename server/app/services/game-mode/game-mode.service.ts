import { EndGameService } from '@app/services/end-game/end-game.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TurnService } from '@app/services/turns/turn-service';
import { FlagTakenPayload, Player, RoomData, Team } from '@common/interfaces';
import { Position } from '@common/types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameModeService {
    constructor(
        private readonly gameRoomService: GameRoomService,
        private readonly endService: EndGameService,
        private readonly turnService: TurnService,
    ) {}

    flagTaken(payload: FlagTakenPayload) {
        const room = this.gameRoomService.getRoom(payload.roomId);
        if (room) {
            room.flagHolderId = payload.flagHolderId;
            if (!room.globalStats.flagHolders.some((id) => id === payload.flagHolderId)) {
                room.globalStats.flagHolders.push(payload.flagHolderId);
            }
            return room.players.find((player) => player.id === payload.flagHolderId);
        }
    }

    flagDropped(roomId: string): void {
        const room = this.gameRoomService.getRoom(roomId);
        if (room) {
            room.flagHolderId = undefined;
        }
    }

    checkFlagCaptured(roomId: string, flagHolder: Player) {
        const room = this.gameRoomService.getRoom(roomId);
        if (room && room.flagHolderId && flagHolder.id === room.flagHolderId) {
            if (flagHolder.position.x === flagHolder.startingPoint.x && flagHolder.position.y === flagHolder.startingPoint.y) {
                return this.flagCaptured(roomId);
            }
        }
    }

    flagCaptured(roomId: string): Player[] | undefined {
        const room = this.gameRoomService.getRoom(roomId);
        if (!room) return undefined;

        if (room.teams && room.teams.length > 0) {
            for (const team of room.teams) {
                const isWinningTeam = team.players.some((player) => player.id === room.flagHolderId);

                if (isWinningTeam) {
                    team.players.forEach((player) => {
                        const roomPlayer = room.players.find((p) => p.id === player.id);
                        if (roomPlayer) {
                            roomPlayer.victories = (roomPlayer.victories || 0) + 1;
                        }
                    });
                    return team.players;
                }
            }
        } else {
            const winningPlayer = room.players.find((p) => p.id === room.flagHolderId);
            if (winningPlayer) {
                winningPlayer.victories = (winningPlayer.victories || 0) + 1;
                return [winningPlayer];
            }
        }

        return undefined;
    }

    isPartOfTeam(self: Player, other: Player, teams: Team[]): boolean {
        if (!teams || teams.length === 0) return false;

        for (const team of teams) {
            const hasSelf = team.players.some((p) => p.id === self.id);
            const hasOther = team.players.some((p) => p.id === other.id);

            if (hasSelf && hasOther) {
                return true;
            }
        }
        return false;
    }

    setTilesVisited(room: RoomData, movingPlayer: Player, nextPosition: Position) {
        this.endService.setTilesVisitedPercentage(room, movingPlayer, nextPosition);
    }
    setGlobalStats(room: RoomData) {
        this.endService.setGlobalStats(room);
    }
    async recordPlayerStats(room: RoomData, allPlayers: Player[], winnerSocketIds: string[]): Promise<void> {
        await this.endService.recordPlayerStats(room, allPlayers, winnerSocketIds);
    }
    nextTurn(roomId: string) {
        return this.turnService.nextTurn(roomId);
    }
}
