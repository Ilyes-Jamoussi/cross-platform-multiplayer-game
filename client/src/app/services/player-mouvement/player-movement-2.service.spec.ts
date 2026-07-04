import { TestBed } from '@angular/core/testing';
import { GAME_DATA, MOCK_PLAYERS } from '@common/constants.spec';
import { Directions, TileTypes } from '@common/enums';
import { AddToQueueParams, Grid, Neighbor, Player, ProcessNeighborsParams, QueueItem } from '@common/interfaces';
import { BehaviorSubject } from 'rxjs';
import { PlayerMovementService } from './player-movement.service';

describe('PlayerMovementService - Specific Function Tests', () => {
    let service: PlayerMovementService;
    let gridSubject: BehaviorSubject<Grid | undefined>;
    const player: Player = MOCK_PLAYERS[0];

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(PlayerMovementService);

        gridSubject = new BehaviorSubject<Grid | undefined>(GAME_DATA as Grid);
        player.position = { x: 0, y: 0 };
        player.stats = { speed: 6, maxSpeed: 6, attack: 6, life: 6, defense: 6 };
    });

    describe('findPaths', () => {
        it('should return empty reachableTiles when player is invalid', () => {
            player.position = undefined;
            const result = service['findPaths'](gridSubject, player);
            expect(result).toEqual({ reachableTiles: [] });
        });

        it('should return empty reachableTiles when grid is undefined', () => {
            gridSubject.next(undefined);
            const result = service['findPaths'](gridSubject, player);
            expect(result).toEqual({ reachableTiles: [] });
        });

        it('should return reachableTiles and path when target is reached', () => {
            const target = { x: 2, y: 2 };
            const result = service['findPaths'](gridSubject, player, target);
            expect(result.reachableTiles.length).toBeGreaterThan(0);
            expect(result.path).toBeDefined();
        });
    });

    describe('initializeQueue', () => {
        it('should initialize queue with player position', () => {
            const queue: QueueItem[] = [];
            player.position = { x: 0, y: 0 };
            service['initializeQueue'](queue, player);
            expect(queue.length).toBe(1);
            expect(queue[0].position).toEqual(player.position);
        });

        it('should not initialize queue if player position is undefined', () => {
            const queue: QueueItem[] = [];
            player.position = undefined;
            service['initializeQueue'](queue, player);
            expect(queue.length).toBe(0);
        });
    });

    describe('isTargetPosition', () => {
        it('should return true if position matches target', () => {
            const position = { x: 2, y: 2 };
            const target = { x: 2, y: 2 };
            const result = service['isTargetPosition'](position, target);
            expect(result).toBeTrue();
        });

        it('should return false if position does not match target', () => {
            const position = { x: 1, y: 1 };
            const target = { x: 2, y: 2 };
            const result = service['isTargetPosition'](position, target);
            expect(result).toBeFalse();
        });

        it('should return false if target is undefined', () => {
            const position = { x: 1, y: 1 };
            const result = service['isTargetPosition'](position, undefined);
            expect(result).toBeFalse();
        });
    });

    describe('processNeighbors', () => {
        let grid: Grid;
        let params: ProcessNeighborsParams;
        beforeEach(() => {
            grid = GAME_DATA as Grid;

            params = {
                grid,
                position: { x: 1, y: 1 },
                path: { positions: [], cost: 0, turns: 0 },
                cost: 0,
                turns: 0,
                lastDirection: Directions.Right,
                costs: new Map<string, number>(),
                queue: [],
                speed: 10,
            };
        });
        it('should process valid neighbors and add them to the queue', () => {
            if (grid) {
                service['processNeighbors'](gridSubject, params);
                expect(params.queue.length).toBeGreaterThan(0);
            }
        });
        it('should skip a neighbor if the new cost exceeds speed', () => {
            grid.board[2][1] = { tile: TileTypes.Wall, item: { name: '1', description: '1' } };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'isCostExceedsSpeed').and.returnValue(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'shouldSkipNeighbor').and.returnValue(false);
            service['processNeighbors'](gridSubject, params);
            expect(params.queue.length).toBe(0);
        });

        it('should add a neighbor to the queue if the new cost does not exceed speed', () => {
            grid.board[2][1] = { tile: TileTypes.Default, item: { name: '1', description: '1' } };
            const neighbor: Neighbor = { position: { x: 2, y: 1 }, direction: Directions.Right };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'isCostExceedsSpeed').and.returnValue(false);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'shouldSkipNeighbor').and.returnValue(false);
            service['processNeighbors'](gridSubject, params);

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(params.queue.length).toBe(4);
            expect(params.queue[0].position).toEqual(neighbor.position);
        });

        it('should skip a neighbor if shouldSkipNeighbor returns true', () => {
            grid.board[2][1] = { tile: TileTypes.Default, item: { name: '1', description: '1' } };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'isCostExceedsSpeed').and.returnValue(false);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'shouldSkipNeighbor').and.returnValue(true);

            service['processNeighbors'](gridSubject, params);
            expect(params.queue.length).toBe(0);
        });
    });

    describe('shouldSkipNeighbor', () => {
        it('should return true if neighbor is not a valid move', () => {
            const neighbor: Neighbor = { position: { x: -1, y: -1 }, direction: Directions.Right };
            const result = service['shouldSkipNeighbor'](gridSubject, neighbor);
            expect(result).toBeTrue();
        });
    });

    describe('calculateNewCost', () => {
        it('should return the sum of current cost and neighbor tile cost', () => {
            const currentCost = 5;
            const neighborTileCost = 3;
            const result = service['calculateNewCost'](currentCost, neighborTileCost);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(result).toBe(8);
        });
    });

    describe('calculateTurns', () => {
        it('should increment turns if direction changes', () => {
            const turns = 1;
            const lastDirection = Directions.Right;
            const currentDirection = Directions.Up;
            const result = service['calculateTurns'](turns, lastDirection, currentDirection);
            expect(result).toBe(2);
        });

        it('should not increment turns if direction does not change', () => {
            const turns = 1;
            const lastDirection = Directions.Right;
            const currentDirection = Directions.Right;
            const result = service['calculateTurns'](turns, lastDirection, currentDirection);
            expect(result).toBe(1);
        });

        it('should return initial turns if lastDirection is undefined', () => {
            const turns = 1;
            const result = service['calculateTurns'](turns, undefined, Directions.Right);
            expect(result).toBe(1);
        });
    });

    describe('addToQueue', () => {
        it('should add a new item to the queue', () => {
            const queue: QueueItem[] = [];
            const params: AddToQueueParams = {
                queue,
                neighbor: { position: { x: 1, y: 1 }, direction: Directions.Right },
                newCost: 5,
                path: { positions: [], cost: 0, turns: 0 },
                newTurns: 1,
                direction: Directions.Right,
            };
            service['addToQueue'](params);
            expect(queue.length).toBe(1);
            expect(queue[0].position).toEqual({ x: 1, y: 1 });
        });
    });

    describe('shouldAddToQueue', () => {
        let costs: Map<string, number>;
        const costKey = '1,1';

        beforeEach(() => {
            costs = new Map<string, number>();
        });

        it('should return true when costs map does not have the costKey', () => {
            const newCost = 5;
            const result = service['shouldAddToQueue'](costs, costKey, newCost);
            expect(result).toBeTrue();
        });

        it('should return true when newCost is less than the existing cost', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            costs.set(costKey, 10);
            const newCost = 5;
            const result = service['shouldAddToQueue'](costs, costKey, newCost);
            expect(result).toBeTrue();
        });

        it('should return false when newCost is greater than the existing cost', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            costs.set(costKey, 5);
            const newCost = 10;
            const result = service['shouldAddToQueue'](costs, costKey, newCost);
            expect(result).toBeFalse();
        });

        it('should return false when newCost is equal to the existing cost', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            costs.set(costKey, 5);
            const newCost = 5;
            const result = service['shouldAddToQueue'](costs, costKey, newCost);
            expect(result).toBeFalse();
        });

        it('should return true when costs map has the costKey but the value is undefined', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            costs.set(costKey, undefined as any);
            const newCost = 5;
            const result = service['shouldAddToQueue'](costs, costKey, newCost);
            expect(result).toBeTrue();
        });
    });
});
