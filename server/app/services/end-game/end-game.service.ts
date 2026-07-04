import { AuthService } from '@app/services/auth/auth.service';
import { FULL_PERCENT } from '@common/constants';
import { TileTypes } from '@common/enums';
import { Grid, Player, RoomData } from '@common/interfaces';
import { Position } from '@common/types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EndGameService {
    constructor(private readonly authService: AuthService) {}

    async recordPlayerStats(room: RoomData, allPlayers: Player[], winnerSocketIds: string[]): Promise<void> {
        if (room.statsRecorded) return;
        room.statsRecorded = true;

        room.recordedStatsUids = room.recordedStatsUids ?? new Set<string>();
        const gameMode = room.map.gameMode;
        const duration = room.globalStats.duration;
        const promises = allPlayers
            .filter((p) => !p.type)
            .map(async (p) => {
                const uid = p.firebaseUid ?? room.playerUids.get(p.id);
                if (!uid) return;
                const isWinner = winnerSocketIds.includes(p.id);
                if (room.recordedStatsUids.has(uid)) {
                    if (isWinner) await this.authService.recordGameWinOnly(uid);
                    return;
                }
                room.recordedStatsUids.add(uid);
                await this.authService.recordGameResult(uid, gameMode, isWinner, duration);
            });
        await Promise.all(promises);
    }

    async recordPlayerQuit(room: RoomData, quittingPlayer: Player): Promise<void> {
        if (!room || !room.hasGameStarted || !room.map || quittingPlayer?.type) return;
        const uid = quittingPlayer.firebaseUid ?? room.playerUids?.get(quittingPlayer.id);
        if (!uid) return;
        room.recordedStatsUids = room.recordedStatsUids ?? new Set<string>();
        if (room.recordedStatsUids.has(uid)) return;
        room.recordedStatsUids.add(uid);
        const duration = this.getDuration(room);
        await this.authService.recordGameResult(uid, room.map.gameMode, false, duration);
    }
    setGlobalStats(room: RoomData) {
        const totalValidTiles = this.getTotalValidTiles(room.map);
        room.players.forEach((player) => {
            if (!player.startingPoint) return;
            if (!room.globalStats.tilesVisited.some((tile) => tile.x === player.startingPoint.x && tile.y === player.startingPoint.y)) {
                room.globalStats.tilesVisited.push(player.startingPoint);
                if (room.map && totalValidTiles > 0) {
                    const percentage = (room.globalStats.tilesVisited.length / totalValidTiles) * FULL_PERCENT;
                    room.globalStats.tilesVisitedPercentage = parseFloat(percentage.toFixed(2));
                }
            }
        });
        const totalDoors = this.findTotalDoors(room.map);
        if (totalDoors > 0) room.globalStats.doorsUsedPercent = (room.globalStats.doorsUsed.length / totalDoors) * FULL_PERCENT;
        room.globalStats.duration = this.getDuration(room);
    }

    setTilesVisitedPercentage(room: RoomData, movingPlayer: Player, nextPosition: Position) {
        if (!room || !movingPlayer) return;

        const totalValidTiles = this.getTotalValidTiles(room.map);

        if (!movingPlayer.playerStats.tilesVisited.some((tile) => tile.x === nextPosition.x && tile.y === nextPosition.y)) {
            movingPlayer.playerStats.tilesVisited.push(nextPosition);

            if (room.map) {
                const percentage = (movingPlayer.playerStats.tilesVisited.length / totalValidTiles) * FULL_PERCENT;
                movingPlayer.playerStats.tilesVisitedPercentage = parseFloat(percentage.toFixed(2));
            }
        }
        if (!room.globalStats.tilesVisited.some((tile) => tile.x === nextPosition.x && tile.y === nextPosition.y)) {
            room.globalStats.tilesVisited.push(nextPosition);

            if (room.map) {
                const percentage = (room.globalStats.tilesVisited.length / totalValidTiles) * FULL_PERCENT;
                room.globalStats.tilesVisitedPercentage = parseFloat(percentage.toFixed(2));
            }
        }
    }

    getDuration(room: RoomData): number {
        if (room && room.startTime) {
            const endTime = new Date();
            return endTime.getTime() - room.startTime.getTime();
        } else return 0;
    }

    private getTotalValidTiles(grid: Grid): number {
        let validTiles = 0;

        if (!grid.board) return validTiles;

        for (const row of grid.board) {
            for (const tile of row) {
                if (tile.tile !== TileTypes.Wall) {
                    validTiles++;
                }
            }
        }
        return validTiles;
    }

    private findTotalDoors(grid: Grid): number {
        let nDoors = 0;

        if (!grid.board) return nDoors;

        for (const row of grid.board) {
            for (const tile of row) {
                if (tile.tile === TileTypes.Door || tile.tile === TileTypes.OpenedDoor) {
                    nDoors++;
                }
            }
        }
        return nDoors;
    }
}
