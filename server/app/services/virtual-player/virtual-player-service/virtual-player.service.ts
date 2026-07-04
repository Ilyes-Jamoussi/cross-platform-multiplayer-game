/* eslint-disable max-lines */
import { GameLogicGateway } from '@app/gateways/game-logic/game-logic.gateway';
import { GridInfo } from '@app/interfaces/item-search-interface';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TimerService } from '@app/services/time/time.service';
import { TURN_DELAY } from '@common/constants';
import { Actions, GameModes, ItemTypes, VirtualPlayerTypes, PlayerState } from '@common/enums';
import { Player, RoomData } from '@common/interfaces';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { VirtualMovementService } from '@app/services/virtual-player/virtual-movement-service/virtual-player-movement.service';
import { ATTACK_BASE_TIME, ATTACK_DECISION_TIME, MILLISECOND_MULTIPLIER, THINKING_TIME } from '@app/constants/virtual-player-consts';
import { ItemSeek, VirtualSeek } from '@app/interfaces/virtual-player-interfaces';
import { ItemGateway } from '@app/gateways/items/items.gateway';

@Injectable()
export class VirtualPlayerService implements OnModuleInit {
    private gameLogicGateway: GameLogicGateway;
    private itemGateway: ItemGateway;

    constructor(
        private readonly moduleRef: ModuleRef,
        private readonly gameRoomService: GameRoomService,
        private readonly timeService: TimerService,
        private readonly gameModeService: GameModeService,
        private readonly virtualMovement: VirtualMovementService,
    ) {}

    onModuleInit() {
        this.gameLogicGateway = this.moduleRef.get(GameLogicGateway);
        this.itemGateway = this.moduleRef.get(ItemGateway);
    }

    turnAction(roomId: string, player: Player) {
        // Skip action if player is eliminated in Fast Elimination mode
        if (player.state === PlayerState.ELIMINATED) {
            this.gameLogicGateway.handleEndTurn({ roomId });
            return;
        }

        setTimeout(
            async () => {
                try {
                    const room = this.gameRoomService.getRoom(roomId);
                    if (!room) return;
                    room.map.board[player.position.x][player.position.y].player = undefined;
                    player.stats.speed = player.stats.maxSpeed;
                    player.inventory = player.inventory ?? [];
                    const gridInfo: GridInfo = {
                        grid: room.map,
                        roomId,
                    };
                    player.actionsLeft = room.map.nbActions;
                    if (!(await this.captureTheFlagSequence(room, player, gridInfo))) await this.virtualPlayerTurnSequence(player, gridInfo, room);
                } catch (error) {
                    Logger.log(error);
                    this.gameLogicGateway.handleEndTurn({ roomId });
                }
            },
            TURN_DELAY * MILLISECOND_MULTIPLIER + THINKING_TIME * (1 + Math.random()),
        );
    }

    combatAnswer(virtualPlayer: Player, roomId: string) {
        setTimeout(
            () => {
                const room = this.gameRoomService.getRoom(roomId);
                if (!room?.gameState?.combat) return;

                const combat = room.gameState.combat;
                if (combat.attacker !== virtualPlayer.id && combat.defender !== virtualPlayer.id) return;

                if (this.shouldEscape(virtualPlayer)) {
                    void this.gameLogicGateway.handleCombatAction({
                        playerId: virtualPlayer.id,
                        action: Actions.Escape,
                        roomId,
                    });
                } else {
                    void this.gameLogicGateway.handleCombatAction({
                        playerId: virtualPlayer.id,
                        action: Actions.Attack,
                        roomId,
                    });
                }
            },
            ATTACK_DECISION_TIME * Math.random() + ATTACK_BASE_TIME,
        );
    }

    afterCombatTurn(player: Player, roomId: string) {
        setTimeout(async () => {
            try {
                const room = this.gameRoomService.getRoom(roomId);
                if (!room) return;

                const gridInfo: GridInfo = {
                    grid: room.map,
                    roomId,
                };
                this.consumeAction(player);
                if (!(await this.captureTheFlagSequence(room, player, gridInfo))) {
                    await this.virtualPlayerTurnSequence(player, gridInfo, room);
                }
            } catch (error) {
                this.gameLogicGateway.handleEndTurn({ roomId });
            }
        }, TURN_DELAY * MILLISECOND_MULTIPLIER);
    }

    private async seekDirectPlayerOrItems(offensiveSeek: VirtualSeek) {
        if (offensiveSeek.player.actionsLeft > 0) {
            if (await this.seekPlayers(offensiveSeek, offensiveSeek.player.stats.speed)) {
                return;
            }
        }
        while (await this.seekItems(offensiveSeek.player, offensiveSeek.gridInfo, { isOffensive: true })) {
            if (offensiveSeek.player.inventory.length > 1) {
                break;
            }
        }
        return;
    }

    private async seekItems(player: Player, gridInfo: GridInfo, itemSeek: ItemSeek): Promise<boolean> {
        if (player.stats.speed === 0) return false;
        const itemPositions = this.virtualMovement.getItemPositions(gridInfo.grid, itemSeek.isOffensive);
        if (!itemPositions) {
            return false;
        }
        let pathToItem = this.virtualMovement.findPathToExactPosition(player, gridInfo.grid, {
            targetPositions: itemPositions,
            isLookingForFlag: itemSeek.isLookingForFlag,
        });
        if (!pathToItem) {
            if (itemSeek.isLookingForFlag) {
                pathToItem = this.virtualMovement.findNearestPath(player, gridInfo.grid, { targetPositions: itemPositions, speed: Infinity });
            } else return false;
        }
        return !(await this.virtualMovement.moveVirtualPlayer({
            gridInfo,
            player,
            path: pathToItem,
        }));
    }

    private async seekDefenseItems(player: Player, gridInfo: GridInfo): Promise<boolean> {
        if (player.inventory.length === 2) return true;
        while (await this.seekItems(player, gridInfo, { isOffensive: false })) {
            if (player.inventory.length > 1) {
                return true;
            }
        }
        while (await this.seekItems(player, gridInfo, { isOffensive: true })) {
            if (player.inventory.length > 1) {
                return true;
            }
        }

        return false;
    }

    private async seekPlayers(offensiveSeek: VirtualSeek, speed: number = Infinity) {
        const currentRoom = this.gameRoomService.getRoom(offensiveSeek.roomId);
        if (currentRoom?.gameState?.combat) return true;

        const target = this.getPlayerTarget(offensiveSeek, speed);
        if (!target || target.positions.length === 0) {
            if (speed !== Infinity) {
                return;
            }
            this.gameLogicGateway.handleEndTurn({ roomId: offensiveSeek.roomId });
            return;
        }

        await this.virtualMovement.moveVirtualPlayer({
            gridInfo: {
                roomId: offensiveSeek.roomId,
                grid: offensiveSeek.room.map,
            },
            player: offensiveSeek.player,
            path: target,
        });
        return await this.seekPlayerEnd(offensiveSeek);
    }

    private getPlayerTarget(offensiveSeek: VirtualSeek, speed: number) {
        const excludedPlayers: string[] = offensiveSeek.room.players
            .filter(
                (playerToFind) =>
                    playerToFind.id === offensiveSeek.player.id ||
                    this.gameModeService.isPartOfTeam(offensiveSeek.player, playerToFind, offensiveSeek.room.teams),
            )
            .map((playerToFind) => playerToFind.id);

        const playerPositions = this.virtualMovement.getPlayerPositions(offensiveSeek.room.map, excludedPlayers);
        return this.virtualMovement.findNearestPath(offensiveSeek.player, offensiveSeek.room.map, {
            targetPositions: playerPositions,
            speed,
        });
    }

    private async seekPlayerEnd(offensiveSeek: VirtualSeek) {
        const adjacentPlayer = this.checkAdjacentPlayers(offensiveSeek.player, offensiveSeek.room);
        if (adjacentPlayer && offensiveSeek.player.actionsLeft > 0) {
            await this.handleCombatEncounter(offensiveSeek.roomId, offensiveSeek.player, adjacentPlayer);
            this.consumeAction(offensiveSeek.player);
            return true;
        }

        return;
    }

    private async handleCombatEncounter(roomId: string, attacker: Player, defender: Player) {
        const players = this.gameRoomService.getRoom(roomId).players;
        const playerIndex = players.findIndex((playerToFind) => playerToFind.id === attacker.id);
        players[playerIndex] = attacker;
        this.timeService.stopTimer({ roomId, isCombat: true });
        await this.virtualMovement.delay(TURN_DELAY * MILLISECOND_MULTIPLIER);
        this.combatAction(roomId, attacker, defender);
    }

    private combatAction(roomId: string, attacker: Player, defender: Player) {
        this.gameLogicGateway.handlePlayerAction({
            roomId,
            playerId: attacker.id,
            target: defender,
            action: Actions.Attack,
        });
    }

    private checkAdjacentPlayers(player: Player, room: RoomData): Player | undefined {
        if (room.teams) {
            return this.virtualMovement.checkAdjacentPositions(player.position, room.map, (_, cell) =>
                cell.player &&
                room.players.some(
                    (playerToFind) =>
                        playerToFind.id === cell.player?.id &&
                        cell.player?.id !== player.id &&
                        !this.gameModeService.isPartOfTeam(player, cell.player, room.teams),
                )
                    ? cell.player
                    : undefined,
            );
        } else {
            return this.virtualMovement.checkAdjacentPositions(player.position, room.map, (_, cell) =>
                cell.player && cell.player.id !== player.id ? cell.player : undefined,
            );
        }
    }

    private shouldEscape(player: Player): boolean {
        return player.type === VirtualPlayerTypes.Defensive && (player.escapeAttempts ?? 1) > 0 && player.stats.life !== player.stats.maxLife;
    }

    private async virtualPlayerTurnSequence(player: Player, gridInfo: GridInfo, room: RoomData) {
        let turnAlreadyEnded = false;
        if (player.type === VirtualPlayerTypes.Defensive) {
            turnAlreadyEnded = await this.defensiveSequence(player, gridInfo, room);
        } else {
            turnAlreadyEnded = await this.aggressiveSequence(player, gridInfo, room);
        }
        if (!turnAlreadyEnded) {
            await this.attemptTrade(player, gridInfo.roomId, room);
            this.gameLogicGateway.handleEndTurn({ roomId: gridInfo.roomId });
        }
    }
    private async defensiveSequence(player: Player, gridInfo: GridInfo, room: RoomData): Promise<boolean> {
        await this.seekDefenseItems(player, gridInfo);
        return !!(await this.seekPlayers({
            roomId: gridInfo.roomId,
            player,
            room,
        }));
    }

    private async aggressiveSequence(player: Player, gridInfo: GridInfo, room: RoomData): Promise<boolean> {
        await this.seekDirectPlayerOrItems({
            player,
            gridInfo,
            room,
            roomId: gridInfo.roomId,
        });
        return !!(await this.seekPlayers({
            roomId: gridInfo.roomId,
            player,
            room,
        }));
    }

    private async captureTheFlagSequence(room: RoomData, player: Player, gridInfo: GridInfo) {
        if (room.map.gameMode === GameModes.CTF) {
            if (!room.flagHolderId) {
                return await this.getFlagSequence(player, gridInfo, room);
            } else {
                return await this.flagTakenSequence(room, player, gridInfo);
            }
        }
    }
    private isOpponentOnStartingPoint(player: Player, gridInfo: GridInfo, room: RoomData) {
        return (
            this.virtualMovement
                .getAdjacentPositions(player.position)
                .some((pos) => pos.x === player.startingPoint.x && pos.y === player.startingPoint.y) &&
            gridInfo.grid.board[player.startingPoint.x][player.startingPoint.y].player &&
            !this.gameModeService.isPartOfTeam(player, gridInfo.grid.board[player.startingPoint.x][player.startingPoint.y].player, room.teams)
        );
    }
    private async hasFlagSequence(player: Player, gridInfo: GridInfo, room: RoomData) {
        if (this.hasFlag(player)) {
            let path = this.virtualMovement.findPathToExactPosition(player, room.map, {
                targetPositions: [player.startingPoint],
                isLookingForFlag: true,
            });
            if (!path)
                path = this.virtualMovement.findNearestPath(player, room.map, {
                    targetPositions: [player.startingPoint],
                    speed: Infinity,
                });
            await this.virtualMovement.moveVirtualPlayer({ gridInfo, path, player });
            if (this.isOpponentOnStartingPoint(player, gridInfo, room)) {
                this.timeService.stopTimer({ roomId: gridInfo.roomId });
                this.combatAction(gridInfo.roomId, player, gridInfo.grid.board[player.startingPoint.x][player.startingPoint.y].player);
                return true;
            }
        }
        if (this.hasFlagAndIsNotAtGoal(player)) this.gameLogicGateway.handleEndTurn({ roomId: gridInfo.roomId });
        return true;
    }
    private hasFlagAndIsNotAtGoal(player: Player) {
        return player.position.x !== player.startingPoint.x || player.position.y !== player.startingPoint.y || this.hasFlag(player);
    }
    private hasFlag(player: Player) {
        return player.inventory.some((item) => item.id.includes(ItemTypes.Flag));
    }
    private async getFlagSequence(player: Player, gridInfo: GridInfo, room: RoomData) {
        await this.seekItems(player, gridInfo, { isOffensive: true, isLookingForFlag: true });
        return await this.hasFlagSequence(player, gridInfo, room);
    }
    private async flagTakenSequence(room: RoomData, player: Player, gridInfo: GridInfo) {
        const flagHolder = room.players.find((playerToFind) => playerToFind.id === room.flagHolderId);
        if (room.flagHolderId === player.id) {
            return await this.hasFlagSequence(player, gridInfo, room);
        } else if (!this.gameModeService.isPartOfTeam(player, flagHolder, room.teams)) {
            gridInfo.flagHolder = flagHolder;
            return await this.flagTakenByOpponentSequence(player, gridInfo, room);
        }
    }
    private async flagTakenByOpponentSequence(player: Player, gridInfo: GridInfo, room: RoomData) {
        if (player.type === VirtualPlayerTypes.Defensive) {
            await this.flagTakenDefensive(player, gridInfo, room);
        } else {
            await this.flagTakenOffensive(player, gridInfo, room);
        }
        return true;
    }
    private async flagTakenDefensive(player: Player, gridInfo: GridInfo, room: RoomData) {
        let path = this.virtualMovement.findPathToExactPosition(player, room.map, {
            targetPositions: [gridInfo.flagHolder.startingPoint],
            isLookingForFlag: true,
        });
        if (!path)
            path = this.virtualMovement.findNearestPath(player, room.map, { targetPositions: [gridInfo.flagHolder.startingPoint], speed: Infinity });
        await this.virtualMovement.moveVirtualPlayer({ gridInfo, path, player });
        this.gameLogicGateway.handleEndTurn({ roomId: gridInfo.roomId });
    }
    private async flagTakenOffensive(player: Player, gridInfo: GridInfo, room: RoomData) {
        const path = this.virtualMovement.findNearestPath(player, room.map, { targetPositions: [gridInfo.flagHolder.position], speed: Infinity });
        await this.virtualMovement.moveVirtualPlayer({ gridInfo, path, player });
        const adjacentPlayer = this.checkAdjacentPlayers(player, room);
        if (adjacentPlayer && player.actionsLeft) {
            await this.handleCombatEncounter(gridInfo.roomId, player, adjacentPlayer);
            this.consumeAction(player);
        } else {
            this.gameLogicGateway.handleEndTurn({ roomId: gridInfo.roomId });
        }
    }
    private async attemptTrade(player: Player, roomId: string, room: RoomData) {
        if (!room.teams) return;
        if (!player.actionsLeft) return;

        const adjacentTeammate = this.virtualMovement.checkAdjacentPositions(player.position, room.map, (_, cell) => {
            if (!cell.player || cell.player.id === player.id) return undefined;
            if (!this.gameModeService.isPartOfTeam(player, cell.player, room.teams)) return undefined;

            const playerHasItem = (player.inventory?.length ?? 0) > 0;
            const teammateHasItem = (cell.player.inventory?.length ?? 0) > 0;
            if (!playerHasItem && !teammateHasItem) return undefined;

            return cell.player;
        });

        if (!adjacentTeammate) return;

        this.consumeAction(player);

        this.itemGateway.handleTradeInit({
            roomId,
            playerId: player.id,
            teammateId: adjacentTeammate.id,
        });

        setTimeout(() => {
            if ((player.inventory?.length ?? 0) > 0) {
                this.itemGateway.handleTradeUpdate({
                    roomId,
                    playerId: player.id,
                    teammateId: adjacentTeammate.id,
                    itemId: player.inventory[0].uniqueId,
                });
            }
        }, ATTACK_BASE_TIME);
    }

    private consumeAction(player: Player): void {
        if (player.actionsLeft > 0) {
            player.actionsLeft--;
        }
    }
}
