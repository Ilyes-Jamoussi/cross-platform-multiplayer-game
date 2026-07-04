import { TestBed } from '@angular/core/testing';
import { TILE_COST } from '@common/constants';
import { GAME_DATA, MOCK_PLAYERS } from '@common/constants.spec';
import { Directions, TileTypes } from '@common/enums';
import { Grid, Neighbor, Player, QueueItem } from '@common/interfaces';
import { BehaviorSubject } from 'rxjs';
import { PlayerMovementService } from './player-movement.service';

describe('PlayerMovementService', () => {
    let service: PlayerMovementService;
    let gridSubject: BehaviorSubject<Grid | undefined>;
    let player: Player = MOCK_PLAYERS[0];

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(PlayerMovementService);

        gridSubject = new BehaviorSubject<Grid | undefined>(GAME_DATA as Grid);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('main methods', () => {
        it('should get reachable tiles', async () => {
            await service.getReachableTiles(gridSubject, player);
            expect(service.reachableTiles.length).toBeDefined();
        });

        it('should get the shortest path', () => {
            const target = { x: 2, y: 2 };
            const path = service.getShortestPath(gridSubject, player, target);
            expect(path.positions.length).toBeDefined();
        });

        it('should move the player', async () => {
            player.position = { x: 2, y: 2 };
            const nextPosition = { x: 3, y: 2 };
            await service.movePlayer(gridSubject, player, nextPosition);

            const updatedGrid = gridSubject.getValue();
            expect(updatedGrid?.board[nextPosition.x][nextPosition.y].player).toEqual(
                jasmine.objectContaining({
                    id: player.id,
                    position: nextPosition,
                }),
            );
        });

        it('should invalidate a move outside the grid', () => {
            const position = { x: -1, y: -1 };
            const isValid = service.isValidMove(gridSubject, position);
            expect(isValid).toBeFalse();
        });

        it('should set and get reachableTiles', () => {
            const positions = [
                { x: 1, y: 1 },
                { x: 2, y: 2 },
            ];
            service.reachableTiles = positions;
            expect(service.reachableTiles).toEqual(positions);
        });

        it('should set and get highlightedPath', () => {
            const path = {
                positions: [
                    { x: 1, y: 1 },
                    { x: 2, y: 2 },
                ],
                cost: 5,
                turns: 2,
            };
            service.highlightedPath = path;
            expect(service.highlightedPath).toEqual(path);
        });
    });

    describe('Undefined grid branches', () => {
        beforeEach(() => {
            player = MOCK_PLAYERS[0];
            gridSubject = new BehaviorSubject<Grid | undefined>(undefined);
        });

        it('should return empty reachable tiles when grid is undefined', async () => {
            await service.getReachableTiles(gridSubject, player);
            expect(service.reachableTiles).toEqual([]);
        });

        it('should return empty path when getting shortest path with undefined grid', () => {
            const target = { x: 2, y: 2 };
            const path = service.getShortestPath(gridSubject, player, target);
            expect(path).toEqual({ positions: [], cost: 0, turns: 0 });
        });

        it('should not move the player when grid is undefined', async () => {
            const initialPosition = { x: 2, y: 2 };
            player.position = initialPosition;
            const nextPosition = { x: 3, y: 3 };
            await service.movePlayer(gridSubject, player, nextPosition);
            expect(player.position).toEqual(initialPosition);
            expect(gridSubject.getValue()).toBeUndefined();
        });

        it('should invalidate any move when grid is undefined', () => {
            const position = { x: 1, y: 1 };
            const isValid = service.isValidMove(gridSubject, position);
            expect(isValid).toBeFalse();
        });
    });

    describe('Early returns and If statements', () => {
        it('should return if playerPosition is undefined', () => {
            player.position = undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateSpy = spyOn(service as any, 'updateGridCell');
            service.movePlayer(gridSubject, player, { x: 1, y: 2 });
            expect(updateSpy).not.toHaveBeenCalled();
        });

        it('should remove the nextPosition from _highlightedPath.positions when nextPosition exists', async () => {
            const nextPosition = { x: 1, y: 0 };
            service['_highlightedPath'] = {
                positions: [nextPosition, { x: 2, y: 0 }, { x: 3, y: 0 }],
                cost: 2,
                turns: 0,
            };

            await service.movePlayer(gridSubject, { ...player, position: nextPosition }, nextPosition);

            expect(service['_highlightedPath'].positions).toEqual([
                { x: 2, y: 0 },
                { x: 3, y: 0 },
            ]);
        });

        it('should return early when player has no position', () => {
            const queue: QueueItem[] = [];
            const playerWithNoPosition: Player = {
                ...MOCK_PLAYERS[0],
                position: undefined,
            };
            service['initializeQueue'](queue, playerWithNoPosition);
            expect(queue.length).toBe(0);
        });
    });

    describe('getNeighborTileCost', () => {
        it('should return the correct cost when the tile type exists in TILE_COST', () => {
            const grid = gridSubject.getValue();
            if (grid) {
                const tileType = TileTypes.Wall;
                const expectedCost = TILE_COST.get(tileType) ?? 0;

                grid.board[1][1] = { tile: tileType, item: { name: '', description: '' } };

                const neighbor: Neighbor = {
                    position: { x: 1, y: 1 },
                    direction: Directions.Right,
                };

                const result = service['getNeighborTileCost'](grid, neighbor);
                expect(result).toBe(expectedCost);
            }
        });

        it('should return 0 when the tile type does not exist in TILE_COST', () => {
            const grid = gridSubject.getValue();
            if (grid) {
                const tileType = TileTypes.Door;
                grid.board[1][1] = { tile: tileType, item: { name: '', description: '' } };

                const neighbor: Neighbor = {
                    position: { x: 1, y: 1 },
                    direction: Directions.Right,
                };

                const result = service['getNeighborTileCost'](grid, neighbor);
                expect(result).toBe(0);
            }
        });
    });
});
