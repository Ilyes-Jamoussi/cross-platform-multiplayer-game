import { Injectable } from '@angular/core';
import { TILE_COST } from '@common/constants';
import { TileTypes } from '@common/enums';
import { AddToQueueParams, Grid, Neighbor, Path, PathfindingResult, Player, ProcessNeighborsParams, QueueItem } from '@common/interfaces';
import { getBestPath, getNeighbors, getNextTile, isInBoardBounds } from '@common/shared-utils';
import { Position } from '@common/types';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class PlayerMovementService {
    private _reachableTiles: Position[] = [];
    private _highlightedPath: Path = { positions: [], cost: 0, turns: 0 };

    get reachableTiles() {
        return this._reachableTiles;
    }

    get highlightedPath() {
        return this._highlightedPath;
    }

    set reachableTiles(postions: Position[]) {
        this._reachableTiles = postions;
    }

    set highlightedPath(path: Path) {
        this._highlightedPath = path;
    }

    getReachableTiles(gridSubject: BehaviorSubject<Grid | undefined>, player: Player) {
        this._reachableTiles = this.findPaths(gridSubject, player).reachableTiles;
    }

    getShortestPath(gridSubject: BehaviorSubject<Grid | undefined>, player: Player, target: Position): Path {
        return this.findPaths(gridSubject, player, target).path || { positions: [], cost: 0, turns: 0 };
    }

    movePlayer(gridSubject: BehaviorSubject<Grid | undefined>, player: Player, nextPosition: Position) {
        const grid = gridSubject.getValue();
        if (!grid) return;
        if (!player.position) return;

        this._highlightedPath.positions = this._highlightedPath.positions.filter(
            (position) => position.x !== nextPosition.x || position.y !== nextPosition.y,
        );

        for (const row of grid.board) {
            for (const cell of row) {
                if (cell.player?.id === player.id) {
                    cell.player = undefined;
                }
            }
        }
        gridSubject.next({ ...grid });

        this.setPlayerPosition(gridSubject, player, nextPosition);
    }

    isValidMove(gridSubject: BehaviorSubject<Grid | undefined>, position: Position): boolean {
        const grid = gridSubject.getValue();
        if (!grid) return false;

        if (!this.isPositionValid(grid, position)) return false;

        return (
            grid.board[position.x][position.y].tile !== TileTypes.Wall &&
            grid.board[position.x][position.y].tile !== TileTypes.Door &&
            !grid.board[position.x][position.y].player
        );
    }

    getIsIceAdjacent(gridSubject: BehaviorSubject<Grid | undefined>, position: Position) {
        const grid = gridSubject.getValue();
        if (!grid || !position) return false;

        const adjacentPositions = [
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
        ];

        for (const adjPos of adjacentPositions) {
            if (this.isIceTileInBounds(adjPos, grid)) {
                return true;
            }
        }
        return false;
    }

    private isIceTileInBounds(pos: Position, grid: Grid): boolean {
        return isInBoardBounds(pos, grid.board.length) && grid.board[pos.x][pos.y].tile === TileTypes.Ice;
    }

    private setPlayerPosition(gridSubject: BehaviorSubject<Grid | undefined>, player: Player, position: Position) {
        const updatedPlayer = { ...player, position };
        this.updateGridCell(gridSubject, position, updatedPlayer);
    }

    private updateGridCell(gridSubject: BehaviorSubject<Grid | undefined>, position: Position, player: Player | null) {
        const grid = gridSubject.getValue();

        if (!grid || !this.isPositionValid(grid, position)) return;

        const cell = grid.board[position.x][position.y];

        cell.player = player ? { ...player, avatar: player.avatar } : undefined;
        gridSubject.next({ ...grid });
    }

    private findPaths(gridSubject: BehaviorSubject<Grid | undefined>, player: Player, target?: Position): PathfindingResult {
        const grid = gridSubject.getValue();
        const speed = player.stats?.speed;
        const queue: QueueItem[] = [];
        const costs: Map<string, number> = new Map();
        const visited = new Set<string>();
        const reachableTiles: Position[] = [];
        const allPaths: Path[] = [];

        if (!grid || typeof speed !== 'number' || !player.position) {
            return { reachableTiles: [] };
        }
        if (!this.isPlayerValid(player)) {
            if (!this.getIsIceAdjacent(gridSubject, player.position)) {
                return { reachableTiles: [] };
            }
        }

        this.initializeQueue(queue, player);

        while (queue.length) {
            const current = getNextTile(queue);
            if (!current) break;

            const { position, cost, path, turns, lastDirection } = current;

            if (this.isTileVisited(visited, position)) continue;
            visited.add(`${position.x},${position.y}`);
            if (!(player.position.x === position.x && player.position.y === position.y)) {
                reachableTiles.push(position);
            }

            if (this.isTargetPosition(position, target)) {
                allPaths.push({ positions: [...path.positions, position], cost, turns });
            }

            this.processNeighbors(gridSubject, {
                grid,
                position,
                path,
                cost,
                turns,
                lastDirection,
                costs,
                queue,
                speed,
            });
        }
        return getBestPath(allPaths, reachableTiles);
    }

    private isPlayerValid(player: Player): boolean {
        return !!player.position && player.stats?.speed !== undefined && player.stats?.speed >= 0;
    }

    private initializeQueue(queue: QueueItem[], player: Player): void {
        if (!player.position) return;
        queue.push({ position: player.position, cost: 0, path: { positions: [], cost: 0, turns: 0 }, turns: 0, lastDirection: '' });
    }

    private isTileVisited(visited: Set<string>, position: Position): boolean {
        return visited.has(`${position.x},${position.y}`);
    }

    private isTargetPosition(position: Position, target?: Position): boolean {
        return target?.x === position.x && target?.y === position.y;
    }

    private processNeighbors(gridSubject: BehaviorSubject<Grid | undefined>, params: ProcessNeighborsParams) {
        const { grid, position, path, cost, turns, lastDirection, costs, queue, speed } = params;

        const neighbors = getNeighbors(position);

        for (const neighbor of neighbors) {
            if (this.shouldSkipNeighbor(gridSubject, neighbor)) continue;

            const neighborTileCost = this.getNeighborTileCost(grid, neighbor);
            const newCost = this.calculateNewCost(cost, neighborTileCost);
            if (this.isCostExceedsSpeed(newCost, speed)) continue;
            const costKey = this.getCostKey(neighbor);
            const newTurns = this.calculateTurns(turns, lastDirection, neighbor.direction);

            if (this.shouldAddToQueue(costs, costKey, newCost)) {
                this.addToQueue({ queue, neighbor, newCost, path, newTurns, direction: neighbor.direction });
            }
        }
    }

    private shouldSkipNeighbor(gridSubject: BehaviorSubject<Grid | undefined>, neighbor: Neighbor): boolean {
        return !this.isValidMove(gridSubject, neighbor.position);
    }

    private getNeighborTileCost(grid: Grid, neighbor: Neighbor): number {
        const neighborTile = grid.board[neighbor.position.x][neighbor.position.y];
        return TILE_COST.get(neighborTile.tile) ?? 0;
    }

    private calculateNewCost(cost: number, neighborTileCost: number): number {
        return cost + neighborTileCost;
    }

    private isCostExceedsSpeed(newCost: number, speed: number): boolean {
        return newCost > speed;
    }

    private getCostKey(neighbor: Neighbor): string {
        return `${neighbor.position.x},${neighbor.position.y}`;
    }

    private calculateTurns(turns: number, lastDirection?: string, currentDirection?: string): number {
        return lastDirection && lastDirection !== currentDirection ? turns + 1 : turns;
    }

    private shouldAddToQueue(costs: Map<string, number>, costKey: string, newCost: number): boolean {
        return !costs.has(costKey) || newCost < (costs.get(costKey) ?? Infinity);
    }

    private addToQueue(params: AddToQueueParams) {
        const { queue, neighbor, newCost, path, newTurns, direction } = params;

        queue.push({
            position: { x: neighbor.position.x, y: neighbor.position.y },
            cost: newCost,
            path: { positions: [...path.positions, { x: neighbor.position.x, y: neighbor.position.y }], cost: newCost, turns: newTurns },
            turns: newTurns,
            lastDirection: direction,
        });
    }

    private isPositionValid(grid: Grid, position: Position) {
        return !(position.x < 0 || position.y < 0 || position.x >= grid.gridSize || position.y >= grid.gridSize);
    }
}
