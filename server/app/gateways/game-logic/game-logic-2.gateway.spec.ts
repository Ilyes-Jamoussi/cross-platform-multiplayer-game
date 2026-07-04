import { FriendsGateway } from '@app/gateways/friends/friends.gateway';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TurnService } from '@app/services/turns/turn-service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { GAME_DATA, MOCK_PLAYERS } from '@common/constants.spec';
import { VirtualPlayerTypes } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { Grid, MovePlayer, Path, Player, RoomData, SocketPayload, ToggleDoor } from '@common/interfaces';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameLogicGateway } from './game-logic.gateway';

describe('GameLogicGateway', () => {
    let gateway: GameLogicGateway;
    let mockGameRoomService: jest.Mocked<GameRoomService>;
    let mockCombatService: jest.Mocked<CombatService>;
    let mockGameModeService: jest.Mocked<GameModeService>;
    let mockGameLogicService: jest.Mocked<GameLogicService>;
    let mockServer: jest.Mocked<Server>;
    let virtualCurrencyServiceMock: jest.Mocked<VirtualCurrencyService>;
    let mockVirtualPlayerService: jest.Mocked<VirtualPlayerService>;
    let mockFriendsGateway: jest.Mocked<FriendsGateway>;
    let mockTurnService: jest.Mocked<TurnService>;

    const mockPlayer: Player = MOCK_PLAYERS[0];

    const mockTargetPlayer: Player = MOCK_PLAYERS[1];

    const mockPath: Path = {
        positions: [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
        ],
        cost: 10,
        turns: 1,
    };

    const mockGrid: Grid = { ...GAME_DATA } as Grid;

    beforeEach(() => {
        mockGameRoomService = {
            rooms: new Map(),
            getRoom: jest.fn((id: string) => mockGameRoomService.rooms.get(id)),
            removeRoom: jest.fn(),
        } as unknown as jest.Mocked<GameRoomService>;

        mockCombatService = {
            handleStartCombat: jest.fn(),
            processCombatAction: jest.fn(),
        } as unknown as jest.Mocked<CombatService>;

        mockGameModeService = {
            nextTurn: jest.fn(),
            setGlobalStats: jest.fn(),
            recordPlayerStats: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<GameModeService>;

        mockGameLogicService = {
            setNextPosition: jest.fn(),
            handleCombat: jest.fn(),
            turnAction: jest.fn(),
            moveAction: jest.fn(),
        } as unknown as jest.Mocked<GameLogicService>;

        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        } as unknown as jest.Mocked<Server>;

        virtualCurrencyServiceMock = {
            awardWinners: jest.fn(),
            distributeEndGameRewards: jest.fn(),
        } as unknown as jest.Mocked<VirtualCurrencyService>;

        mockVirtualPlayerService = {
            combatAnswer: jest.fn(),
            afterCombatTurn: jest.fn(),
            turnAction: jest.fn(),
        } as unknown as jest.Mocked<VirtualPlayerService>;

        mockFriendsGateway = {
            updateStatus: jest.fn(),
        } as unknown as jest.Mocked<FriendsGateway>;

        mockTurnService = {
            broadcastTurnUpdate: jest.fn(),
        } as unknown as jest.Mocked<TurnService>;

        jest.spyOn(Logger, 'log');
        gateway = new GameLogicGateway(
            mockGameRoomService,
            mockCombatService,
            mockGameModeService,
            mockGameLogicService,
            virtualCurrencyServiceMock,
            mockVirtualPlayerService,
            mockFriendsGateway,
            mockTurnService,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (gateway as any)._server = mockServer;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('handleDoorToggle', () => {
        const mockData: ToggleDoor = {
            position: { x: 1, y: 1 },
            roomId: 'room1',
            isOpened: true,
            player: mockPlayer,
        };
        it('should update door state and emit DoorUpdate', () => {
            mockGameRoomService.rooms.set('room1', {
                currentTurn: mockPlayer,
                globalStats: { doorsUsed: [] },
                players: [mockPlayer],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            gateway.handleDoorToggle(mockData);

            expect(mockServer.to).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                ActiveGameEvents.DoorUpdate,
                expect.objectContaining({
                    position: { x: 1, y: 1 },
                    player: mockPlayer,
                }),
            );
        });

        it('it should log an error if handleDoorTile provokes an error', async () => {
            const error = new Error('Async combat error');
            jest.spyOn(mockGameRoomService.rooms, 'get').mockImplementation(() => {
                throw error;
            });
            await gateway.handleDoorToggle(mockData);
            expect(Logger.log).toHaveBeenCalledWith(error);
        });

        it("should not push door used if door wasn't used", async () => {
            mockGameRoomService.rooms.set('room1', {
                currentTurn: { type: 'human' },
                players: [mockPlayer],
                globalStats: {
                    doorsUsed: [{ x: 1, y: 1 }],
                },
            } as unknown as RoomData);

            await gateway.handleDoorToggle(mockData);

            expect(mockServer.to).toHaveBeenCalledWith('room1');
        });
    });

    describe('handleMovePlayer', () => {
        const mockData: MovePlayer = {
            player: mockPlayer,
            roomId: 'room1',
            path: mockPath,
            grid: mockGrid,
        };
        it('should move player through path and emit updates', async () => {
            mockGameRoomService.rooms.set('room1', {
                players: [mockPlayer],
            } as unknown as RoomData);
            mockGameLogicService.moveAction.mockResolvedValue(false);

            await gateway.handleMovePlayer(mockData);

            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.PlayerStartedMoving);
            expect(mockGameLogicService.moveAction).toHaveBeenCalledTimes(2);
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.MapRequest);
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.PlayerStoppedMoving);
        });

        it('should return early if room does not exist', async () => {
            mockGameRoomService.rooms.get = jest.fn().mockReturnValue(undefined);

            await gateway.handleMovePlayer(mockData);

            expect(mockGameLogicService.moveAction).not.toHaveBeenCalled();

            expect(mockServer.to).toHaveBeenCalledWith(mockData.roomId);
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.PlayerStartedMoving);
            expect(mockServer.emit).not.toHaveBeenCalledWith(ActiveGameEvents.MapRequest);
            expect(mockServer.emit).not.toHaveBeenCalledWith(ActiveGameEvents.PlayerStoppedMoving);
        });

        it('should log an error if handleMovePlayer provokes an error', async () => {
            const error = new Error('Async combat error');
            jest.spyOn(mockGameRoomService.rooms, 'get').mockImplementation(() => {
                throw error;
            });
            await gateway.handleMovePlayer(mockData);
            expect(Logger.log).toHaveBeenCalledWith(error);
        });

        it('should break the loop when moveAction returns true', async () => {
            const mockMoveAction = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

            mockGameLogicService.moveAction = mockMoveAction;

            const mockRoom = {
                players: [{ id: 'player1', position: { x: 0, y: 0 } }],
            };

            mockGameRoomService.rooms.get = jest.fn().mockReturnValue(mockRoom);

            await gateway.handleMovePlayer(mockData);

            expect(mockMoveAction).toHaveBeenCalledTimes(2);

            expect(mockServer.to).toHaveBeenCalledWith('room1');
        });
    });

    describe('handleEndTurn', () => {
        const mockData: SocketPayload = { roomId: 'room1' };
        it('should advance to next turn and emit updates', () => {
            const nextPlayer = { ...mockTargetPlayer, type: VirtualPlayerTypes.Aggressive };
            mockGameModeService.nextTurn.mockReturnValue(nextPlayer);
            mockGameRoomService.rooms.set('room1', {
                globalStats: { totalTurns: 0 },
            } as unknown as RoomData);

            gateway.handleEndTurn(mockData);

            expect(mockGameModeService.nextTurn).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.MapRequest);
            expect(mockTurnService.broadcastTurnUpdate).toHaveBeenCalledWith(mockServer, 'room1', nextPlayer);
            expect(mockGameLogicService.turnAction).toHaveBeenCalledWith('room1', nextPlayer);
        });

        it('should log an error if handleEndTurn provokes an error', async () => {
            const error = new Error('Async combat error');
            jest.spyOn(mockGameRoomService.rooms, 'get').mockImplementation(() => {
                throw error;
            });
            await gateway.handleEndTurn(mockData);
            expect(Logger.log).toHaveBeenCalledWith(error);
        });

        it('should return early if room is not found', async () => {
            mockGameRoomService.rooms.get = jest.fn().mockReturnValue(undefined);

            await gateway.handleEndTurn(mockData);

            expect(mockServer.emit).not.toHaveBeenCalled();
        });
    });

    describe('handleEndGame', () => {
        const mockData = {
            roomId: 'room1',
            grid: mockGrid,
        };
        it('should emit game ended with stats', async () => {
            mockGameRoomService.rooms.set('room1', {
                players: [mockPlayer, mockTargetPlayer],
                disconnectedPlayers: [],
                globalStats: { totalTurns: 10 },
                map: mockGrid,
            } as unknown as RoomData);
            virtualCurrencyServiceMock.distributeEndGameRewards.mockResolvedValue([]);

            await gateway.handleEndGame(mockData);

            expect(mockGameModeService.setGlobalStats).toHaveBeenCalled();
            expect(mockServer.to).toHaveBeenCalledWith('room1');
        });

        it('should log an error if handleEndTurn provokes an error', async () => {
            const error = new Error('Async combat error');
            jest.spyOn(mockGameRoomService.rooms, 'get').mockImplementation(() => {
                throw error;
            });
            await gateway.handleEndGame(mockData);
            expect(Logger.log).toHaveBeenCalledWith(error);
        });

        it('should return early if room is not found', async () => {
            mockGameRoomService.rooms.get = jest.fn().mockReturnValue(undefined);

            await gateway.handleEndGame(mockData);

            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should handle the case where is a disconnected player', async () => {
            mockGameRoomService.rooms.set('room1', {
                players: [mockTargetPlayer],
                disconnectedPlayers: [mockPlayer],
                globalStats: { totalTurns: 10 },
                map: mockGrid,
            } as unknown as RoomData);
            virtualCurrencyServiceMock.distributeEndGameRewards.mockResolvedValue([]);

            await gateway.handleEndGame(mockData);

            expect(mockServer.to).toHaveBeenCalledWith('room1');
        });

        it('should handle the case where disconnectedPlayers is undefined', async () => {
            mockGameRoomService.rooms.set('room1', {
                players: [mockPlayer, mockTargetPlayer],
                globalStats: { totalTurns: 10 },
                map: mockGrid,
            } as unknown as RoomData);
            virtualCurrencyServiceMock.distributeEndGameRewards.mockResolvedValue([]);

            await gateway.handleEndGame(mockData);

            expect(mockServer.to).toHaveBeenCalledWith('room1');
        });
    });

    describe('handleMapRequest', () => {
        const mockData = {
            roomId: 'room1',
            map: mockGrid.board,
        };
        it('should update room map', () => {
            const mockRoom = { map: { board: [] } };
            mockGameRoomService.rooms.set('room1', mockRoom as unknown as RoomData);

            gateway.handleMapRequest(mockData);

            expect(mockRoom.map.board).toEqual(mockGrid.board);
        });

        it('should log an error if handleEndTurn provokes an error', async () => {
            const error = new Error('Async combat error');
            jest.spyOn(mockGameRoomService.rooms, 'get').mockImplementation(() => {
                throw error;
            });
            await gateway.handleMapRequest(mockData);
            expect(Logger.log).toHaveBeenCalledWith(error);
        });
    });
});
