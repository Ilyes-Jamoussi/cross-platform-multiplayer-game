import { TILE_COST } from '@common/constants';
import { Grid, Path, PathfindingResult, Player, QueueItem } from '@common/interfaces';
import { Position } from '@common/types';
import { Injectable } from '@nestjs/common';
import { TileTypes } from '@common/enums';
import { getBestPath, getNeighbors, getNextTile } from '@common/shared-utils';

@Injectable()
export class MovementService {
    decreaseSpeed(player: Player, grid: Grid, position: Position) {
        const tile = grid.board[position.x][position.y];
        const tileCost = TILE_COST.get(tile.tile) ?? 0;
        if (player.stats?.speed) {
            player.stats.speed -= tileCost;
        }
    }

    async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    findPaths(grid: Grid, player: Player, target?: Position): PathfindingResult {
        const speed = player.stats?.speed ?? 0;
        const queue: QueueItem[] = [];
        const costs: Map<string, number> = new Map();
        const visited = new Set<string>();
        const reachableTiles: Position[] = [];
        const allPaths: Path[] = [];
        if (!player.position) {
            return { reachableTiles: [] };
        }
        queue.push({
            position: player.position,
            cost: 0,
            path: { positions: [], cost: 0, turns: 0 },
            turns: 0,
            lastDirection: '',
        });

        while (queue.length > 0) {
            const current = getNextTile(queue);
            if (!current) break;

            const { position, cost, path, turns, lastDirection } = current;

            if (visited.has(`${position.x},${position.y}`)) continue;
            visited.add(`${position.x},${position.y}`);
            if (!(player.position.x === position.x && player.position.y === position.y)) {
                reachableTiles.push(position);
            }
            if (target && position.x === target.x && position.y === target.y) {
                allPaths.push({ positions: [...path.positions, position], cost, turns });
            }
            this.processNeighbors(grid, {
                position,
                path,
                cost,
                turns,
                lastDirection,
                costs,
                queue,
                speed,
                player,
            });
        }
        return getBestPath(allPaths, reachableTiles);
    }

    private processNeighbors(
        grid: Grid,
        params: {
            position: Position;
            path: Path;
            cost: number;
            turns: number;
            lastDirection: string;
            costs: Map<string, number>;
            queue: QueueItem[];
            speed: number;
            player: Player;
        },
    ) {
        const { position, path, cost, turns, lastDirection, costs, queue, speed } = params;
        const neighbors = getNeighbors(position);

        for (const neighbor of neighbors) {
            if (!this.isValidMove(grid, neighbor.position, params.player)) continue;

            const neighborTileCost = TILE_COST.get(grid.board[neighbor.position.x][neighbor.position.y].tile) ?? 0;
            const newCost = cost + neighborTileCost;

            if (newCost > speed) continue;

            const costKey = `${neighbor.position.x},${neighbor.position.y}`;
            const newTurns = lastDirection && lastDirection !== neighbor.direction ? turns + 1 : turns;

            if (!costs.has(costKey) || newCost < (costs.get(costKey) ?? Infinity)) {
                costs.set(costKey, newCost);
                queue.push({
                    position: neighbor.position,
                    cost: newCost,
                    path: {
                        positions: [...path.positions, position],
                        cost: newCost,
                        turns: newTurns,
                    },
                    turns: newTurns,
                    lastDirection: neighbor.direction,
                });
            }
        }
    }

    private isValidMove(grid: Grid, position: Position, player: Player): boolean {
        if (position.x < 0 || position.y < 0 || position.x >= grid.gridSize || position.y >= grid.gridSize) {
            return false;
        }

        const cell = grid.board[position.x][position.y];
        return cell.tile !== TileTypes.Wall && (!cell.player || cell.player.id === player.id);
    }
}
