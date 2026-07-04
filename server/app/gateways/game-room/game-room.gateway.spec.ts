import { AuthService } from '@app/services/auth/auth.service';
import { DebugService } from '@app/services/debug/debug-service.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TimerService } from '@app/services/time/time.service';
import { TurnService } from '@app/services/turns/turn-service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { LobbyGameMode, PlayerState, VirtualPlayerTypes } from '@common/enums';
import { ActiveGameEvents, DebugEvents, GameRoomEvents } from '@common/gateway-events';
import { Player, RoomData } from '@common/interfaces';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EMPTY } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { GameRoomGateway } from './game-room.gateway';

describe('GameRoomGateway', () => {
    let gateway: GameRoomGateway;
    let gameRoomService: jest.Mocked<GameRoomService>;
    let mockLogger: jest.Mocked<Logger>;
    let mockServer: jest.Mocked<Server>;
    let client: jest.Mocked<Socket>;
    let broadcastAvatarUpdate: jest.SpyInstance;
    let broadcastRoomUpdate: jest.SpyInstance;
    let mockDebug: jest.Mocked<DebugService>;
    let mockVirtualPlayers: jest.Mocked<VirtualPlayerService>;
    let mockTurnService: jest.Mocked<TurnService>;
    let mockAuthService: jest.Mocked<AuthService>;

    beforeEach(async () => {
        gameRoomService = {
            hasRoom: jest.fn(),
            rooms: new Map(),
            getRoom: jest.fn(),
            reconnectObserver: jest.fn(),
            kickPlayer: jest.fn(),
            toggleLock: jest.fn(),
            addVirtualPlayer: jest.fn(),
            removeClientFromRooms: jest.fn(),
            removeRoom: jest.fn(),
            updateAvatar: jest.fn(),
            selectAvatar: jest.fn(),
            getPublicRooms: jest.fn().mockReturnValue([]),
            onPublicRoomsChanged$: EMPTY,
            notifyPublicRoomsChanged: jest.fn(),
        } as unknown as jest.Mocked<GameRoomService>;

        gameRoomService.getRoom.mockImplementation((id: string) => gameRoomService.rooms.get(id));

        mockLogger = {
            log: jest.fn(),
            warn: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        mockVirtualPlayers = {
            turnAction: jest.fn(),
        } as unknown as jest.Mocked<VirtualPlayerService>;

        mockDebug = {
            toggleDebug: jest.fn(),
            hasHostLeft: jest.fn(),
        } as unknown as jest.Mocked<DebugService>;

        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            sockets: {
                sockets: new Map(),
            },
        } as unknown as jest.Mocked<Server>;

        mockTurnService = {
            setFirstTurn: jest.fn(),
            findRoomFromClient: jest.fn(),
            handlePlayerQuit: jest.fn(),
            broadcastTurnUpdate: jest.fn(),
        } as unknown as jest.Mocked<TurnService>;

        mockAuthService = {
            verifyToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
        } as unknown as jest.Mocked<AuthService>;

        mockVirtualPlayers = {
            turnAction: jest.fn(),
        } as unknown as jest.Mocked<VirtualPlayerService>;

        client = {
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            setMaxListeners: jest.fn(),
            broadcast: {
                to: jest.fn().mockReturnThis(),
            },
            id: 'client1',
        } as unknown as jest.Mocked<Socket>;
        (client.broadcast.to as jest.Mock).mockReturnValue({
            emit: jest.fn(),
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameRoomGateway,
                { provide: GameRoomService, useValue: gameRoomService },
                { provide: Logger, useValue: mockLogger },
                { provide: TurnService, useValue: mockTurnService },
                { provide: TimerService, useClass: TimerService },
                { provide: DebugService, useValue: mockDebug },
                { provide: VirtualPlayerService, useValue: mockVirtualPlayers },
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compile();

        gateway = module.get<GameRoomGateway>(GameRoomGateway);
        Object.defineProperty(gateway, 'server', { value: mockServer, writable: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        broadcastAvatarUpdate = jest.spyOn(gateway as any, 'broadcastAvatarUpdate');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        broadcastRoomUpdate = jest.spyOn(gateway as any, 'broadcastRoomUpdate');
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('events', () => {
        const roomId = 'room1';
        const payload = { roomId, player: 'player1', type: VirtualPlayerTypes.Aggressive };
        const room = {
            players: [],
            selectedAvatars: new Map(),
            playerMin: 1,
            playerMax: 4,
            isLocked: false,
            isDebug: false,
            isFriendsOnly: false,
            entryFee: 0,
            playerUids: new Map<string, string>(),
            paidPlayers: new Set<string>(),
            hasGameStarted: false,
            dropInDropOutEnabled: false,
            isHostReady: false,
        };

        it('should handle join game', async () => {
            gameRoomService.rooms.set(payload.roomId, room);

            await gateway.handleJoinGame(client, { ...payload, token: 'fake-token' });

            expect(client.join).toHaveBeenCalledWith(payload.roomId);
        });

        it('should reconnect an eliminated observer directly into the running game', async () => {
            const reconnectedPlayer = { ...MOCK_PLAYERS[0], state: 'eliminated', isSpectator: true } as unknown as Player;
            gameRoomService.rooms.set(payload.roomId, { ...room, isLocked: true, hasGameStarted: true } as RoomData);
            gameRoomService.reconnectObserver.mockReturnValue(reconnectedPlayer);

            await gateway.handleJoinGame(client, { ...payload, token: 'fake-token' });

            expect(client.join).toHaveBeenCalledWith(payload.roomId);
            expect(client.emit).toHaveBeenCalledWith(GameRoomEvents.JoinAccepted, {
                roomId: payload.roomId,
                player: reconnectedPlayer,
                hasGameStarted: true,
            });
        });

        it('should not preserve observer slot on voluntary LeaveGame for an eliminated spectator in fast elimination', async () => {
            const spectator = {
                ...MOCK_PLAYERS[0],
                id: client.id,
                isHost: false,
                state: PlayerState.ELIMINATED,
                isSpectator: true,
            } as Player;
            const roomWithObserver = {
                ...room,
                players: [spectator, { ...MOCK_PLAYERS[1], id: 'active-player', isHost: true }],
                hasGameStarted: true,
                lobbyGameMode: LobbyGameMode.FastElimination,
            } as unknown as RoomData;
            gameRoomService.rooms.set(payload.roomId, roomWithObserver);
            mockTurnService.handlePlayerQuit.mockResolvedValue(true);
            gameRoomService.removeClientFromRooms.mockResolvedValue({ isHost: false, roomId: payload.roomId });

            await gateway.handleLeaveGame(client, { roomId: payload.roomId });

            expect(mockTurnService.handlePlayerQuit).toHaveBeenCalledWith(payload.roomId, client.id, mockServer, false);
        });

        it('should handle avatar update', () => {
            gateway.handleAvatarUpdate(client, payload);

            expect(broadcastAvatarUpdate).toHaveBeenCalledWith(payload.roomId);
        });

        it('should handle avatar update with nextAvatar', () => {
            const avatarPayload = {
                roomId: 'room1',
                nextAvatar: 'newAvatar',
                player: 'player1',
            };

            gateway.handleAvatarUpdate(client, avatarPayload);

            expect(gameRoomService.updateAvatar).toHaveBeenCalledWith(avatarPayload, client.id);
            expect(broadcastAvatarUpdate).toHaveBeenCalledWith(avatarPayload.roomId);
        });

        it('should handle room update', () => {
            gameRoomService.rooms.set(payload.roomId, room);

            gateway.handleRoomUpdate(payload);

            expect(mockLogger.log).toHaveBeenCalled();
            expect(broadcastRoomUpdate).toHaveBeenCalledWith(payload.roomId);
        });

        it('should handle toggle lock', () => {
            gameRoomService.hasRoom.mockReturnValue(true);
            gameRoomService.toggleLock.mockReturnValue(true);

            gateway.handleToggleLock(payload);

            expect(mockServer.to).toHaveBeenCalledWith(payload.roomId);
        });

        it('should handle add virtual player', () => {
            gameRoomService.hasRoom.mockReturnValue(true);

            gateway.handleAddVirtualPlayer(payload);

            expect(gameRoomService.addVirtualPlayer).toHaveBeenCalledWith(payload.roomId, payload.type);
            expect(broadcastRoomUpdate).toHaveBeenCalledWith(payload.roomId);
            expect(broadcastAvatarUpdate).toHaveBeenCalledWith(payload.roomId);
        });

        describe('handleStartGame', () => {
            it('should start the game and emit the correct events', () => {
                const mockPlayer = {
                    type: VirtualPlayerTypes.Aggressive,
                    playerStats: {},
                } as unknown as Player;

                const mockRoom = {
                    players: [mockPlayer],
                    isDebug: true,
                    disconnectedPlayers: ['someone'],
                } as unknown as RoomData;

                const mockFirstTurnPlayer = {
                    ...mockPlayer,
                    type: VirtualPlayerTypes.Aggressive,
                };

                gameRoomService.hasRoom.mockReturnValue(true);
                gameRoomService.rooms.set(payload.roomId, mockRoom);
                mockTurnService.setFirstTurn.mockReturnValue(mockFirstTurnPlayer);

                gateway.handleStartGame(payload);
                // eslint-disable-next-line @typescript-eslint/no-shadow
                const room = gameRoomService.rooms.get(payload.roomId);

                expect(mockTurnService.setFirstTurn).toHaveBeenCalledWith(payload.roomId, room.players);
                expect(mockVirtualPlayers.turnAction).toHaveBeenCalledWith(payload.roomId, mockFirstTurnPlayer);
                expect(mockServer.to(payload.roomId).emit).toHaveBeenCalledWith(GameRoomEvents.StartGame);
                expect(mockTurnService.broadcastTurnUpdate).toHaveBeenCalledWith(mockServer, payload.roomId, mockFirstTurnPlayer);
                expect(mockServer.to(payload.roomId).emit).toHaveBeenCalledWith(DebugEvents.ToggleDebug, { isDebug: room.isDebug });
            });

            it('should not start the game if the room does not exist', () => {
                gameRoomService.hasRoom.mockReturnValue(false);

                gateway.handleStartGame(payload);

                expect(mockServer.to).not.toHaveBeenCalled();
            });

            it('should not start the game if room has no players', () => {
                gameRoomService.hasRoom.mockReturnValue(true);
                gameRoomService.rooms.set(payload.roomId, { players: [] } as unknown as RoomData);

                gateway.handleStartGame(payload);

                expect(mockServer.to).not.toHaveBeenCalled();
            });
        });

        it('should handle toggle debug', () => {
            gameRoomService.rooms.set(payload.roomId, room);
            mockDebug.toggleDebug.mockReturnValue(room);

            gateway.handleToggleDebug(payload);
            expect(mockDebug.toggleDebug).toHaveBeenCalledWith(payload.roomId);
            expect(mockServer.to).toHaveBeenCalledWith(payload.roomId);
            expect(mockServer.to(payload.roomId).emit).toHaveBeenCalledWith(DebugEvents.ToggleDebug, { isDebug: room.isDebug });
        });

        it('should handle host leaving the room', async () => {
            const player = { ...MOCK_PLAYERS[0], id: 'client1', isHost: true };
            player.type = VirtualPlayerTypes.Defensive;
            const roomWithPlayers = {
                ...room,
                players: [player, { id: 'p2', name: 'P2', isHost: false }, { id: 'p3', name: 'P3', isHost: false }],
            };
            gameRoomService.rooms.set(roomId, roomWithPlayers);
            mockTurnService.findRoomFromClient.mockReturnValue(roomId);
            mockTurnService.handlePlayerQuit.mockResolvedValue(player);
            gameRoomService.removeClientFromRooms.mockResolvedValue({ isHost: true, roomId });

            gateway.handleDisconnect(client);
            await new Promise(process.nextTick);

            expect(mockServer.to).toHaveBeenCalledWith(roomId);
            expect(mockServer.to(roomId).emit).toHaveBeenCalledWith(DebugEvents.ToggleDebug, { isDebug: false });
        });

        it('should log after init', () => {
            gateway.afterInit();
            expect(mockLogger.log).toHaveBeenCalledWith('GameRoom WebSocket Gateway initialized');
        });

        it('should log client connection', () => {
            gateway.handleConnection(client);
            expect(mockLogger.log).toHaveBeenCalledWith(`Client connected: ${client.id}`);
        });

        it('should handle client disconnect', async () => {
            const roomWithPlayers = { ...room, players: [{ id: 'client1', name: 'Host', isHost: true }] };
            gameRoomService.rooms.set('room1', roomWithPlayers);
            mockTurnService.findRoomFromClient.mockReturnValue('room1');
            mockTurnService.handlePlayerQuit.mockResolvedValue(false);
            gameRoomService.removeClientFromRooms.mockResolvedValue({ isHost: true, roomId: 'room1' });

            gateway.handleDisconnect(client);
            await new Promise(process.nextTick);

            expect(mockLogger.log).toHaveBeenCalledWith(`Client disconnected: ${client.id}`);
        });

        it('should broadcast avatar update', () => {
            gameRoomService.rooms.set(roomId, room);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (gateway as any).broadcastAvatarUpdate(roomId);
            expect(mockServer.to).toHaveBeenCalledWith(roomId);
            expect(mockServer.to(roomId).emit).toHaveBeenCalledWith(GameRoomEvents.AvatarUpdate, {
                selectedAvatars: [],
            });
        });

        it('should handle client disconnect for non-host', async () => {
            const roomWithPlayers = {
                ...room,
                players: [
                    { id: 'client1', name: 'P1', isHost: false },
                    { id: 'other', name: 'P2', isHost: true },
                ],
            };
            gameRoomService.rooms.set(roomId, roomWithPlayers);
            mockTurnService.findRoomFromClient.mockReturnValue(roomId);
            mockTurnService.handlePlayerQuit.mockResolvedValue(false);
            gameRoomService.removeClientFromRooms.mockResolvedValue({ isHost: false, roomId });

            gateway.handleDisconnect(client);
            await new Promise(process.nextTick);

            expect(mockLogger.log).toHaveBeenCalledWith(`Client disconnected: ${client.id}`);
            expect(broadcastRoomUpdate).toHaveBeenCalledWith(roomId);
            expect(broadcastAvatarUpdate).toHaveBeenCalledWith(roomId);
        });

        it('should update avatar when nextAvatar is provided', () => {
            const updatePayload = {
                roomId: 'room1',
                player: 'player1',
                nextAvatar: 'new-avatar',
            };

            gameRoomService.updateAvatar = jest.fn();

            gateway.handleAvatarUpdate(client, updatePayload);

            expect(gameRoomService.updateAvatar).toHaveBeenCalledWith(updatePayload, client.id);
            expect(broadcastAvatarUpdate).toHaveBeenCalledWith(updatePayload.roomId);
        });
    });
});
