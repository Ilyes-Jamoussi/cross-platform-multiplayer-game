import { GRID_SIZE_ITEMS, VALID_TERRAINS, HALF_PERCENT, FULL_PERCENT } from '@common/constants';
import { GameModes, ItemTypes, TileTypes } from '@common/enums';
import { BoardCell } from '@common/interfaces';
import { dfs } from '@common/shared-utils';
import { GridGame } from '@app/classes/grid/grid';

export interface ValidationError {
    key: string;
    params?: Record<string, string | number>;
}

export class GridVerifier {
    static validateGameMapFromFrontend(game: GridGame): ValidationError[] {
        const { grid } = game;
        const errors: ValidationError[] = [];

        const accessibilityErrors = this.areTerrainsAccessible(game);
        errors.push(...accessibilityErrors);

        if (this.calculateTerrainPercentage(grid) < HALF_PERCENT) {
            errors.push({
                key: 'validation.low_terrain_coverage',
                params: { percentage: Math.floor(this.calculateTerrainPercentage(grid)) },
            });
        }

        if (!this.correctNumberOfItemsPlaced(game)) {
            errors.push({ key: 'validation.not_enough_items' });
        }

        if (game.gameMode === GameModes.CTF && !this.isFlagPlaced(grid)) {
            errors.push({ key: 'validation.missing_flag' });
        }

        if (!this.validateItems(grid)) {
            errors.push({ key: 'validation.items_on_wall' });
        }

        if (!this.areDoorsValid(game)) {
            errors.push({ key: 'validation.invalid_door' });
        }

        if (!this.allStartingPointsPlaced(game)) {
            errors.push({ key: 'validation.missing_starting_points' });
        }

        return errors;
    }

    private static isDoorValid(grid: BoardCell[][], row: number, col: number): boolean {
        const terrain = [TileTypes.Default, TileTypes.Ice, TileTypes.Water];

        const isValidRow = row >= 0 && row < grid.length;
        const isValidCol = col >= 0 && col < grid[0].length;

        if (!isValidRow || !isValidCol) return false;

        const horizontalValid =
            grid[row]?.[col - 1]?.tile === TileTypes.Wall &&
            grid[row]?.[col + 1]?.tile === TileTypes.Wall &&
            terrain.includes(grid[row - 1]?.[col]?.tile) &&
            terrain.includes(grid[row + 1]?.[col]?.tile);

        const verticalValid =
            grid[row - 1]?.[col]?.tile === TileTypes.Wall &&
            grid[row + 1]?.[col]?.tile === TileTypes.Wall &&
            terrain.includes(grid[row]?.[col - 1]?.tile) &&
            terrain.includes(grid[row]?.[col + 1]?.tile);

        return horizontalValid || verticalValid;
    }

    private static areDoorsValid(game: GridGame): boolean {
        const portes = [TileTypes.OpenedDoor, TileTypes.Door];

        for (let i = 0; i < game.size; i++) {
            for (let j = 0; j < game.size; j++) {
                if (portes.includes(game.grid[i][j].tile)) {
                    if (!this.isDoorValid(game.grid, i, j)) return false;
                }
            }
        }
        return true;
    }

    private static calculateTerrainPercentage(grid: BoardCell[][]): number {
        const terrainTiles = [TileTypes.Water, TileTypes.Ice, TileTypes.Default];
        const totalTiles = grid.length * grid[0].length;
        const totalTerrainTiles = grid.flat().filter((tile) => terrainTiles.includes(tile.tile)).length;
        return (totalTerrainTiles / totalTiles) * FULL_PERCENT;
    }

    private static allStartingPointsPlaced(game: GridGame): boolean {
        const requiredStartingPoints = GRID_SIZE_ITEMS.get(game.size.toString());
        const actualStartingPoints = game.grid.flat().filter((tile) => tile.item?.name.includes(ItemTypes.StartingPoint)).length;
        return actualStartingPoints === requiredStartingPoints;
    }

    private static areTerrainsAccessible(game: GridGame): ValidationError[] {
        const rows = game.grid.length;
        const cols = game.grid[0].length;
        let startX = 0;
        let startY = 0;
        const terrainSet = new Set<string>();
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const tileName = game.grid[i][j]?.tile;
                if (VALID_TERRAINS.has(tileName)) {
                    terrainSet.add(`${i},${j}`);
                    startX = i;
                    startY = j;
                }
            }
        }
        if (terrainSet.size === 0) {
            return [{ key: 'validation.inaccessible_tiles' }];
        }
        const visited = new Set<string>();
        dfs({ x: startX, y: startY }, game.grid, visited);

        for (const tile of terrainSet) {
            if (!visited.has(tile)) {
                return [{ key: 'validation.inaccessible_tiles' }];
            }
        }
        return [];
    }

    private static correctNumberOfItemsPlaced(game: GridGame): boolean {
        const requiredItems = GRID_SIZE_ITEMS.get(game.size.toString());
        const actualItems = game.grid
            .flat()
            .filter(
                (tile) => tile.item.name && !tile.item?.name.includes(ItemTypes.StartingPoint) && !tile.item?.name.includes(ItemTypes.Flag),
            ).length;
        return actualItems === requiredItems;
    }

    private static isFlagPlaced(grid: BoardCell[][]): boolean {
        return grid.flat().some((tile) => tile.item?.name.includes(ItemTypes.Flag));
    }

    private static validateItems(board: BoardCell[][]): boolean {
        for (const row of board) {
            for (const cell of row) {
                if (cell.tile === TileTypes.Wall && cell.item.name) {
                    return false;
                }
            }
        }
        return true;
    }
}
