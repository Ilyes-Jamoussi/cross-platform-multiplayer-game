import { ITEM_INFO, MILLISECOND_MULTIPLIER, TAKE_ITEM_DELAY } from '@app/constants/virtual-player-consts';
import { GameLogicGateway } from '@app/gateways/game-logic/game-logic.gateway';
import { PathSeek, VirtualPath } from '@app/interfaces/virtual-player-interfaces';
import { ADJACENT_POSITIONS, MOVEMENT_DELAY, TILE_COST } from '@common/constants';
import { ItemId, ItemTypes, TileTypes, VirtualPlayerTypes } from '@common/enums';
import { ActiveGameEvents, CTFEvents } from '@common/gateway-events';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { MovementService } from '@app/services/movement-logic/movement-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { BoardCell, Grid, Item, Path, Player } from '@common/interfaces';
import { GridInfo } from '@app/interfaces/item-search-interface';
import { createItem, getBestPath } from '@common/shared-utils';
import { Position } from '@common/types';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class VirtualMovementService implements OnModuleInit {
    private gameLogicGateway: GameLogicGateway;
    constructor(
        private readonly gameRoomService: GameRoomService,
        private readonly movementService: MovementService,
        private readonly gameModeService: GameModeService,
        private readonly moduleRef: ModuleRef,
    ) {}

    onModuleInit() {
        this.gameLogicGateway = this.moduleRef.get(GameLogicGateway);
    }
    async moveVirtualPlayer(virtualPath: VirtualPath) {
        const room = this.gameRoomService.getRoom(virtualPath.gridInfo.roomId);
        const playerRef = this.getPlayerRef(virtualPath.player.id, virtualPath.gridInfo.roomId);
        for (const nextPosition of virtualPath.path.positions) {
            await this.delay(MOVEMENT_DELAY);
            const nextCell = virtualPath.gridInfo.grid.board[nextPosition.x][nextPosition.y];

            if (nextCell.tile === TileTypes.Door) {
                if (await this.handleDoorNextTile(virtualPath, nextCell, nextPosition)) {
                    return true;
                }
            }

            if (!this.canAffordMovement(virtualPath.player, virtualPath.gridInfo.grid, nextPosition)) {
                return true;
            }
            this.gameModeService.setTilesVisited(room, playerRef, nextPosition);
            if (virtualPath.player.position !== nextPosition) {
                this.movementService.decreaseSpeed(virtualPath.player, virtualPath.gridInfo.grid, nextPosition);
            }
            this.emitPlayerPosition(virtualPath.gridInfo.roomId, virtualPath.player, nextPosition);
            virtualPath.player.position = nextPosition;
            if (await this.nextCellCheck(nextCell, playerRef, virtualPath)) {
                return;
            }
        }

        await this.delay(MOVEMENT_DELAY);
        this.emitPlayerPosition(virtualPath.gridInfo.roomId, virtualPath.player, virtualPath.player.position);

        return;
    }
    checkAdjacentPositions<T>(
        position: Position | undefined,
        grid: Grid,
        callback: (pos: Position, cell: BoardCell) => T | undefined,
    ): T | undefined {
        if (!position) return;

        for (const pos of this.getAdjacentPositions(position)) {
            if (this.isValidPosition(pos, grid)) {
                const result = callback(pos, grid.board[pos.x][pos.y]);
                if (result) return result;
            }
        }
        return;
    }
    isValidPosition(pos: Position, grid: Grid): boolean {
        return pos.x >= 0 && pos.y >= 0 && pos.x < grid.gridSize && pos.y < grid.gridSize;
    }
    getAdjacentPositions(position: Position): Position[] {
        return ADJACENT_POSITIONS.map((offset) => ({ x: position.x + offset.x, y: position.y + offset.y }));
    }
    findNearestPath(sourcePlayer: Player, grid: Grid, pathSeek: PathSeek): Path | undefined {
        if (!sourcePlayer.position || pathSeek.targetPositions.length === 0) return;
        const paths: Path[] = [];

        for (const targetPosition of pathSeek.targetPositions) {
            for (const approachPosition of this.getAdjacentPositions(targetPosition)) {
                if (!this.isValidPosition(approachPosition, grid)) continue;
                const pathResult = this.movementService.findPaths(
                    grid,
                    { ...sourcePlayer, stats: { ...sourcePlayer.stats, speed: pathSeek.speed } },
                    approachPosition,
                );
                if (pathResult && pathResult.path) {
                    paths.push(pathResult.path);
                }
            }
        }
        return getBestPath(paths, []).path;
    }
    findPathToExactPosition(player: Player, grid: Grid, pathSeek: PathSeek): Path | undefined {
        if (!player.position || pathSeek.targetPositions.length === 0) return;
        const paths: Path[] = [];
        for (const target of pathSeek.targetPositions) {
            const pathResult = this.movementService.findPaths(
                grid,
                {
                    ...player,
                    stats: {
                        ...player.stats,
                        speed: player.type === VirtualPlayerTypes.Defensive || pathSeek.isLookingForFlag ? Infinity : player.stats.speed,
                    },
                },
                target,
            );
            if (pathResult && pathResult.path) {
                paths.push(pathResult.path);
            }
        }
        return getBestPath(paths, []).path;
    }
    getPlayerPositions(grid: Grid, excludedPlayers: string[]): Position[] {
        const positions: Position[] = [];
        for (let x = 0; x < grid.board.length; x++) {
            for (let y = 0; y < grid.board[x].length; y++) {
                const player = grid.board[x][y].player;
                if (player && !excludedPlayers.includes(player.id)) {
                    positions.push({ x, y });
                }
            }
        }
        return positions;
    }

    getItemPositions(grid: Grid, lookingForOffensiveItems: boolean): Position[] {
        const positions: Position[] = [];

        for (let x = 0; x < grid.board.length; x++) {
            for (let y = 0; y < grid.board[x].length; y++) {
                const item = grid.board[x][y].item;
                if (!item.name || item.name.includes(ItemTypes.StartingPoint)) continue;
                if (item.name.includes(ItemTypes.Flag)) {
                    return [{ x, y }];
                }
                if (ITEM_INFO.get(item.name) === lookingForOffensiveItems) {
                    positions.push({ x, y });
                }
            }
        }
        return positions;
    }
    async delay(time: number) {
        await this.movementService.delay(time);
    }
    private async nextCellCheck(nextCell: BoardCell, playerRef: Player, virtualPath: VirtualPath) {
        if (nextCell.item?.name && !nextCell.item.name.includes(ItemTypes.StartingPoint)) {
            playerRef.playerStats.nItemsCollected = (playerRef.playerStats.nItemsCollected ?? 0) + 1;
            await this.collectItem(virtualPath.gridInfo, virtualPath.player.position, virtualPath.player);
        }
        const flagHolderId = this.gameRoomService.getRoom(virtualPath.gridInfo.roomId)?.flagHolderId;
        if (flagHolderId && flagHolderId === virtualPath.player.id) {
            const winningTeam = this.gameModeService.checkFlagCaptured(virtualPath.gridInfo.roomId, virtualPath.player);
            if (winningTeam) {
                this.gameLogicGateway.server.to(virtualPath.gridInfo.roomId).emit(CTFEvents.FlagCaptured, { winningTeam });
                return true;
            }
        }
    }
    private async handleDoorNextTile(virtualPath: VirtualPath, nextCell: BoardCell, nextPosition: Position) {
        if (virtualPath.player.actionsLeft > 0) {
            await this.doorAction(virtualPath.gridInfo.roomId, nextPosition);
            virtualPath.gridInfo.grid.board[nextPosition.x][nextPosition.y] = {
                ...nextCell,
                tile: TileTypes.OpenedDoor,
            };
            virtualPath.player.actionsLeft--;
        } else {
            return true;
        }
    }
    private getPlayerRef(playerId: string, roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        return room?.players.find((currentPlayer) => currentPlayer.id === playerId);
    }
    private emitPlayerPosition(roomId: string, player: Player, position: Position) {
        this.gameLogicGateway.server.to(roomId).emit(ActiveGameEvents.PlayerNextPosition, {
            player,
            nextPosition: position,
        });
    }
    private async collectItem(gridInfo: GridInfo, itemPosition: Position, player: Player) {
        if (!player.position) return;

        await this.delay(TAKE_ITEM_DELAY);

        if (gridInfo.grid.board[itemPosition.x][itemPosition.y].item.name.includes(ItemTypes.Flag)) {
            this.gameModeService.flagTaken({ roomId: gridInfo.roomId, flagHolderId: player.id });
            this.gameLogicGateway.server.to(gridInfo.roomId).emit(CTFEvents.FlagTaken, { flagHolder: player });
        }

        await this.handleDroppedItems(gridInfo, itemPosition, player);
    }

    private async handleDroppedItems(gridInfo: GridInfo, itemPosition: Position, player: Player) {
        const pickedUpItem = createItem(
            gridInfo.grid.board[itemPosition.x][itemPosition.y].item.name as ItemId,
            gridInfo.grid.board[itemPosition.x][itemPosition.y].item.description,
        );

        const droppedItem = await this.addItem(player, pickedUpItem);

        this.gameLogicGateway.server.to(gridInfo.roomId).emit(ActiveGameEvents.ItemPickedUp, {
            item: pickedUpItem,
            itemPosition,
            playerId: player.id,
            gridPosition: { x: itemPosition.x, y: itemPosition.y },
        });
        if (!droppedItem) {
            gridInfo.grid.board[itemPosition.x][itemPosition.y].item.name = '';
            gridInfo.grid.board[itemPosition.x][itemPosition.y].item.description = '';
        } else {
            gridInfo.grid.board[itemPosition.x][itemPosition.y].item.name = droppedItem.id;
            gridInfo.grid.board[itemPosition.x][itemPosition.y].item.description = droppedItem.tooltip;
            this.gameLogicGateway.server.to(gridInfo.roomId).emit(ActiveGameEvents.ItemUpdate, {
                item: droppedItem,
                playerId: player.id,
                roomId: gridInfo.roomId,
            });
        }
    }

    private addItem(player: Player, item: Item): Item | undefined {
        player.inventory.push(item);
        if (player.inventory.length <= 2) return;
        let droppedItem = player.inventory.reverse().pop();
        if (droppedItem.id === ItemId.ItemFlag) {
            droppedItem = player.inventory.pop();
        }
        player.inventory.reverse();
        return droppedItem;
    }
    private async doorAction(roomId: string, doorPosition: Position) {
        await this.delay(MILLISECOND_MULTIPLIER);
        this.gameLogicGateway.handleDoorToggle({ roomId, position: doorPosition, isOpened: true });
    }
    private canAffordMovement(player: Player, grid: Grid, position: Position): boolean {
        const tile = grid.board[position.x][position.y];
        const tileCost = TILE_COST.get(tile.tile) ?? 0;
        return player.stats.speed >= tileCost;
    }
}
