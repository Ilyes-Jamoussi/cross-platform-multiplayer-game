import { ITEM_ID_PATTERN } from '@app/constants/game-room-constants';
import { PlayersStarters } from '@app/interfaces/start-game-interfaces';
import { CreateGameDto } from '@app/model/dto/create-game.dto';
import { BoardService } from '@app/services/board/board.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { GROUPED_ITEMS } from '@common/constants';
import { ItemCategory, ItemId, ItemTypes } from '@common/enums';
import { BoardCell, Coords } from '@common/interfaces';
import { shuffleArray } from '@common/shared-utils';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StartGameService {
    constructor(
        private readonly gameRoom: GameRoomService,
        private readonly boardService: BoardService,
    ) {}

    async getGame(roomId: string) {
        const roomData = this.gameRoom.getRoom(roomId);
        return await this.boardService.getGameById(roomData.mapId);
    }

    async placePlayersOnStartingPoints(roomId: string): Promise<CreateGameDto | null> {
        const game = await this.getGame(roomId);
        const board = game.board;
        const room = this.gameRoom.getRoom(roomId);
        room.hasGameStarted = true;
        room.startTime = new Date();

        const roomPlayers = room.players;
        const shuffledPlayers = shuffleArray(Array.from(roomPlayers));
        this.placeRandomItems(board);

        const startingPoints: Coords[] = [];
        for (let rowIndex = 0; rowIndex < board.length; rowIndex++) {
            for (let colIndex = 0; colIndex < board[rowIndex].length; colIndex++) {
                if (board[rowIndex][colIndex].item.name.includes(ItemTypes.StartingPoint)) {
                    startingPoints.push({ row: rowIndex, col: colIndex });
                }
            }
        }

        const shuffledStartingPoints = shuffleArray(startingPoints);

        this.removeUnusedStartingPoints(board, { players: shuffledPlayers, startingPoints: shuffledStartingPoints }, roomId);

        return game;
    }

    private getAvailableItemIds(board: BoardCell[][]): ItemId[] {
        const allItemIds = Object.values(ItemId).filter((id) => ITEM_ID_PATTERN.test(id));

        const placedItems: ItemId[] = [];
        for (const row of board) {
            for (const cell of row) {
                if (cell.item.name !== '' && !cell.item.description.includes(ItemCategory.Random)) {
                    placedItems.push(cell.item.name as ItemId);
                }
            }
        }

        return allItemIds.filter((id) => !placedItems.includes(id));
    }

    private placeRandomItems(board: BoardCell[][]): void {
        const availableItemIds = this.getAvailableItemIds(board);
        const shuffledIds = shuffleArray(availableItemIds);
        let itemIndex = 0;
        if (shuffledIds.length !== 0) {
            for (const row of board) {
                for (const cell of row) {
                    if (cell.item.description.includes(ItemCategory.Random)) {
                        cell.item.name = shuffledIds[itemIndex];
                        cell.item.description = this.getTooltipById(shuffledIds[itemIndex]);
                        itemIndex++;

                        if (itemIndex >= shuffledIds.length) return;
                    }
                }
            }
        }
    }

    private getTooltipById(itemId: ItemId): string {
        for (const group of GROUPED_ITEMS) {
            for (const section of group.sections) {
                for (const row of section.items) {
                    for (const item of row) {
                        if (item.id === itemId) {
                            return item.tooltip;
                        }
                    }
                }
            }
        }
    }

    private removeUnusedStartingPoints(board: BoardCell[][], playerStarters: PlayersStarters, roomId: string): void {
        for (let i = 0; i < playerStarters.players.length && i < playerStarters.startingPoints.length; i++) {
            const player = playerStarters.players[i];
            const point = playerStarters.startingPoints[i];
            board[point.row][point.col].player = player;
            this.gameRoom.setStartingPoints(roomId, { x: point.row, y: point.col }, player);
        }
        for (let i = playerStarters.players.length; i < playerStarters.startingPoints.length; i++) {
            const point = playerStarters.startingPoints[i];
            board[point.row][point.col].item.name = ItemTypes.UnusedStartingPoint;
            board[point.row][point.col].item.description = '';
        }
    }
}
