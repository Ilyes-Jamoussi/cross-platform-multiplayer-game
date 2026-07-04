import { FIRST_TURN_TIMEOUT_MS, MAX_SOCKET_LISTENERS } from '@app/constants/game-room-constants';
import { GAME_ROOM_MESSAGES } from '@app/constants/messages';
import { AuthService } from '@app/services/auth/auth.service';
import { DebugService } from '@app/services/debug/debug-service.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TurnService } from '@app/services/turns/turn-service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { LobbyGameMode, PlayerState } from '@common/enums';
import { ActiveGameEvents, DebugEvents, GameRoomEvents } from '@common/gateway-events';
import { AvatarUpdate, KickPayload, Player, PlayerDisconnect, RoomData, SocketPayload, VirtualPlayerPayload } from '@common/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class GameRoomGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer()
    private readonly server: Server;

    // eslint-disable-next-line max-params
    constructor(
        private readonly logger: Logger,
        private gameRoomService: GameRoomService,
        private turnService: TurnService,
        private debugService: DebugService,
        private virtualPlayerService: VirtualPlayerService,
        private authService: AuthService,
    ) {}

    @SubscribeMessage(GameRoomEvents.JoinGame)
    async handleJoinGame(client: Socket, payload: SocketPayload): Promise<void> {
        const room = this.gameRoomService.getRoom(payload.roomId);

        if (!room) {
            client.emit(GameRoomEvents.KickUpdate, { message: 'server_msg.room_not_found' });
            return;
        }

        if (!payload.token) {
            client.emit(GameRoomEvents.KickUpdate, { message: 'server_msg.auth_required' });
            return;
        }

        try {
            const decodedToken = await this.authService.verifyToken(payload.token);
            const joiningUid = decodedToken.uid;
            const reconnectedPlayer = this.gameRoomService.reconnectObserver(payload.roomId, client.id, joiningUid);

            if (reconnectedPlayer) {
                client.join(payload.roomId);
                client.emit(GameRoomEvents.JoinAccepted, { roomId: payload.roomId, player: reconnectedPlayer, hasGameStarted: true });
                return;
            }

            if (room.dropInDropOutEnabled && room.hasGameStarted) {
                this.cleanupGhostObservers(payload.roomId, room);
            }

            // In FastElim, a player who went through selectAvatar (thus present in room.players) must
            // be able to join the socket room even if isLocked is true (the drop-in filled the
            // last slot and triggered the lock, but that same player must still get in).
            const isFastElimDropInJoiner =
                room.lobbyGameMode === LobbyGameMode.FastElimination &&
                room.hasGameStarted &&
                room.players.some((p) => p.id === client.id);

            if (room.isLocked && !(room.dropInDropOutEnabled && room.hasGameStarted) && !isFastElimDropInJoiner) {
                client.emit(GameRoomEvents.JoinDenied, { message: 'server_msg.game_locked' });
                return;
            }

            if (room.isFriendsOnly) {
                const hostUid = room.hostUid;

                if (!hostUid) {
                    client.emit(GameRoomEvents.KickUpdate, { message: 'server_msg.invalid_config' });
                    return;
                }

                const hostUser = await this.authService.findByFirebaseUid(hostUid);
                if (!hostUser) {
                    client.emit(GameRoomEvents.KickUpdate, { message: 'server_msg.host_not_found' });
                    return;
                }

                const isFriend = hostUser.friendList?.includes(joiningUid);

                if (!isFriend) {
                    client.emit(GameRoomEvents.JoinDenied, { message: 'server_msg.friends_only' });
                    return;
                }
            }

            client.join(payload.roomId);
            client.emit(GameRoomEvents.JoinAccepted, { roomId: payload.roomId });
            this.broadcastAvatarUpdate(payload.roomId);
            this.broadcastPublicRooms();
        } catch (error) {
            client.emit(GameRoomEvents.KickUpdate, { message: 'server_msg.invalid_token' });
        }
    }

    @SubscribeMessage(GameRoomEvents.AvatarUpdate)
    handleAvatarUpdate(client: Socket, payload: AvatarUpdate) {
        if (payload.nextAvatar) {
            this.gameRoomService.updateAvatar(payload, client.id);
        }
        this.broadcastAvatarUpdate(payload.roomId);
    }

    @SubscribeMessage(GameRoomEvents.RoomUpdate)
    handleRoomUpdate(@MessageBody() payload: SocketPayload) {
        const { roomId } = payload;
        const room = this.gameRoomService.getRoom(roomId);

        if (!room) {
            this.logger.warn(`RoomUpdate: no room found for roomId="${roomId}" — client may be out of sync; broadcast skipped if room stays missing`);
        } else {
            const playerCount = room.players?.length ?? 0;
            this.logger.log(
                `RoomUpdate: roomId=${roomId} players=${playerCount}/${room.playerMax} min=${room.playerMin} ` +
                    `mode=${room.lobbyGameMode ?? 'n/a'} locked=${room.isLocked} friendsOnly=${room.isFriendsOnly} ` +
                    `started=${room.hasGameStarted} entryFee=${room.entryFee} mapId=${room.mapId ?? 'n/a'}`,
            );
        }

        this.broadcastRoomUpdate(roomId);
    }

    @SubscribeMessage(GameRoomEvents.KickPlayer)
    async handleKickPlayer(@MessageBody() payload: KickPayload) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            const isKicked = await this.gameRoomService.kickPlayer(payload.roomId, payload.player);
            if (isKicked) {
                const playerSocket = this.server.sockets.sockets.get(payload.player);
                if (playerSocket) {
                    void playerSocket.leave(payload.roomId);
                    playerSocket.emit(GameRoomEvents.KickUpdate, { message: GAME_ROOM_MESSAGES.playerKicked });
                }
                this.broadcastRoomUpdate(payload.roomId);
                this.broadcastAvatarUpdate(payload.roomId);
                this.broadcastPublicRooms();
                this.logger.log(`Player ${payload.player} kicked from room ${payload.roomId}`);
            }
        }
    }

    @SubscribeMessage(GameRoomEvents.ToggleFriendOnly)
    handleToggleFriendOnly(@MessageBody() payload: SocketPayload) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            const isFriendsOnly = this.gameRoomService.toggleFriendOnly(payload.roomId);
            this.server.to(payload.roomId).emit(GameRoomEvents.ToggleFriendOnly, { isFriendsOnly });
            this.broadcastPublicRooms();
        }
    }

    @SubscribeMessage(GameRoomEvents.ToggleLock)
    handleToggleLock(@MessageBody() payload: SocketPayload) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            const isLocked = this.gameRoomService.toggleLock(payload.roomId);
            this.server.to(payload.roomId).emit(GameRoomEvents.ToggleLock, { isLocked });
            this.broadcastPublicRooms();
        }
    }

    @SubscribeMessage(GameRoomEvents.ToggleDropInDropOut)
    toggleDropInDropOut(@MessageBody() data: { roomId: string }) {
        const room = this.gameRoomService.getRoom(data.roomId);

        if (!room || room.hasGameStarted) return;

        room.dropInDropOutEnabled = !room.dropInDropOutEnabled;

        this.server.to(data.roomId).emit(GameRoomEvents.ToggleDropInDropOut, { dropInDropOutEnabled: room.dropInDropOutEnabled });
        this.broadcastPublicRooms();
    }

    @SubscribeMessage(GameRoomEvents.SetLobbyGameMode)
    setLobbyGameMode(client: Socket, payload: { roomId: string; mode: LobbyGameMode }) {
        const room = this.gameRoomService.setLobbyGameMode(payload.roomId, payload.mode);

        if (!room) return;

        this.server.to(payload.roomId).emit(GameRoomEvents.SetLobbyGameMode, {
            lobbyGameMode: room.lobbyGameMode,
        });
        this.logger.log(`LobbyGameMode set to ${payload.mode} in room ${payload.roomId}`);

        if (room.lobbyGameMode === LobbyGameMode.Teams) {
            this.server.to(payload.roomId).emit(GameRoomEvents.UpdateTeams, {
                teams: room.teams,
            });
            this.logger.log(`Teams in room ${payload.roomId} are ${room.teams}`);
            for (const [, team] of Object.entries(room.teams)) {
                team.players.forEach((player) => {
                    const socket = this.server.sockets.sockets.get(player.id);
                    if (socket) {
                        room?.teams?.forEach((playerTeam) => {
                            socket.leave(`${payload.roomId}-${playerTeam.id}`);
                        });
                        socket.join(`${payload.roomId}-${team.id}`);
                    }
                });
            }
        }
    }

    @SubscribeMessage(GameRoomEvents.ToggleFogOfWar)
    handleToggleFogOfWar(@MessageBody() data: { roomId: string }) {
        const room = this.gameRoomService.getRoom(data.roomId);
        if (!room || room.hasGameStarted) return;
        room.isFogOfWar = !room.isFogOfWar;
        this.server.to(data.roomId).emit(GameRoomEvents.ToggleFogOfWar, {
            isFogOfWar: room.isFogOfWar,
        });
    }

    @SubscribeMessage(GameRoomEvents.AddVirtualPlayer)
    handleAddVirtualPlayer(@MessageBody() payload: VirtualPlayerPayload) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            this.gameRoomService.addVirtualPlayer(payload.roomId, payload.type);
        }
        this.broadcastRoomUpdate(payload.roomId);
        this.broadcastAvatarUpdate(payload.roomId);
        this.broadcastPublicRooms();
    }

    @SubscribeMessage(GameRoomEvents.SelectTeam)
    handleSelectTeam(@MessageBody() payload: { roomId: string; player: Player; teamId: string }) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            const room = this.gameRoomService.getRoom(payload.roomId);
            if (room) {
                const updatedTeams = this.gameRoomService.assignPlayerToTeam(payload.roomId, payload.player.id, payload.teamId);
                const playerSocket = this.server.sockets.sockets.get(payload.player.id);

                if (playerSocket) {
                    const teamRoomId = this.gameRoomService.getTeamRoomId(payload.roomId, payload.teamId);
                    room?.teams?.forEach((team) => {
                        playerSocket.leave(`${payload.roomId}-${team.id}`);
                    });
                    playerSocket.join(teamRoomId);
                }

                this.server.to(payload.roomId).emit(GameRoomEvents.UpdateTeams, { teams: updatedTeams });
                this.logger.log(`Player ${payload.player.id} joined team ${payload.teamId} in room ${payload.roomId}`);
            }
        }
    }

    @SubscribeMessage(GameRoomEvents.LeaveTeam)
    handleLeaveTeam(@MessageBody() payload: { roomId: string; player: Player }) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            const room = this.gameRoomService.getRoom(payload.roomId);
            if (room) {
                const updatedTeams = this.gameRoomService.removePlayerFromTeam(payload.roomId, payload.player.id);
                this.server.to(payload.roomId).emit(GameRoomEvents.UpdateTeams, { teams: updatedTeams });
                this.logger.log(`Player ${payload.player.id} left team in room ${payload.roomId}`);
            }
        }
    }

    @SubscribeMessage(GameRoomEvents.VirtualPlayerTeamChanged)
    handleChangeVirtualPlayerTeam(
        @MessageBody() payload: { roomId: string; playerId: string; targetTeamId: string; firebaseUid: string },
        @ConnectedSocket() client: Socket,
    ) {
        const room = this.gameRoomService.getRoom(payload.roomId);

        if (!room || room.hostUid !== payload.firebaseUid) {
            this.logger.error(`Tentative non autorisée de déplacement par ${client.id}`);
            return;
        }

        const updatedTeams = this.gameRoomService.changeVirtualPlayerTeam(payload.roomId, payload.playerId, payload.targetTeamId);

        this.server.to(payload.roomId).emit(GameRoomEvents.UpdateTeams, { teams: updatedTeams });
        this.logger.log(`Virtual Player ${payload.playerId} changed team in room ${payload.roomId}`);
    }

    @SubscribeMessage(GameRoomEvents.StartGame)
    handleStartGame(@MessageBody() payload: SocketPayload) {
        if (this.gameRoomService.hasRoom(payload.roomId)) {
            const room = this.gameRoomService.getRoom(payload.roomId);

            if (room && room.players.length > 0) {
                room.startTime = new Date();
                room.disconnectedPlayers = [];
                room.statsRecorded = false;
                room.recordedStatsUids = new Set<string>();
                room.globalStats = {
                    duration: 0,
                    totalTurns: 1,
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                    doorsUsed: [],
                    doorsUsedPercent: 0,
                    flagHolders: [],
                };
                room.players.forEach((playerToCheck) => {
                    playerToCheck.playerStats = {
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
                });

                const player = this.turnService.setFirstTurn(payload.roomId, room.players);

                // Track which players need to signal ready before the first turn starts.
                // Virtual players are always ready.
                const humanCount = room.players.filter((p) => !p.type).length;
                room.readyPlayerIds = new Set<string>();
                room.pendingFirstTurn = player;
                if (humanCount === 0) {
                    // All VPs — start immediately
                    room.pendingFirstTurn = undefined;
                    if (player?.type) {
                        this.virtualPlayerService.turnAction(payload.roomId, player);
                    }
                    this.turnService.broadcastTurnUpdate(this.server, payload.roomId, player);
                }

                this.server.to(payload.roomId).emit(GameRoomEvents.StartGame);
                this.server.to(payload.roomId).emit(DebugEvents.ToggleDebug, { isDebug: room.isDebug });
                this.broadcastPublicRooms();

                // Fallback: if not all players signal ready within 10 seconds, start anyway.
                if (humanCount > 0) {
                    const timeout = setTimeout(() => {
                        const currentRoom = this.gameRoomService.getRoom(payload.roomId);
                        if (currentRoom?.pendingFirstTurn) {
                            this.startFirstTurn(payload.roomId, currentRoom);
                        }
                        this.gameRoomService.unregisterRoomTimeout(payload.roomId, timeout);
                    }, FIRST_TURN_TIMEOUT_MS);
                    this.gameRoomService.registerRoomTimeout(payload.roomId, timeout);
                }
            }
        }
    }

    @SubscribeMessage(ActiveGameEvents.PlayerReady)
    handlePlayerReady(@ConnectedSocket() client: Socket, @MessageBody() payload: SocketPayload) {
        const room = this.gameRoomService.getRoom(payload.roomId);
        if (!room) return;

        if (room.pendingFirstTurn) {
            if (!room.readyPlayerIds) room.readyPlayerIds = new Set();
            room.readyPlayerIds.add(client.id);

            const humanCount = room.players.filter((p) => !p.type).length;
            if (room.readyPlayerIds.size >= humanCount) {
                this.startFirstTurn(payload.roomId, room);
            }
            return;
        }

        if (room.hasGameStarted && room.currentTurn) {
            client.emit(ActiveGameEvents.TurnUpdate, { player: room.currentTurn });
        }
    }

    @SubscribeMessage(GameRoomEvents.LeaveGame)
    async handleLeaveGame(client: Socket, payload: SocketPayload) {
        client.leave(payload.roomId);
        await this.handlePlayerExit(client, payload.roomId);
    }

    @SubscribeMessage(DebugEvents.ToggleDebug)
    handleToggleDebug(@MessageBody() data: SocketPayload) {
        const room = this.debugService.toggleDebug(data.roomId);
        this.logger.log(`Debug mode set to ${room.isDebug} for room ${data.roomId}`);
        this.server.to(data.roomId).emit(DebugEvents.ToggleDebug, { isDebug: room.isDebug });
    }

    @SubscribeMessage(DebugEvents.RequestDebugState)
    handleRequestDebugState(@ConnectedSocket() client: Socket, @MessageBody() data: SocketPayload) {
        const room = this.gameRoomService.getRoom(data.roomId);
        if (room) {
            client.emit(DebugEvents.ToggleDebug, { isDebug: !!room.isDebug });
        }
    }

    afterInit() {
        this.logger.log('GameRoom WebSocket Gateway initialized');
        this.gameRoomService.onPublicRoomsChanged$.subscribe(() => {
            this.broadcastPublicRooms();
        });
    }

    handleConnection(client: Socket) {
        client.setMaxListeners(MAX_SOCKET_LISTENERS);
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        this.handlePlayerExit(client);
    }

    private startFirstTurn(roomId: string, room: RoomData) {
        const player = room.pendingFirstTurn;
        room.pendingFirstTurn = undefined;
        room.readyPlayerIds = undefined;
        if (!player) return;
        if (player.type) {
            this.server.to(roomId).emit(ActiveGameEvents.MapRequest);
            this.virtualPlayerService.turnAction(roomId, player);
        }
        this.turnService.broadcastTurnUpdate(this.server, roomId, player);
    }

    // eslint-disable-next-line complexity
    private async handlePlayerExit(client: Socket, explicitRoomId?: string) {
        const roomId = explicitRoomId || this.turnService.findRoomFromClient(client.id);
        if (!roomId) return;

        const roomBeforeExit = this.gameRoomService.getRoom(roomId);
        if (!roomBeforeExit) return;

        const leavingPlayer = roomBeforeExit.players.find((player) => player.id === client.id);
        const isObserverInFastElimination =
            !!leavingPlayer &&
            roomBeforeExit.hasGameStarted &&
            roomBeforeExit.lobbyGameMode === LobbyGameMode.FastElimination &&
            (leavingPlayer.state === PlayerState.ELIMINATED || !!leavingPlayer.isSpectator);
        const isVoluntaryLeave = !!explicitRoomId;
        const preserveObserverSlot = isObserverInFastElimination && !isVoluntaryLeave;

        const isFastElim = roomBeforeExit.lobbyGameMode === LobbyGameMode.FastElimination;
        const otherPlayersCount = roomBeforeExit.players.filter(
            (p) => p.id !== client.id && !(isFastElim && (p.state === PlayerState.ELIMINATED || p.isSpectator)),
        ).length;

        const isGameStarted = await this.turnService.handlePlayerQuit(roomId, client.id, this.server, preserveObserverSlot);
        const playerUpdate: PlayerDisconnect = await this.gameRoomService.removeClientFromRooms(client, !!isGameStarted);

        if (!playerUpdate.roomId) return;

        if (isObserverInFastElimination && preserveObserverSlot) {
            return;
        }

        if (isGameStarted) {
            if (otherPlayersCount <= 1) {
                if (!roomBeforeExit.statsRecorded) {
                    this.server.to(roomId).emit(GameRoomEvents.KickUpdate, {
                        message: 'server_msg.last_player',
                    });
                }
                this.gameRoomService.removeRoom(roomId);
            } else {
                if (playerUpdate.isHost || this.debugService.hasHostLeft(roomId)) {
                    this.server.to(roomId).emit(DebugEvents.ToggleDebug, { isDebug: false });
                }
                if (typeof isGameStarted !== 'boolean' && isGameStarted?.type) {
                    this.virtualPlayerService.turnAction(roomId, isGameStarted);
                }
            }
        } else {
            if (playerUpdate.isHost) {
                if (otherPlayersCount > 0) {
                    this.server.to(roomId).emit(GameRoomEvents.KickUpdate, {
                        message: 'server_msg.host_left',
                    });
                }
            } else {
                this.broadcastRoomUpdate(roomId);
                this.broadcastAvatarUpdate(roomId);
            }
        }
        this.broadcastPublicRooms();
    }

    private broadcastRoomUpdate(roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        if (room) {
            this.server.to(roomId).emit(GameRoomEvents.RoomUpdate, {
                players: room.players,
                playerMin: room.playerMin,
                playerMax: room.playerMax,
                isFriendsOnly: room.isFriendsOnly,
                isLocked: room.isLocked,
                lobbyGameMode: room.lobbyGameMode,
                teams: room.teams,
                entryFee: room.entryFee,
                dropInDropOutEnabled: room.dropInDropOutEnabled,
            });
        }
    }

    private broadcastAvatarUpdate(roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        if (room) {
            this.server.to(roomId).emit(GameRoomEvents.AvatarUpdate, {
                selectedAvatars: Array.from(room.selectedAvatars.values()),
            });
        }
    }

    private broadcastPublicRooms() {
        for (const socket of this.server.sockets.sockets.values()) {
            const firebaseUid: string | undefined = socket.data?.uid;
            socket.emit(GameRoomEvents.PublicRoomsUpdate, this.gameRoomService.getPublicRooms(firebaseUid));
        }
    }

    private cleanupGhostObservers(roomId: string, room: RoomData) {
        const ghosts = room.players.filter((p) => (p.state === PlayerState.ELIMINATED || p.isSpectator) && !this.server.sockets.sockets.has(p.id));
        for (const ghost of ghosts) {
            this.gameRoomService.removeGhostPlayer(roomId, ghost.id);
        }
    }
}
