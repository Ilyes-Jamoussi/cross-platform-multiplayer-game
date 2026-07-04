/* eslint-disable @typescript-eslint/no-explicit-any */
import { FriendsGateway } from '@app/gateways/friends/friends.gateway';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TurnService } from '@app/services/turns/turn-service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { Actions, CombatResults, GameModes, LobbyGameMode, PlayerState, PlayerStatus } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { CombatAction, Player, PlayerAction, RoomData } from '@common/interfaces';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameLogicGateway } from './game-logic.gateway';

describe('GameLogicGateway', () => {
    let gateway: GameLogicGateway;
    let mockGameRoomService: jest.Mocked<GameRoomService>;
    let mockCombatService: jest.Mocked<CombatService>;
    let mockGameModeService: jest.Mocked<GameModeService>;
    let mockGameLogicService: jest.Mocked<GameLogicService>;
    let mockVirtualCurrencyService: jest.Mocked<VirtualCurrencyService>;
    let mockVirtualPlayerService: jest.Mocked<VirtualPlayerService>;
    let mockFriendsGateway: jest.Mocked<FriendsGateway>;
    let mockTurnService: jest.Mocked<TurnService>;
    let mockServer: jest.Mocked<Server>;

    const mockPlayer: Player = { ...MOCK_PLAYERS[0], id: 'player-1' } as Player;
    const mockTargetPlayer: Player = { ...MOCK_PLAYERS[1], id: 'player-2' } as Player;

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
            setNextPosition: jest.fn().mockReturnValue({ x: 1, y: 1 }),
            handleCombat: jest.fn().mockResolvedValue(undefined),
            turnAction: jest.fn(),
            moveAction: jest.fn(),
        } as unknown as jest.Mocked<GameLogicService>;

        mockVirtualCurrencyService = {
            distributeEndGameRewards: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<VirtualCurrencyService>;

        mockVirtualPlayerService = {
            combatAnswer: jest.fn(),
            afterCombatTurn: jest.fn(),
            turnAction: jest.fn(),
        } as unknown as jest.Mocked<VirtualPlayerService>;

        mockFriendsGateway = {
            updateStatus: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<FriendsGateway>;

        mockTurnService = {
            broadcastTurnUpdate: jest.fn(),
        } as unknown as jest.Mocked<TurnService>;

        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        } as unknown as jest.Mocked<Server>;

        gateway = new GameLogicGateway(
            mockGameRoomService,
            mockCombatService,
            mockGameModeService,
            mockGameLogicService,
            mockVirtualCurrencyService,
            mockVirtualPlayerService,
            mockFriendsGateway,
            mockTurnService,
        );
        (gateway as any)._server = mockServer;
        jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should expose server getter', () => {
        expect(gateway.server).toBe(mockServer);
    });

    describe('handlePlayerAction', () => {
        it('should start combat and emit CombatInitiated', async () => {
            const mockData: PlayerAction = {
                playerId: mockPlayer.id,
                roomId: 'room-1',
                target: mockTargetPlayer,
                action: Actions.Attack,
            };
            const startCombatResult = {
                message: CombatResults.CombatStarted,
                gameState: { players: [mockPlayer, mockTargetPlayer] },
            } as any;

            mockCombatService.handleStartCombat.mockReturnValue(startCombatResult);
            mockGameRoomService.rooms.set('room-1', {
                playerUids: new Map<string, string>([
                    [mockPlayer.id, 'uid-1'],
                    [mockTargetPlayer.id, 'uid-2'],
                ]),
            } as any);

            await gateway.handlePlayerAction(mockData);

            expect(mockCombatService.handleStartCombat).toHaveBeenCalledWith(mockPlayer.id, 'room-1', mockTargetPlayer);
            expect(mockServer.to).toHaveBeenCalledWith('room-1');
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.CombatInitiated, startCombatResult);
            expect(mockFriendsGateway.updateStatus).toHaveBeenCalledWith('uid-1', PlayerStatus.InCombat);
            expect(mockFriendsGateway.updateStatus).toHaveBeenCalledWith('uid-2', PlayerStatus.InCombat);
        });

        it('should log error when combat start throws', async () => {
            const mockData: PlayerAction = {
                playerId: mockPlayer.id,
                roomId: 'room-1',
                target: mockTargetPlayer,
                action: Actions.Attack,
            };
            const error = new Error('combat start failed');
            mockCombatService.handleStartCombat.mockImplementation(() => {
                throw error;
            });

            await gateway.handlePlayerAction(mockData);

            expect(Logger.log).toHaveBeenCalledWith(error);
        });
    });

    describe('handleCombatAction', () => {
        const mockData: CombatAction = {
            playerId: mockPlayer.id,
            action: Actions.Attack,
            roomId: 'room-1',
        };

        it('should process combat update and resolve non-escape end of combat', async () => {
            const combatResult = {
                message: CombatResults.AttackDefeated,
                gameState: {
                    players: [mockPlayer, mockTargetPlayer],
                    combat: undefined,
                    isEscape: false,
                },
            } as any;

            mockCombatService.processCombatAction.mockReturnValue(combatResult);
            mockGameRoomService.rooms.set('room-1', {
                currentTurn: { ...mockPlayer, type: undefined },
                players: [mockPlayer, mockTargetPlayer],
                map: { board: [] },
                gameState: { isGameOver: false },
                lobbyGameMode: LobbyGameMode.Classic,
                playerUids: new Map<string, string>(),
            } as any);

            await gateway.handleCombatAction(mockData);

            expect(mockCombatService.processCombatAction).toHaveBeenCalledWith(Actions.Attack, 'room-1');
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.CombatUpdate, combatResult);
            expect(mockGameLogicService.setNextPosition).toHaveBeenCalled();
            expect(mockGameLogicService.handleCombat).toHaveBeenCalled();
        });

        it('should end virtual player turn after successful escape', async () => {
            const escapeResult = {
                message: CombatResults.EscapeSucceeded,
                gameState: {
                    players: [mockPlayer, mockTargetPlayer],
                    combat: undefined,
                    isEscape: true,
                },
            } as any;
            const endTurnSpy = jest.spyOn(gateway, 'handleEndTurn').mockImplementation(() => undefined);

            mockCombatService.processCombatAction.mockReturnValue(escapeResult);
            mockGameRoomService.rooms.set('room-1', {
                currentTurn: { ...mockPlayer, type: 'virtual' },
                players: [mockPlayer, mockTargetPlayer],
                map: { board: [] },
                gameState: { isGameOver: false },
                lobbyGameMode: LobbyGameMode.Classic,
                playerUids: new Map<string, string>(),
            } as any);

            await gateway.handleCombatAction({ ...mockData, action: Actions.Escape });

            expect(endTurnSpy).toHaveBeenCalledWith({ roomId: 'room-1' });
        });

        it('should call handleEndGame when Fast Elimination has one survivor', async () => {
            const combatResult = {
                message: CombatResults.AttackDefeated,
                gameState: {
                    players: [mockPlayer],
                    combat: undefined,
                    isEscape: false,
                },
            } as any;
            const endGameSpy = jest.spyOn(gateway, 'handleEndGame').mockResolvedValue(undefined);

            mockCombatService.processCombatAction.mockReturnValue(combatResult);
            mockGameRoomService.rooms.set('room-1', {
                currentTurn: { ...mockPlayer, type: undefined },
                players: [mockPlayer],
                gameState: { isGameOver: true },
                map: { board: [] },
                lobbyGameMode: LobbyGameMode.FastElimination,
                playerUids: new Map<string, string>(),
            } as any);

            await gateway.handleCombatAction(mockData);

            expect(endGameSpy).toHaveBeenCalledWith({ roomId: 'room-1', grid: { board: [] } });
        });

        it('should only emit combat update when gameState is missing', async () => {
            mockCombatService.processCombatAction.mockReturnValue({ message: CombatResults.AttackNotDefeated } as any);

            await gateway.handleCombatAction(mockData);

            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.CombatUpdate, { message: CombatResults.AttackNotDefeated });
            expect(mockGameLogicService.setNextPosition).not.toHaveBeenCalled();
        });
    });

    describe('handleEndGame', () => {
        it('should select only last active non-spectator in Fast Elimination', async () => {
            const winner = { ...MOCK_PLAYERS[0], id: 'winner', victories: 0, state: PlayerState.ACTIVE, isSpectator: false } as Player;
            const eliminatedOne = {
                ...MOCK_PLAYERS[1],
                id: 'eliminated-1',
                victories: 5,
                state: PlayerState.ELIMINATED,
                isSpectator: true,
            } as Player;
            const eliminatedTwo = {
                ...MOCK_PLAYERS[2],
                id: 'eliminated-2',
                victories: 4,
                state: PlayerState.ELIMINATED,
                isSpectator: true,
            } as Player;

            mockGameRoomService.rooms.set('room-1', {
                players: [winner, eliminatedOne, eliminatedTwo],
                disconnectedPlayers: [],
                map: { gameMode: GameModes.Classic, board: [] },
                lobbyGameMode: LobbyGameMode.FastElimination,
                gameState: { isGameOver: true },
                globalStats: { totalTurns: 0 },
            } as any);

            await gateway.handleEndGame({ roomId: 'room-1', grid: { board: [] } as any });

            expect(mockVirtualCurrencyService.distributeEndGameRewards).toHaveBeenCalledWith(expect.anything(), ['winner']);
        });

        it('should keep classic winner condition at 3 victories', async () => {
            const almostWinner = { ...MOCK_PLAYERS[0], id: 'almost-winner', victories: 2, state: PlayerState.ACTIVE } as Player;
            const winner = { ...MOCK_PLAYERS[1], id: 'classic-winner', victories: 3, state: PlayerState.ACTIVE } as Player;

            mockGameRoomService.rooms.set('room-1', {
                players: [almostWinner, winner],
                disconnectedPlayers: [],
                map: { gameMode: GameModes.Classic, board: [] },
                lobbyGameMode: LobbyGameMode.Classic,
                globalStats: { totalTurns: 0 },
            } as RoomData);

            await gateway.handleEndGame({ roomId: 'room-1', grid: { board: [] } as any });

            expect(mockVirtualCurrencyService.distributeEndGameRewards).toHaveBeenCalledWith(expect.anything(), ['classic-winner']);
        });
    });
});
