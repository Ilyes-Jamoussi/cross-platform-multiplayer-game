import { TestBed } from '@angular/core/testing';
import { TileTypes } from '@common/enums';
import { Grid, Player, QueueItem } from '@common/interfaces';
import { BehaviorSubject } from 'rxjs';
import { PlayerMovementService } from './player-movement.service';
// import * as sharedUtils from '@common/shared-utils';

describe('PlayerMovementService', () => {
    let service: PlayerMovementService;
    let gridSubject: BehaviorSubject<Grid | undefined>;
    let mockGrid: Grid;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [PlayerMovementService],
        });
        service = TestBed.inject(PlayerMovementService);
        const defaultTile = { tile: TileTypes.Default };
        mockGrid = {
            gridSize: 3,
            board: [
                [defaultTile, defaultTile, defaultTile],
                [defaultTile, defaultTile, defaultTile],
                [defaultTile, defaultTile, defaultTile],
            ],
        } as Grid;
        gridSubject = new BehaviorSubject<Grid | undefined>(mockGrid);
    });

    describe('findPaths', () => {
        it('should handle an empty queue gracefully', () => {
            const player: Player = { position: { x: 2, y: 3 }, stats: { speed: 5 } } as Player;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn<any>(service, 'initializeQueue').and.callFake((queue: QueueItem[]) => {
                queue.length = 0;
            });

            const result = service['findPaths'](gridSubject, player);
            expect(result.reachableTiles.length).toBe(0);
        });

        it('should return empty reachableTiles when player is invalid and not adjacent to Ice', () => {
            const player: Player = { position: { x: 1, y: 1 }, stats: { speed: 5 } } as Player;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn<any>(service, 'isPlayerValid').and.returnValue(false);
            spyOn(service, 'getIsIceAdjacent').and.returnValue(false);

            const result = service['findPaths'](gridSubject, player);
            expect(result.reachableTiles).toEqual([]);
        });

        it('should continue pathfinding when player is invalid but adjacent to Ice', () => {
            const player: Player = { position: { x: 0, y: 1 }, stats: { speed: 5 } } as Player;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn<any>(service, 'isPlayerValid').and.returnValue(false);
            spyOn(service, 'getIsIceAdjacent').and.returnValue(true);

            const result = service['findPaths'](gridSubject, player);
            expect(result.reachableTiles).not.toEqual([]);
        });

        it('should break loop immediately when getNextTile returns undefined', () => {
            const player: Player = { position: { x: 2, y: 3 }, stats: { speed: 5 } } as Player;

            const originalShift = Array.prototype.shift;
            Array.prototype.shift = function () {
                return undefined;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const processNeighborsSpy = spyOn<any>(service, 'processNeighbors');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn<any>(service, 'initializeQueue').and.callFake((queue: QueueItem[]) => {
                queue.push({
                    position: { x: 1, y: 1 },
                    cost: 0,
                    path: { positions: [], cost: 0, turns: 0 },
                    turns: 0,
                    lastDirection: undefined,
                } as QueueItem);
            });

            const result = service['findPaths'](gridSubject, player);

            Array.prototype.shift = originalShift;

            expect(result.reachableTiles.length).toBe(0);
            expect(processNeighborsSpy).not.toHaveBeenCalled();
        });
    });

    describe('getIsIceAdjacent', () => {
        beforeEach(() => {
            gridSubject = new BehaviorSubject<Grid | undefined>(mockGrid);
        });

        it('should return false when grid is undefined', () => {
            gridSubject.next(undefined);
            expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: 1 })).toBeFalse();
        });

        it('should return false when position is invalid', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(service.getIsIceAdjacent(gridSubject, null as any)).toBeFalse();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(service.getIsIceAdjacent(gridSubject, undefined as any)).toBeFalse();
        });

        describe('when checking adjacency', () => {
            it('should return true when north tile is Ice', () => {
                mockGrid.board[0][1].tile = TileTypes.Ice;
                gridSubject.next(mockGrid);
                expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: 1 })).toBeTrue();
            });

            it('should return true when south tile is Ice', () => {
                mockGrid.board[2][1].tile = TileTypes.Ice;
                gridSubject.next(mockGrid);
                expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: 1 })).toBeTrue();
            });

            it('should return true when west tile is Ice', () => {
                mockGrid.board[1][0].tile = TileTypes.Ice;
                gridSubject.next(mockGrid);
                expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: 1 })).toBeTrue();
            });

            it('should return true when east tile is Ice', () => {
                mockGrid.board[1][2].tile = TileTypes.Ice;
                gridSubject.next(mockGrid);
                expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: 1 })).toBeTrue();
            });
        });

        describe('edge positions', () => {
            it('should return false for north edge position', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: 0, y: 1 })).toBeFalse();
            });

            it('should return false for south edge position', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: mockGrid.gridSize - 1, y: 1 })).toBeFalse();
            });

            it('should return false for west edge position', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: 0 })).toBeFalse();
            });

            it('should return false for east edge position', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: 1, y: mockGrid.gridSize - 1 })).toBeFalse();
            });

            it('should return true when edge position has adjacent Ice', () => {
                mockGrid.board[0][1].tile = TileTypes.Ice;
                gridSubject.next(mockGrid);
                expect(service.getIsIceAdjacent(gridSubject, { x: 0, y: 0 })).toBeTrue();
            });
        });

        describe('corner positions', () => {
            it('should return false for top-left corner', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: 0, y: 0 })).toBeFalse();
            });

            it('should return false for top-right corner', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: 0, y: mockGrid.gridSize - 1 })).toBeFalse();
            });

            it('should return false for bottom-left corner', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: mockGrid.gridSize - 1, y: 0 })).toBeFalse();
            });

            it('should return false for bottom-right corner', () => {
                expect(service.getIsIceAdjacent(gridSubject, { x: mockGrid.gridSize - 1, y: mockGrid.gridSize - 1 })).toBeFalse();
            });

            it('should return true when corner has adjacent Ice', () => {
                mockGrid.board[mockGrid.gridSize - 1][mockGrid.gridSize - 2].tile = TileTypes.Ice;
                gridSubject.next(mockGrid);
                expect(service.getIsIceAdjacent(gridSubject, { x: mockGrid.gridSize - 1, y: mockGrid.gridSize - 1 })).toBeTrue();
            });
        });
    });
});
