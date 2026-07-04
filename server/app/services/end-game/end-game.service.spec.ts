import { AuthService } from '@app/services/auth/auth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { EndGameService } from './end-game.service';
import { TileTypes } from '@common/enums';
import { Grid, Player, RoomData } from '@common/interfaces';
import { Position } from '@common/types';
import { MOCK_PLAYERS } from '@common/constants.spec';

describe('EndGameService', () => {
    let service: EndGameService;

    beforeEach(async () => {
        const authServiceMock = {
            recordGameResult: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [EndGameService, { provide: AuthService, useValue: authServiceMock }],
        }).compile();

        service = module.get<EndGameService>(EndGameService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('setGlobalStats', () => {
        it('should calculate doorsUsedPercent when there are doors', () => {
            const room: RoomData = {
                players: [],
                map: {
                    board: [
                        [{ tile: TileTypes.Door }, { tile: TileTypes.OpenedDoor }],
                        [{ tile: TileTypes.Wall }, { tile: TileTypes.Door }],
                    ],
                },
                globalStats: {
                    doorsUsed: [{ x: 0, y: 0 }],
                    doorsUsedPercent: 0,
                    duration: 0,
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                },
            } as RoomData;

            service.setGlobalStats(room);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(room.globalStats.doorsUsedPercent).toBeCloseTo(33.33);
        });

        it('should not calculate doorsUsedPercent when there are no doors', () => {
            const room: RoomData = {
                players: [MOCK_PLAYERS[0]],
                map: {
                    board: [
                        [{ tile: TileTypes.Default }, { tile: TileTypes.Default }],
                        [{ tile: TileTypes.Wall }, { tile: TileTypes.Default }],
                    ],
                },
                globalStats: {
                    doorsUsed: [],
                    doorsUsedPercent: 0,
                    duration: 0,
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                },
            } as RoomData;

            service.setGlobalStats(room);
            expect(room.globalStats.doorsUsedPercent).toBe(0);
        });

        it('should set duration when startTime is defined', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const startTime = new Date(Date.now() - 1000);
            const room: RoomData = {
                startTime,
                players: [],
                map: { board: [] },
                globalStats: {
                    doorsUsed: [],
                    doorsUsedPercent: 0,
                    duration: 0,
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                },
            } as RoomData;

            service.setGlobalStats(room);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(room.globalStats.duration).toBeGreaterThanOrEqual(1000);
        });

        it('should set duration to 0 when startTime is undefined', () => {
            const room: RoomData = {
                map: { board: [] },
                players: [],
                globalStats: {
                    doorsUsed: [],
                    doorsUsedPercent: 0,
                    duration: 0,
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                },
            } as RoomData;

            service.setGlobalStats(room);
            expect(room.globalStats.duration).toBe(0);
        });
    });

    describe('setTilesVisitedPercentage', () => {
        it('should update player and global stats when visiting new tile', () => {
            const room: RoomData = {
                players: [],
                map: {
                    board: [
                        [{ tile: TileTypes.Default }, { tile: TileTypes.Default }],
                        [{ tile: TileTypes.Wall }, { tile: TileTypes.Default }],
                    ],
                },
                globalStats: {
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                    doorsUsed: [],
                    doorsUsedPercent: 0,
                    duration: 0,
                },
            } as RoomData;

            const player: Player = {
                playerStats: {
                    tilesVisited: [],
                    tilesVisitedPercentage: 0,
                },
            } as Player;
            const position: Position = { x: 0, y: 0 };

            service.setTilesVisitedPercentage(room, player, position);

            expect(player.playerStats.tilesVisited.length).toBe(1);
            expect(room.globalStats.tilesVisited.length).toBe(1);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(player.playerStats.tilesVisitedPercentage).toBeCloseTo(33.33);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(room.globalStats.tilesVisitedPercentage).toBeCloseTo(33.33);
        });

        it('should not update stats when visiting already visited tile', () => {
            const room: RoomData = {
                players: [],
                map: {
                    board: [
                        [{ tile: TileTypes.Default }, { tile: TileTypes.Default }],
                        [{ tile: TileTypes.Wall }, { tile: TileTypes.Default }],
                    ],
                },
                globalStats: {
                    tilesVisited: [{ x: 0, y: 0 }],
                    tilesVisitedPercentage: 33.33,
                    doorsUsed: [],
                    doorsUsedPercent: 0,
                    duration: 0,
                },
            } as RoomData;

            const player: Player = {
                playerStats: {
                    tilesVisited: [{ x: 0, y: 0 }],
                    tilesVisitedPercentage: 33.33,
                },
            } as Player;

            const position: Position = { x: 0, y: 0 };

            service.setTilesVisitedPercentage(room, player, position);

            expect(player.playerStats.tilesVisited.length).toBe(1);
            expect(room.globalStats.tilesVisited.length).toBe(1);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(player.playerStats.tilesVisitedPercentage).toBe(33.33);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(room.globalStats.tilesVisitedPercentage).toBe(33.33);
        });

        it('should do nothing when room or player is undefined', () => {
            const position: Position = { x: 0, y: 0 };

            expect(() => service.setTilesVisitedPercentage(undefined, {} as Player, position)).not.toThrow();

            expect(() => service.setTilesVisitedPercentage({ map: { board: [] } } as RoomData, undefined, position)).not.toThrow();
        });
    });

    describe('getDuration', () => {
        it('should return correct duration when startTime is defined', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const startTime = new Date(Date.now() - 1000);
            const room: RoomData = {
                startTime,
                map: { board: [] },
            } as RoomData;

            const duration = service.getDuration(room);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(duration).toBeGreaterThanOrEqual(1000);
        });

        it('should return 0 when startTime is undefined', () => {
            const room: RoomData = {
                map: { board: [] },
            } as RoomData;
            const duration = service.getDuration(room);
            expect(duration).toBe(0);
        });

        it('should return 0 when room is undefined', () => {
            const duration = service.getDuration(undefined);
            expect(duration).toBe(0);
        });
    });

    describe('getTotalValidTiles', () => {
        it('should count all non-wall tiles', () => {
            const grid = {
                board: [
                    [{ tile: TileTypes.Default }, { tile: TileTypes.Door }],
                    [{ tile: TileTypes.Wall }, { tile: TileTypes.OpenedDoor }],
                ],
            } as Grid;

            const count = service['getTotalValidTiles'](grid);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(count).toBe(3);
        });

        it('should return 0 for empty grid', () => {
            const grid = { board: [] } as Grid;
            const count = service['getTotalValidTiles'](grid);
            expect(count).toBe(0);
        });
    });

    describe('findTotalDoors', () => {
        it('should count all door and opened door tiles', () => {
            const grid = {
                board: [
                    [{ tile: TileTypes.Door }, { tile: TileTypes.Default }],
                    [{ tile: TileTypes.OpenedDoor }, { tile: TileTypes.Wall }],
                ],
            } as Grid;

            const count = service['findTotalDoors'](grid);
            expect(count).toBe(2);
        });

        it('should return 0 when there are no doors', () => {
            const grid = {
                board: [
                    [{ tile: TileTypes.Default }, { tile: TileTypes.Default }],
                    [{ tile: TileTypes.Wall }, { tile: TileTypes.Default }],
                ],
            } as Grid;

            const count = service['findTotalDoors'](grid);
            expect(count).toBe(0);
        });

        it('should return 0 for empty grid', () => {
            const grid = { board: [] } as Grid;
            const count = service['findTotalDoors'](grid);
            expect(count).toBe(0);
        });

        it('should return 0 when board is undefined', () => {
            const grid = {} as Grid;
            const count = service['findTotalDoors'](grid);
            expect(count).toBe(0);
        });
    });

    describe('getTotalValidTiles', () => {
        it('should return 0 when board is undefined', () => {
            const grid = {} as Grid;
            const count = service['getTotalValidTiles'](grid);
            expect(count).toBe(0);
        });
    });
});
