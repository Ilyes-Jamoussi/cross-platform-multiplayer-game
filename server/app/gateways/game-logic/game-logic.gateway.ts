import { FriendsGateway } from '@app/gateways/friends/friends.gateway';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TurnService } from '@app/services/turns/turn-service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { ITEM_DESCRIPTIONS, VP_POST_ANIMATION_DELAY } from '@common/constants';
import { CombatResults, GameModes, ItemTypes, LobbyGameMode, PlayerState, PlayerStatus } from '@common/enums';
import { ActiveGameEvents, DebugEvents, GameRoomEvents } from '@common/gateway-events';
import {
    BoardCell,
    CombatAction,
    CombatActionResult,
    GameDisconnect,
    Grid,
    MovePlayer,
    Player,
    PlayerAction,
    RoomData,
    SocketPayload,
    ToggleDoor,
} from '@common/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class GameLogicGateway {
    @WebSocketServer()
    private readonly _server: Server;

    // eslint-disable-next-line max-params
    constructor(
        private readonly gameRoomService: GameRoomService,
        private readonly combatService: CombatService,
        private readonly gameModeService: GameModeService,
        private readonly gameLogic: GameLogicService,
        private readonly virtualCurrencyService: VirtualCurrencyService,
        private readonly virtualPlayerService: VirtualPlayerService,
        private readonly friendsGateway: FriendsGateway,
        private readonly turnService: TurnService,
    ) {}

    get server() {
        return this._server;
    }

    @SubscribeMessage(ActiveGameEvents.CombatStarted)
    async handlePlayerAction(@MessageBody() data: PlayerAction) {
        try {
            const result = this.combatService.handleStartCombat(data.playerId, data.roomId, data.target);
            this._server.to(data.roomId).emit(ActiveGameEvents.CombatInitiated, result);

            if (data.target?.id) {
                await this.setCombatStatus(data.roomId, data.playerId, data.target.id, PlayerStatus.InCombat);
            }

            if ('nextVPAttackerId' in result && result.nextVPAttackerId) {
                const room = this.gameRoomService.getRoom(data.roomId);
                const vp = room?.players.find((p) => p.id === result.nextVPAttackerId);
                if (vp) {
                    const timeout = setTimeout(() => {
                        if (this.gameRoomService.getRoom(data.roomId)) {
                            this.virtualPlayerService.combatAnswer(vp, data.roomId);
                        }
                        this.gameRoomService.unregisterRoomTimeout(data.roomId, timeout);
                    }, VP_POST_ANIMATION_DELAY);
                    this.gameRoomService.registerRoomTimeout(data.roomId, timeout);
                }
            }
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.SelectCombatTarget)
    async handleSelectCombatTarget(@MessageBody() data: { roomId: string; playerId: string; targetId: string }) {
        try {
            const result = this.combatService.selectCombatTarget(data.roomId, data.playerId, data.targetId);
            if (result) {
                this._server.to(data.roomId).emit(ActiveGameEvents.CombatUpdate, result);
            }
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.CombatAction)
    // eslint-disable-next-line complexity
    async handleCombatAction(@MessageBody() data: CombatAction) {
        try {
            const room = this.gameRoomService.getRoom(data.roomId);
            const combatBefore = room?.gameState?.combat;
            const combatantIds = combatBefore ? [combatBefore.attacker, combatBefore.defender] : [];

            const result = this.combatService.processCombatAction(data.action, data.roomId);
            if (result?.teamCombatContinues && result.defeatedPlayerId) {
                const roomForDrop = this.gameRoomService.getRoom(data.roomId);
                const defeatedForDrop = roomForDrop?.players.find((p) => p.id === result.defeatedPlayerId);
                if (defeatedForDrop) {
                    this.gameLogic.dropPlayerItems(defeatedForDrop, data.roomId, roomForDrop);
                    defeatedForDrop.inventory = [];
                }
            }

            this._server.to(data.roomId).emit(ActiveGameEvents.CombatUpdate, result);

            this.notifyFastEliminationKill(data.roomId, room, result);

            if (result?.nextVPAttackerId && !result.teamCombatContinues && result.gameState?.combat) {
                const roomForVP = this.gameRoomService.getRoom(data.roomId);
                const vp = roomForVP?.players.find((p) => p.id === result.nextVPAttackerId);
                if (vp) {
                    const timeout = setTimeout(() => {
                        if (this.gameRoomService.getRoom(data.roomId)) {
                            this.virtualPlayerService.combatAnswer(vp, data.roomId);
                        }
                        this.gameRoomService.unregisterRoomTimeout(data.roomId, timeout);
                    }, VP_POST_ANIMATION_DELAY);
                    this.gameRoomService.registerRoomTimeout(data.roomId, timeout);
                }
            }

            if (result && 'gameState' in result) {
                const isCombatOver = result.message === CombatResults.AttackDefeated || result.message === CombatResults.EscapeSucceeded;

                if (result.teamCombatContinues) {
                    if (result.defeatedPlayerId) {
                        const defeated = room.players.find((p) => p.id === result.defeatedPlayerId);
                        if (defeated) {
                            const prevPosition = defeated.position ?? defeated.startingPoint;
                            const nextPos = this.gameLogic.setNextPosition(defeated, data, room) ?? prevPosition;
                            if (!prevPosition || !nextPos) return;

                            this._server.to(data.roomId).emit(ActiveGameEvents.PlayerNextPosition, {
                                player: { ...defeated, position: prevPosition },
                                nextPosition: nextPos,
                            });
                            defeated.position = nextPos;
                        }
                    } else if (result.escapedPlayerId) {
                        const escaper = room.players.find((p) => p.id === result.escapedPlayerId);
                        if (escaper) {
                            this._server.to(data.roomId).emit(ActiveGameEvents.PlayerNextPosition, {
                                player: escaper,
                                nextPosition: escaper.position,
                            });
                        }
                    }

                    this._server.to(data.roomId).emit(ActiveGameEvents.MapRequest);

                    if (result.nextVPAttackerId) {
                        const vp = room.players.find((p) => p.id === result.nextVPAttackerId);
                        if (vp) {
                            const timeout = setTimeout(() => {
                                if (this.gameRoomService.getRoom(data.roomId)) {
                                    this.virtualPlayerService.combatAnswer(vp, data.roomId);
                                }
                                this.gameRoomService.unregisterRoomTimeout(data.roomId, timeout);
                            }, VP_POST_ANIMATION_DELAY);
                            this.gameRoomService.registerRoomTimeout(data.roomId, timeout);
                        }
                    }

                    return;
                }

                if (isCombatOver && combatantIds.length > 0) {
                    await this.setCombatStatus(data.roomId, combatantIds[0], combatantIds[1], PlayerStatus.Online);
                }

                if (!result.gameState?.isEscape && !result.gameState.combat) {
                    if (result.losingPlayerIds && result.losingPlayerIds.length > 0) {
                        if (result.defeatedPlayerId) {
                            const loser = room.players.find((p) => p.id === result.defeatedPlayerId);
                            if (loser) {
                                const prevPosition = loser.position ?? loser.startingPoint;
                                const nextPosition = this.gameLogic.setNextPosition(loser, data, room) ?? prevPosition;
                                if (!prevPosition || !nextPosition) return;

                                this._server.to(data.roomId).emit(ActiveGameEvents.PlayerNextPosition, {
                                    player: { ...loser, position: prevPosition },
                                    nextPosition,
                                });
                                loser.position = nextPosition;
                            }
                        }
                        await this.gameLogic.handleTeamCombatEnd(data, room, result);
                    } else if (!result.gameState.combat && result.message !== CombatResults.EscapeSucceeded) {
                        const player = result.gameState.players[1];
                        const nextPosition = this.gameLogic.setNextPosition(player, data, room);
                        this._server.to(data.roomId).emit(ActiveGameEvents.PlayerNextPosition, { player, nextPosition });
                        if (room) {
                            await this.gameLogic.handleCombat(player, data, nextPosition, room, result);
                        }
                    }

                    // Fast Elimination: end game immediately when one player remains
                    if (room?.gameState?.isGameOver && room.lobbyGameMode === LobbyGameMode.FastElimination) {
                        await this.handleEndGame({ roomId: data.roomId, grid: room.map });
                        return;
                    }
                }

                if (result.message === CombatResults.EscapeSucceeded && room?.currentTurn && room.currentTurn.type) {
                    this.handleEndTurn({ roomId: data.roomId });
                }
            }
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.ToggledDoor)
    handleDoorToggle(@MessageBody() data: ToggleDoor) {
        try {
            const room = this.gameRoomService.getRoom(data.roomId);

            const playerOnTile = room.players?.find((p) => p.position?.x === data.position.x && p.position?.y === data.position.y);

            if (playerOnTile) return;

            if (!room.globalStats.doorsUsed.some((tile) => tile.x === data.position.x && tile.y === data.position.y)) {
                room.globalStats.doorsUsed.push(data.position);
            }

            data.player = room.currentTurn;
            this._server.to(data.roomId).emit(ActiveGameEvents.DoorUpdate, data);
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.DropIn)
    async handleDropIn(@MessageBody() data: { roomId: string; player: string }) {
        try {
            const movingPlayer = data.player;
            const room = this.gameRoomService.getRoom(data.roomId);
            const playerInRoom: Player = room.players.find((player) => player.id === movingPlayer);
            const currentUid = room.playerUids.get(playerInRoom.id);
            const previousPlayer = currentUid ? (room.disconnectedPlayers ?? []).filter((p) => p.firebaseUid === currentUid) : [];
            playerInRoom.playerStats = {
                nCombats: 0,
                nEvasions: 0,
                nVictories: 0,
                nDefeats: 0,
                hpLost: 0,
                hpDealt: 0,
                nItemsCollected: 0,
                tilesVisited: [],
                tilesVisitedPercentage: 0,
            };

            if (previousPlayer.length > 0) {
                playerInRoom.playerStats = previousPlayer[0].playerStats;
                playerInRoom.victories = previousPlayer[0].victories;
                playerInRoom.inventory = [];
            }
            room.disconnectedPlayers = (room.disconnectedPlayers ?? []).filter((p) =>
                currentUid ? p.firebaseUid !== currentUid : p.name !== playerInRoom.name,
            );

            if (room?.teams) {
                const playerTeam = room.teams.find((t) => t.players.some((p) => p.id === playerInRoom.id));
                if (playerTeam) {
                    const playerSocket = this.server.sockets.sockets.get(playerInRoom.id);
                    if (playerSocket) {
                        playerSocket.join(`${data.roomId}-${playerTeam.id}`);
                    }
                }
                this.server.to(data.roomId).emit(GameRoomEvents.UpdateTeams, {
                    teams: room.teams,
                });
            }
            room.map.board[playerInRoom.position.x][playerInRoom.position.y].item.name = ItemTypes.StartingPoint;
            room.map.board[playerInRoom.position.x][playerInRoom.position.y].item.description = ITEM_DESCRIPTIONS[ItemTypes.StartingPoint];
            room.map.board[playerInRoom.position.x][playerInRoom.position.y].player = playerInRoom;
            this._server.to(data.roomId).emit(ActiveGameEvents.SpawnPlayer, {
                player: playerInRoom,
                players: room.players,
                disconnectedPlayers: room.disconnectedPlayers ?? [],
            });
            if (room.isDebug) {
                this._server.to(data.roomId).emit(DebugEvents.ToggleDebug, { isDebug: room.isDebug });
            }
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.MovePlayer)
    async handleMovePlayer(@MessageBody() data: MovePlayer) {
        try {
            const movingPlayer = data.player;
            let playerInRoom;
            let nextPosition;

            this._server.to(data.roomId).emit(ActiveGameEvents.PlayerStartedMoving);

            for (let i = 0; i < data.path.positions.length; i++) {
                const room = this.gameRoomService.getRoom(data.roomId);
                if (!room) return;
                playerInRoom = room.players.find((player) => player.id === movingPlayer.id);
                nextPosition = data.path.positions[i];
                if (await this.gameLogic.moveAction({ room, movingPlayer, data, index: i, playerInRoom, nextPosition })) {
                    break;
                }
            }

            if (playerInRoom) {
                playerInRoom.position = nextPosition;
            }
            this._server.to(data.roomId).emit(ActiveGameEvents.MapRequest);
            this._server.to(data.roomId).emit(ActiveGameEvents.PlayerStoppedMoving);
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.NextTurn)
    handleEndTurn(@MessageBody() data: SocketPayload) {
        try {
            const room = this.gameRoomService.getRoom(data.roomId);
            if (!room) return;

            const currentPlayer = this.gameModeService.nextTurn(data.roomId);
            if (!currentPlayer) {
                this.gameRoomService.removeRoom(data.roomId);
                return;
            }
            const nbActions = room.map?.nbActions ?? 1;
            currentPlayer.actionsLeft = nbActions;
            if (currentPlayer.type) {
                this._server.to(data.roomId).emit(ActiveGameEvents.MapRequest);
                this.gameLogic.turnAction(data.roomId, currentPlayer);
            }
            room.globalStats.totalTurns++;
            this.turnService.broadcastTurnUpdate(this._server, data.roomId, currentPlayer);
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.FetchStats)
    async handleEndGame(@MessageBody() data: { roomId: string; grid: Grid }) {
        try {
            const room = this.gameRoomService.getRoom(data.roomId);
            if (!room || room.statsRecorded) return;
            if (room.map?.gameMode === GameModes.Classic && room.lobbyGameMode === LobbyGameMode.FastElimination && !room.gameState?.isGameOver) {
                return;
            }

            const players = room.players;
            const allPlayers = room.disconnectedPlayers?.length > 0 ? [...players, ...room.disconnectedPlayers] : [...players];

            this.gameModeService.setGlobalStats(room);

            const winnerSocketIds = this.determineWinners(room);
            const rewards = await this.virtualCurrencyService.distributeEndGameRewards(room, winnerSocketIds);

            await this.gameModeService.recordPlayerStats(room, allPlayers, winnerSocketIds);

            for (const player of players) {
                if (player.type) continue;
                const uid = room.playerUids?.get(player.id);
                if (uid) {
                    await this.friendsGateway.updateStatus(uid, PlayerStatus.Online);
                }
            }

            this._server.to(data.roomId).emit(ActiveGameEvents.GameEnded, {
                players: allPlayers,
                globalStats: room.globalStats,
                rewards,
                gameMode: room.map?.gameMode,
            });

            // Notify all clients so the join page updates dynamically
            // without requiring a refresh. The room is kept alive so that
            // the end-page chat continues to work; it will be cleaned up
            // when the last player disconnects or leaves.
            this.gameRoomService.notifyPublicRoomsChanged();
        } catch (error) {
            Logger.log(error);
        }
    }

    @SubscribeMessage(ActiveGameEvents.MapRequest)
    handleMapRequest(@MessageBody() data: { roomId: string; map: BoardCell[][] }) {
        try {
            this.gameRoomService.getRoom(data.roomId).map.board = data.map;
        } catch (error) {
            Logger.log(error);
        }
    }

    private notifyFastEliminationKill(roomId: string, room: RoomData | undefined, result: CombatActionResult | undefined): void {
        if (!room || room.lobbyGameMode !== LobbyGameMode.FastElimination) return;
        if (!result || result.message !== CombatResults.AttackDefeated) return;
        if (result.teamCombatContinues || (result.losingPlayerIds && result.losingPlayerIds.length > 0)) return;

        const loserFromState = result.gameState?.players?.[1];
        if (!loserFromState?.id) return;

        const loser = room.players.find((p) => p.id === loserFromState.id);
        if (!loser || loser.state !== PlayerState.ELIMINATED) return;

        const payload: GameDisconnect = {
            playerId: loser.id,
            remainingPlayers: [...room.players],
            itemInformation: { inventory: [], position: loser.position },
            disconnectedPlayers: [...(room.disconnectedPlayers ?? [])],
        };
        this._server.to(roomId).emit(ActiveGameEvents.PlayerDisconnect, payload);
    }

    private async setCombatStatus(roomId: string, playerA: string, playerB: string, status: PlayerStatus) {
        const room = this.gameRoomService.getRoom(roomId);
        if (!room) return;

        for (const socketId of [playerA, playerB]) {
            if (!socketId) continue;
            const uid = room.playerUids.get(socketId);
            if (uid) {
                await this.friendsGateway.updateStatus(uid, status);
            }
        }
    }

    private determineWinners(room: RoomData): string[] {
        const WINNING_CONDITION = 3;

        if (room.lobbyGameMode === LobbyGameMode.FastElimination) {
            const survivors = room.players.filter((player) => player.state !== PlayerState.ELIMINATED && !player.isSpectator);
            return survivors.length === 1 ? [survivors[0].id] : [];
        }

        if (room.map.gameMode === GameModes.Classic) {
            const winner = room.players.find((p) => p.victories >= WINNING_CONDITION);
            return winner ? [winner.id] : [];
        } else {
            return room.players.filter((p) => p.victories > 0).map((p) => p.id);
        }
    }
}
