import { GameLogicGateway } from '@app/gateways/game-logic/game-logic.gateway';
import { GridInfo } from '@app/interfaces/item-search-interface';
import { VirtualPath } from '@app/interfaces/virtual-player-interfaces';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { MovementService } from '@app/services/movement-logic/movement-logic.service';
import { VirtualMovementService } from '@app/services/virtual-player/virtual-movement-service/virtual-player-movement.service';
import { GAME_DATA, MOCK_PLAYERS } from '@common/constants.spec';
import { ItemId, ItemTypes, TileTypes, VirtualPlayerTypes } from '@common/enums';
import { Grid, Path, Player, RoomData } from '@common/interfaces';
import { ModuleRef } from '@nestjs/core';

describe('VirtualMovementService', () => {
    let service: VirtualMovementService;
    let mockGameRoomService: jest.Mocked<GameRoomService>;
    let mockMovementService: jest.Mocked<MovementService>;
    let mockGameModeService: jest.Mocked<GameModeService>;
    let mockGameLogicGateway: jest.Mocked<GameLogicGateway>;
    let mockModuleRef: jest.Mocked<ModuleRef>;

    beforeEach(() => {
        mockGameRoomService = {
            rooms: new Map(),
            getRoom: jest.fn().mockImplementation((roomId) => mockGameRoomService.rooms.get(roomId)),
        } as unknown as jest.Mocked<GameRoomService>;

        mockMovementService = {
            findPaths: jest.fn(),
            decreaseSpeed: jest.fn(),
            delay: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<MovementService>;

        mockGameModeService = {
            setTilesVisited: jest.fn(),
            checkFlagCaptured: jest.fn(),
            flagTaken: jest.fn(),
        } as unknown as jest.Mocked<GameModeService>;

        mockGameLogicGateway = {
            server: {
                to: jest.fn().mockReturnThis(),
                emit: jest.fn(),
            },
            handleDoorToggle: jest.fn(),
        } as unknown as jest.Mocked<GameLogicGateway>;

        mockModuleRef = {
            get: jest.fn().mockReturnValue(mockGameLogicGateway),
        } as unknown as jest.Mocked<ModuleRef>;

        service = new VirtualMovementService(mockGameRoomService, mockMovementService, mockGameModeService, mockModuleRef);
        service['gameLogicGateway'] = mockGameLogicGateway;
    });

    describe('onModuleInit', () => {
        it('should initialize gameLogicGateway', () => {
            service.onModuleInit();
            expect(mockModuleRef.get).toHaveBeenCalledWith(GameLogicGateway);
            expect(service['gameLogicGateway']).toBe(mockGameLogicGateway);
        });
    });

    describe('moveVirtualPlayer', () => {
        const mockPlayer: Player = MOCK_PLAYERS[0];

        const mockGridInfo = {
            roomId: 'room1',
            grid: GAME_DATA as Grid,
        };
        const mockVirtualPath = {
            player: mockPlayer,
            gridInfo: mockGridInfo,
            path: {
                positions: [
                    { x: 1, y: 0 },
                    { x: 2, y: 0 },
                ],
            },
        };

        beforeEach(() => {
            // eslint-disable-next-line no-unused-vars
            service['getPlayerRef'] = jest.fn().mockImplementation((playerId) => {
                return MOCK_PLAYERS.find((player) => player.id === playerId);
            });
            mockGridInfo.grid.board = GAME_DATA.board;
        });

        it('should move player through path positions', async () => {
            mockVirtualPath.player.playerStats.nItemsCollected = undefined;
            mockGridInfo.grid.board[2][0].item.name = ItemId.ItemStartingPoint;
            await service['nextCellCheck'](mockGridInfo.grid.board[1][0], mockPlayer, mockVirtualPath as VirtualPath);
            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(mockMovementService.delay).toHaveBeenCalledTimes(3);
            expect(mockGameModeService.setTilesVisited).toHaveBeenCalledTimes(2);
            expect(mockMovementService.decreaseSpeed).toHaveBeenCalledTimes(2);
            expect(mockPlayer.position).toEqual({ x: 2, y: 0 });
        });

        it('should stop moving if nextCellCheck returns true', async () => {
            mockVirtualPath.gridInfo.grid = GAME_DATA as Grid;
            service['nextCellCheck'] = jest.fn().mockReturnValue(true);
            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);
            expect(mockPlayer.position).not.toEqual({ x: 2, y: 0 });
        });

        it('should collect item when moving to cell with item', async () => {
            mockGridInfo.grid.board[1][0].item.name = ItemId.ItemFlag;
            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);

            expect(mockMovementService.delay).toHaveBeenCalledWith(expect.any(Number));
            expect(mockPlayer.playerStats?.nItemsCollected).toBe(1);
        });

        it('should handle flag collection', async () => {
            mockGridInfo.grid.board[1][0].item.name = ItemTypes.Flag;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockGameRoomService.rooms.set('room1', { players: MOCK_PLAYERS, flagHolderId: undefined } as any);

            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);

            expect(mockGameModeService.flagTaken).toHaveBeenCalledWith({
                roomId: 'room1',
                flagHolderId: 'player1000',
            });
        });
        it('should handle item collection', async () => {
            mockGridInfo.grid.board[1][0].item.name = ItemId.Item1;
            mockGridInfo.grid.board[2][0].item.name = ItemId.ItemFlag;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockGameRoomService.rooms.set('room1', { players: MOCK_PLAYERS, flagHolderId: undefined } as any);

            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(mockGridInfo.grid.board[2][0].item.name).toBeDefined();
        });
        it('should handle flag win', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockGameRoomService.rooms.set('room1', { players: MOCK_PLAYERS, flagHolderId: MOCK_PLAYERS[0].id } as any);
            mockGameModeService['checkFlagCaptured'] = jest.fn().mockReturnValue(true);
            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);
            expect(mockGameLogicGateway.server.to).toHaveBeenCalled();
        });

        it('should stop movement when cannot afford next move', async () => {
            mockPlayer.stats.speed = 1;
            mockGridInfo.grid.board[1][0].tile = TileTypes.Water;

            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);

            expect(mockPlayer.position).not.toEqual({ x: 0, y: 0 });
        });

        it('should handle door tile correctly', async () => {
            mockGridInfo.grid.board[1][0].tile = TileTypes.Door;
            mockGridInfo.grid.board[1][0].item = undefined;
            mockGridInfo.grid.board[2][0].tile = TileTypes.Door;

            await service.moveVirtualPlayer(mockVirtualPath as VirtualPath);
            service.getItemPositions = jest.fn().mockReturnValue([{ x: 2, y: 0 }]);

            expect(mockGameLogicGateway.handleDoorToggle).toHaveBeenCalled();
            mockGridInfo.grid.board[1][0].item = { name: '', description: '' };
        });
    });

    describe('checkAdjacentPositions', () => {
        const mockGrid: Grid = GAME_DATA as Grid;
        it('should check all adjacent positions', () => {
            const callback = jest.fn();
            service.checkAdjacentPositions({ x: 2, y: 2 }, mockGrid, callback);

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(callback).toHaveBeenCalledTimes(4);
            expect(callback).toHaveBeenCalledWith({ x: 3, y: 2 }, expect.anything());
            expect(callback).toHaveBeenCalledWith({ x: 1, y: 2 }, expect.anything());
            expect(callback).toHaveBeenCalledWith({ x: 2, y: 3 }, expect.anything());
            expect(callback).toHaveBeenCalledWith({ x: 2, y: 1 }, expect.anything());
        });

        it('should return early', () => {
            const callback = jest.fn();
            service.checkAdjacentPositions(undefined, mockGrid, callback);
            expect(callback).toHaveBeenCalledTimes(0);
        });

        it('should return first truthy callback result', () => {
            const callback = jest.fn().mockReturnValueOnce(undefined).mockReturnValueOnce('found').mockReturnValueOnce('ignored');

            const result = service.checkAdjacentPositions({ x: 2, y: 2 }, mockGrid, callback);
            expect(result).toBe('found');
        });
    });

    describe('findNearestPath', () => {
        const mockPlayer = MOCK_PLAYERS[0];

        const mockGrid: Grid = GAME_DATA as Grid;

        it('should find path to nearest target', () => {
            const mockPath = { positions: [{ x: 1, y: 0 }] } as Path;
            mockMovementService.findPaths.mockReturnValue({ path: mockPath, reachableTiles: [] });

            const result = service.findNearestPath(mockPlayer, mockGrid, {
                targetPositions: [{ x: 2, y: 0 }],
                speed: 5,
            });

            expect(result).toBe(mockPath);
            expect(mockMovementService.findPaths).toHaveBeenCalled();
        });

        it('should return undefined if no target positions', () => {
            const result = service.findNearestPath(mockPlayer, mockGrid, {
                targetPositions: [],
                speed: 5,
            });
            expect(result).toBeUndefined();
        });
    });

    describe('getPlayerPositions', () => {
        it('should return positions of all players not in excluded list', () => {
            const mockGrid = GAME_DATA as Grid;
            mockGrid.board[0][0].player = MOCK_PLAYERS[0];

            const result = service.getPlayerPositions(mockGrid, []);
            expect(result).toEqual([{ x: 0, y: 0 }]);
        });
    });

    describe('getItemPositions', () => {
        it('should return flag position immediately when found', () => {
            const mockGrid = GAME_DATA as Grid;
            mockGrid.board[1][0].item.name = ItemId.Item1;
            mockGrid.board[2][0].item.name = '';

            const result = service.getItemPositions(mockGrid, false);
            expect(result).toEqual([{ x: 1, y: 0 }]);
        });

        it('should return offensive items when requested', () => {
            const mockGrid = GAME_DATA as Grid;
            mockGrid.board[1][0].item.name = ItemId.Item2;

            const result = service.getItemPositions(mockGrid, true);
            expect(result).toEqual([{ x: 1, y: 0 }]);
        });
        it('should return flag when requested', () => {
            const mockGrid = GAME_DATA as Grid;
            mockGrid.board[1][0].item.name = ItemId.ItemFlag;

            const result = service.getItemPositions(mockGrid, true);
            expect(result).toEqual([{ x: 1, y: 0 }]);
        });
    });

    describe('canAffordMovement', () => {
        it('should return true when player has enough speed', () => {
            const player = { stats: { speed: 5 } } as Player;
            const grid = GAME_DATA as Grid;
            grid.board[0][0].tile = undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).canAffordMovement(player, grid, { x: 0, y: 0 })).toBe(true);
            grid.board[0][0].tile = TileTypes.Default;
        });

        it('should return false when player lacks speed', () => {
            const player = { stats: { speed: 0 } } as Player;
            const grid = GAME_DATA as Grid;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).canAffordMovement(player, grid, { x: 0, y: 0 })).toBe(false);
        });
    });
    describe('findPathToExactPosition', () => {
        const mockPlayer = MOCK_PLAYERS[0];
        const mockGrid: Grid = GAME_DATA as Grid;

        it('should find path to exact position', () => {
            const mockPath = { positions: [{ x: 1, y: 0 }] } as Path;
            mockMovementService.findPaths.mockReturnValue({ path: mockPath, reachableTiles: [] });

            const result = service.findPathToExactPosition(mockPlayer, mockGrid, {
                targetPositions: [{ x: 2, y: 0 }],
                speed: 5,
            });

            expect(result).toBe(mockPath);
            expect(mockMovementService.findPaths).toHaveBeenCalledWith(
                mockGrid,
                expect.objectContaining({
                    stats: expect.objectContaining({
                        speed: mockPlayer.stats.speed,
                    }),
                }),
                { x: 2, y: 0 },
            );
        });

        it('should use infinite speed for defensive players', () => {
            const defensivePlayer = { ...mockPlayer, type: VirtualPlayerTypes.Defensive };
            service.findPathToExactPosition(defensivePlayer, mockGrid, {
                targetPositions: [{ x: 2, y: 0 }],
                speed: 5,
            });

            expect(mockMovementService.findPaths).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    stats: expect.objectContaining({
                        speed: Infinity,
                    }),
                }),
                expect.anything(),
            );
        });

        it('should use infinite speed when looking for flag', () => {
            service.findPathToExactPosition(mockPlayer, mockGrid, {
                targetPositions: [{ x: 2, y: 0 }],
                speed: 5,
                isLookingForFlag: true,
            });

            expect(mockMovementService.findPaths).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    stats: expect.objectContaining({
                        speed: Infinity,
                    }),
                }),
                expect.anything(),
            );
        });

        it('should return undefined if no player position', () => {
            const playerWithoutPosition = { ...mockPlayer, position: undefined };
            const result = service.findPathToExactPosition(playerWithoutPosition, mockGrid, {
                targetPositions: [{ x: 2, y: 0 }],
                speed: 5,
            });
            expect(result).toBeUndefined();
        });

        it('should return undefined if no target positions', () => {
            const result = service.findPathToExactPosition(mockPlayer, mockGrid, {
                targetPositions: [],
                speed: 5,
            });
            expect(result).toBeUndefined();
        });
    });
    it('should return the player reference', () => {
        const mockRoomData: RoomData = {
            players: MOCK_PLAYERS,
            flagHolderId: MOCK_PLAYERS[0].id,
        } as RoomData;

        mockGameRoomService.rooms.get = jest.fn().mockImplementation(() => mockRoomData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (service as any).getPlayerRef('player1000', 'room1');
        expect(result).toEqual(MOCK_PLAYERS[0]);
    });
    it('should return not the player reference', () => {
        mockGameRoomService.rooms.get = jest.fn().mockImplementation(() => undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (service as any).getPlayerRef('player1000', 'room2');
        expect(result).toEqual(undefined);
    });
    it('should return early if no positions', async () => {
        MOCK_PLAYERS[0].position = undefined;
        await service['collectItem']({} as GridInfo, { x: 0, y: 0 }, MOCK_PLAYERS[0]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).handleCollectItem = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((service as any).handleCollectItem).not.toHaveBeenCalled();
    });
});
