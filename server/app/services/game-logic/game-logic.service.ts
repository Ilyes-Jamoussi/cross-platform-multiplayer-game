import { GameLogicGateway } from '@app/gateways/game-logic/game-logic.gateway';
import { ItemGateway } from '@app/gateways/items/items.gateway';
import { ItemPickup, MoveAction } from '@app/interfaces/game-logic-interfaces';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { MovementService } from '@app/services/movement-logic/movement-logic.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { MOVEMENT_DELAY } from '@common/constants';
import { Directions, ItemId, ItemTypes, LobbyGameMode, PlayerState } from '@common/enums';
import { ActiveGameEvents, CTFEvents } from '@common/gateway-events';
import { CombatAction, CombatActionResult, Player, RoomData } from '@common/interfaces';
import { createItem, findAvailableTerrainForItem } from '@common/shared-utils';
import { Position } from '@common/types';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class GameLogicService implements OnModuleInit {
    private itemGateway: ItemGateway;
    private gameLogicGateway: GameLogicGateway;
    constructor(
        private readonly combatService: CombatService,
        private readonly moduleRef: ModuleRef,
        private readonly gameModeService: GameModeService,
        private readonly movementService: MovementService,
        private readonly virtualPlayerService: VirtualPlayerService,
    ) {}
    onModuleInit() {
        this.itemGateway = this.moduleRef.get(ItemGateway);
        this.gameLogicGateway = this.moduleRef.get(GameLogicGateway);
    }

    setNextPosition(player: Player, data: CombatAction, room: RoomData) {
        if (room.lobbyGameMode === LobbyGameMode.FastElimination && player.state === PlayerState.ELIMINATED) {
            return { x: -1, y: -1 } as Position;
        }

        const nextPosition =
            player.position === player.startingPoint
                ? player.startingPoint
                : this.combatService.findNextPlayerPosition(player.startingPoint, data.roomId);
        if (player.type) {
            const availablePositions = findAvailableTerrainForItem(player.position, room.map.board);
            this.itemGateway.handleDroppedItems({
                roomId: data.roomId,
                inventory: player.inventory,
                positions: availablePositions,
            });
        }
        return nextPosition;
    }

    dropPlayerItems(player: Player, roomId: string, room: RoomData): void {
        if (!player.inventory || player.inventory.length === 0) return;
        const availablePositions = findAvailableTerrainForItem(player.position, room.map.board);
        this.itemGateway.handleDroppedItems({
            roomId,
            inventory: player.inventory,
            positions: availablePositions,
        });
    }

    async handleCombat(player: Player, data: CombatAction, nextPosition: Position, room: RoomData, result: CombatActionResult) {
        if (player.type) {
            for (const item of player.inventory) {
                if (item.id.includes(ItemTypes.Flag)) {
                    this.gameModeService.flagDropped(data.roomId);
                    this.gameLogicGateway.server.to(data.roomId).emit(CTFEvents.FlagDropped);
                }
            }
        }
        const playerIndex = room.players.findIndex((playerToFind) => playerToFind.id === player.id);
        if (playerIndex !== -1) {
            room.players[playerIndex].position = nextPosition;
            room.players[playerIndex].inventory = [];
        }
        if (room.currentTurn) {
            await this.movementService.delay(MOVEMENT_DELAY);
            this.gameLogicGateway.server.to(data.roomId).emit(ActiveGameEvents.MapRequest);

            const winnerFromState = result.gameState.players[0] as Player;
            const winnerInRoom = room.players.find((p) => p.id === winnerFromState?.id);
            const currentTurnIsVirtual = !!room.currentTurn.type;
            const currentTurnIsEliminated = room.currentTurn.state === PlayerState.ELIMINATED;
            const winnerIsVirtual = !!winnerFromState?.type;
            const winnerMatchesCurrentTurn = !!winnerFromState && room.currentTurn.id === winnerFromState.id;

            if (currentTurnIsEliminated) {
                // If the current turn belongs to the eliminated player, advance immediately to the next turn.
                this.gameLogicGateway.handleEndTurn({ roomId: data.roomId });
                return;
            }

            if (currentTurnIsVirtual && winnerIsVirtual && winnerMatchesCurrentTurn) {
                const virtualPlayerIndex = room.players.findIndex((playerToFind) => playerToFind.id === winnerFromState.id);
                if (virtualPlayerIndex !== -1) {
                    this.virtualPlayerService.afterCombatTurn(room.players[virtualPlayerIndex], data.roomId);
                    return;
                }
            }

            if (this.humanWinnerShouldContinueTurn(room, winnerFromState, winnerInRoom, winnerMatchesCurrentTurn)) {
                return;
            }

            this.gameLogicGateway.handleEndTurn({ roomId: data.roomId });
        } else {
            // Pas de currentTurn : on tente de reprendre manuellement (cas bordure)
            this.gameLogicGateway.handleEndTurn({ roomId: data.roomId });
        }
    }

    turnAction(roomId: string, currentPlayer: Player) {
        this.virtualPlayerService.turnAction(roomId, currentPlayer);
    }
    async moveAction(moveAction: MoveAction) {
        const tile = moveAction.data.grid.board[moveAction.nextPosition.x][moveAction.nextPosition.y];
        const prevPosition = moveAction.index > 0 ? moveAction.data.path.positions[moveAction.index - 1] : moveAction.movingPlayer.position;
        moveAction.movingPlayer.position = prevPosition;

        if (moveAction.nextPosition.x > prevPosition.x) moveAction.movingPlayer.lastDirection = Directions.Right;
        else if (moveAction.nextPosition.x < prevPosition.x) moveAction.movingPlayer.lastDirection = Directions.Left;

        await this.movementService.delay(MOVEMENT_DELAY);

        this.moveLogic(moveAction);

        if (tile.item.name && !tile.item.name.includes(ItemTypes.StartingPoint) && !tile.item.name.includes(ItemTypes.UnusedStartingPoint)) {
            if (
                this.handleItemPickup({
                    tile,
                    playerInRoom: moveAction.playerInRoom,
                    movingPlayer: moveAction.movingPlayer,
                    roomId: moveAction.data.roomId,
                })
            ) {
                return true;
            }
        }
        return this.checkWinningTeam(moveAction.data.roomId, moveAction.movingPlayer);
    }

    async handleTeamCombatEnd(data: CombatAction, room: RoomData, result: CombatActionResult) {
        if (result.losingPlayerIds) {
            for (const loserId of result.losingPlayerIds) {
                const loser = room.players.find((p) => p.id === loserId);
                if (!loser) continue;
                if (loser.type) {
                    for (const item of loser.inventory) {
                        if (item.id.includes(ItemTypes.Flag)) {
                            this.gameModeService.flagDropped(data.roomId);
                            this.gameLogicGateway.server.to(data.roomId).emit(CTFEvents.FlagDropped);
                        }
                    }
                }
                loser.inventory = [];
            }
        }

        if (room.currentTurn) {
            await this.movementService.delay(MOVEMENT_DELAY);
            this.gameLogicGateway.server.to(data.roomId).emit(ActiveGameEvents.MapRequest);

            if (room.currentTurn.type) {
                const currentVP = room.players.find((p) => p.id === room.currentTurn.id);
                if (currentVP && result.winningPlayerIds?.includes(currentVP.id)) {
                    this.virtualPlayerService.afterCombatTurn(currentVP, data.roomId);
                } else {
                    this.gameLogicGateway.handleEndTurn({ roomId: data.roomId });
                }
            } else if (result.losingPlayerIds?.includes(room.currentTurn.id)) {
                this.gameLogicGateway.handleEndTurn({ roomId: data.roomId });
            }
        }
    }

    private checkWinningTeam(roomId: string, player: Player) {
        const winningTeam = this.gameModeService.checkFlagCaptured(roomId, player);
        if (winningTeam) {
            this.gameLogicGateway.server.to(roomId).emit(CTFEvents.FlagCaptured, { winningTeam });
            return true;
        }
    }
    private handleItemPickup(itemPickup: ItemPickup) {
        const item = createItem(itemPickup.tile.item.name as ItemId, itemPickup.tile.item.description);
        if (!itemPickup.playerInRoom.inventory) {
            itemPickup.playerInRoom.inventory = [];
        }
        itemPickup.playerInRoom.inventory.push(item);
        this.gameLogicGateway.server.to(itemPickup.roomId).emit(ActiveGameEvents.ItemPickedUp, {
            item,
            itemPosition: itemPickup.movingPlayer.position,
            playerId: itemPickup.movingPlayer.id,
        });
        this.gameLogicGateway.server.to(itemPickup.roomId).emit(ActiveGameEvents.PlayerNextPosition, {
            player: itemPickup.movingPlayer,
            nextPosition: itemPickup.movingPlayer.position,
        });
        itemPickup.playerInRoom.playerStats.nItemsCollected++;
        return true;
    }
    private moveLogic(moveAction: MoveAction) {
        if (!moveAction.room || !moveAction.playerInRoom) {
            this.gameLogicGateway.server.to(moveAction.data.roomId).emit(ActiveGameEvents.PlayerDisconnect, { playerId: moveAction.movingPlayer.id });
            return true;
        }

        this.gameLogicGateway.server.to(moveAction.data.roomId).emit(ActiveGameEvents.PlayerNextPosition, {
            player: moveAction.movingPlayer,
            nextPosition: moveAction.nextPosition,
        });

        this.gameModeService.setTilesVisited(moveAction.room, moveAction.playerInRoom, moveAction.nextPosition);

        moveAction.movingPlayer.position = moveAction.nextPosition;

        if (!moveAction.data.isRightClick) {
            this.movementService.decreaseSpeed(moveAction.movingPlayer, moveAction.data.grid, moveAction.nextPosition);
        }
    }

    private humanWinnerShouldContinueTurn(
        room: RoomData,
        winnerFromState: Player,
        winnerInRoom: Player | undefined,
        winnerMatchesCurrentTurn: boolean,
    ): boolean {
        const humanWinner = winnerInRoom && !winnerFromState.type ? winnerInRoom : undefined;
        if (!humanWinner || !winnerMatchesCurrentTurn) {
            return false;
        }
        const nbActions = room.map?.nbActions ?? 1;
        humanWinner.actionsLeft = Math.max(0, (humanWinner.actionsLeft ?? nbActions) - 1);
        return this.playerHasRemainingMovement(humanWinner, room) || (humanWinner.actionsLeft ?? 0) > 0;
    }

    private playerHasRemainingMovement(player: Player, room: RoomData): boolean {
        if (!room.map || player.position == null) {
            return false;
        }
        const { reachableTiles } = this.movementService.findPaths(room.map, player);
        return reachableTiles.length > 0;
    }
}
