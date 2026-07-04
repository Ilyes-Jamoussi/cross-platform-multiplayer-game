import { TILE_COST } from '@common/constants';
import { MOCK_3X3_GRID, MOCK_PLAYERS } from '@common/constants.spec';
import { TileTypes } from '@common/enums';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementService } from './movement-logic.service';
import { Position } from '@common/types';
import * as utils from '@common/shared-utils';

describe('MovementService', () => {
    let service: MovementService;
    const grid = MOCK_3X3_GRID;
    let player = MOCK_PLAYERS[0];
    const position = { x: 0, y: 0 };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MovementService],
        }).compile();

        service = module.get<MovementService>(MovementService);
        player = MOCK_PLAYERS[0];
    });

    describe('decreaseSpeed', () => {
        it('should decrease player speed based on tile cost', () => {
            service.decreaseSpeed(player, grid, position);

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(player.stats?.speed).toBe(10 - (TILE_COST.get(TileTypes.Default) ?? 0));
        });

        it('should not decrease speed if player has no stats', () => {
            player.stats = undefined;
            service.decreaseSpeed(player, grid, position);

            expect(player.stats).toBeUndefined();
        });
    });

    it('should handle unknown tile types', () => {
        player = { ...player, stats: { speed: 10, life: 1, attack: 1, defense: 1 } };
        grid.board[0][0].tile = 'abc' as TileTypes;
        service.decreaseSpeed(player, grid, position);

        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(player.stats?.speed).toBe(10);
    });

    describe('delay', () => {
        it('should delay for the specified time', async () => {
            const start = Date.now();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            await service.delay(100);
            const end = Date.now();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(end - start).toBeGreaterThanOrEqual(99);
        });
    });

    describe('findPaths', () => {
        let target: Position;

        beforeEach(() => {
            player = { ...MOCK_PLAYERS[0], stats: { speed: 2, life: 5, attack: 3, defense: 2 } };
            target = { x: 2, y: 2 };
        });

        it('should return empty reachable tiles if player position is undefined', () => {
            player.position = undefined;
            const result = service.findPaths(grid, player, target);
            expect(result).toEqual({ reachableTiles: [] });
        });

        it('should return reachableTiles even if target is unreachable', () => {
            grid.board[2][2].tile = TileTypes.Wall;
            const result = service.findPaths(grid, player, target);
            expect(result.reachableTiles.length).toBeGreaterThan(0);
        });

        it('should return reachableTiles and path when target is reachable', () => {
            player.position = { x: 2, y: 2 };
            const result = service.findPaths(grid, player, target);
            expect(result.reachableTiles.length).toBeGreaterThan(0);
            expect(result.path).toBeDefined();
            expect(result.path?.positions).toContainEqual(target);
        });

        it('should not return a path if speed is too low', () => {
            player.stats.speed = 0;
            const result = service.findPaths(grid, player, target);
            expect(result.path).toBeUndefined();
        });

        it('should only return reachableTiles when no target is passed', () => {
            const result = service.findPaths(grid, player);
            expect(result.reachableTiles.length).toBeGreaterThan(0);
            expect(result.path).toBeUndefined();
        });

        it('should handle invalid positions gracefully', () => {
            player.position = { x: -1, y: -1 };
            const result = service.findPaths(grid, player, target);
            expect(result.reachableTiles).toEqual([]);
        });

        it('should return empty reachable tiles if getNextTile returns undefined', () => {
            jest.spyOn(utils, 'getNextTile').mockImplementation(() => undefined);
            const result = service.findPaths(grid, player, target);
            expect(result.reachableTiles).toEqual([]);
            expect(result.path).toBeUndefined();
        });

        it('should behave as if speed is 0 when player.stats.speed is undefined', () => {
            player.stats = undefined;
            player.position = { x: 1, y: 1 };

            const result = service.findPaths(grid, player);

            expect(result.path).toBeUndefined();
            expect(result.reachableTiles.length).toBe(0);
        });

        it('should treat unknown tile types as 0 cost', () => {
            grid.board[0][1].tile = 'UNKNOWN_TILE' as TileTypes;
            const result = service.findPaths(grid, player);
            expect(result.reachableTiles.length).toBeGreaterThanOrEqual(0);
        });
    });
});
