/* eslint-disable max-lines */
import { Injectable, Logger } from '@nestjs/common';
import { BoardService } from '@app/services/board/board.service';
import { CreateGameDto } from '@app/model/dto/create-game.dto';
import {
    MIN_STARTING_POINT_DISTANCE,
    MIN_BODY_SIZE,
    MAX_GENERATION_ATTEMPTS,
    MAX_PLACEMENT_ATTEMPTS,
    MIN_STRUCTURE_SIZE,
    MAX_STRUCTURE_SIZE,
    STRUCTURE_SPACING,
    BODY_EXPANSION_PROBABILITY,
    NUMBER_OF_SIDES,
    PERCENTAGE_DIVISOR,
} from '@app/constants/board-generator-constants';
import { BoardCell } from '@common/interfaces';
import { Position } from '@common/types';
import { GameModes, GameSizes, ItemCounts, ItemId, Players, TileTypes } from '@common/enums';
import { generateUniqueItemId } from '@common/shared-utils';

export interface GeneratorParams {
    gridSize: number;
    gameMode: string;
    waterPercentage: number;
    icePercentage: number;
}

interface Structure {
    x: number;
    y: number;
    width: number;
    height: number;
}

const GRID_CONFIG = {
    [GameSizes.Small]: { startingPoints: Players.SmallMap, items: ItemCounts.SmallItem, structures: 1 },
    [GameSizes.Medium]: { startingPoints: Players.MediumMap, items: ItemCounts.MediumItem, structures: 2 },
    [GameSizes.Big]: { startingPoints: Players.BigMap, items: ItemCounts.BigItem, structures: 3 },
};

@Injectable()
export class BoardGeneratorService {
    private previousGridHash: string = '';

    constructor(
        private readonly logger: Logger,
        private readonly boardService: BoardService,
    ) {
        this.logger.log('BoardGeneratorService initialized');
    }

    generateGrid(params: GeneratorParams): BoardCell[][] {
        this.logger.log(`Generating grid: ${params.gridSize}x${params.gridSize}, mode: ${params.gameMode}`);

        let attempts = 0;
        let grid: BoardCell[][] | null = null;

        while (attempts < MAX_GENERATION_ATTEMPTS) {
            try {
                grid = this.attemptGeneration(params);
                const gridHash = this.hashGrid(grid);

                if (gridHash === this.previousGridHash) {
                    this.logger.warn(`Duplicate grid detected, attempt ${attempts + 1}`);
                    attempts++;
                    continue;
                }

                const isValid = this.validateGrid(grid, params);
                if (isValid) {
                    this.previousGridHash = gridHash;
                    this.logger.log(`Grid generated successfully in ${attempts + 1} attempt(s)`);
                    return grid;
                } else {
                    this.logger.warn(`Grid validation failed, attempt ${attempts + 1}`);
                }
            } catch (error) {
                this.logger.warn(`Generation attempt ${attempts + 1} failed: ${error.message}`);
            }
            attempts++;
        }

        this.logger.error(`Failed to generate valid grid after ${MAX_GENERATION_ATTEMPTS} attempts`);
        throw new Error('Failed to generate valid grid after maximum attempts');
    }

    private attemptGeneration(params: GeneratorParams): BoardCell[][] {
        const grid = this.createEmptyGrid(params.gridSize);
        const config = GRID_CONFIG[params.gridSize as GameSizes];

        if (!config) {
            throw new Error(`Invalid grid size: ${params.gridSize}`);
        }

        const structures: Structure[] = [];
        const availableItems = this.getShuffledItems(config.items);

        this.placeStructures(grid, config.structures, structures, availableItems);
        this.placeStartingPoints(grid, config.startingPoints, structures);
        this.generateTileBodies(grid, params.waterPercentage, TileTypes.Water);
        this.generateTileBodies(grid, params.icePercentage, TileTypes.Ice);

        const remainingItems = config.items - config.structures;
        if (remainingItems > 0) {
            this.placeItems(grid, remainingItems, structures, availableItems);
        }

        if (params.gameMode === GameModes.CTF) {
            this.placeFlag(grid);
        }

        return grid;
    }

    private createEmptyGrid(size: number): BoardCell[][] {
        const grid: BoardCell[][] = [];
        for (let row = 0; row < size; row++) {
            grid[row] = [];
            for (let col = 0; col < size; col++) {
                grid[row][col] = {
                    tile: TileTypes.Default,
                    item: { name: '', description: '' },
                };
            }
        }
        return grid;
    }

    private placeStartingPoints(grid: BoardCell[][], count: number, structures: Structure[]): void {
        const positions: Position[] = [];
        const size = grid.length;

        for (let i = 0; i < count; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < MAX_PLACEMENT_ATTEMPTS) {
                const x = Math.floor(Math.random() * size);
                const y = Math.floor(Math.random() * size);

                if (this.isInsideStructure(x, y, structures)) {
                    attempts++;
                    continue;
                }

                if (this.isValidStartingPointPosition(x, y, positions, grid)) {
                    const uniqueId = generateUniqueItemId(ItemId.ItemStartingPoint, grid);
                    grid[x][y].item = {
                        name: uniqueId,
                        description: 'Point de départ',
                    };
                    positions.push({ x, y });
                    placed = true;
                }
                attempts++;
            }

            if (!placed) {
                throw new Error('Could not place all starting points');
            }
        }
    }

    private isValidStartingPointPosition(x: number, y: number, existingPoints: Position[], grid: BoardCell[][]): boolean {
        if (grid[x][y].tile !== TileTypes.Default) return false;
        if (grid[x][y].item.name) return false;

        for (const point of existingPoints) {
            const distance = Math.abs(x - point.x) + Math.abs(y - point.y);
            if (distance < MIN_STARTING_POINT_DISTANCE) {
                return false;
            }
        }

        return true;
    }

    private placeStructures(grid: BoardCell[][], count: number, structures: Structure[], availableItems: string[]): void {
        const size = grid.length;

        for (let i = 0; i < count; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < MAX_PLACEMENT_ATTEMPTS) {
                const width = Math.floor(Math.random() * (MAX_STRUCTURE_SIZE - MIN_STRUCTURE_SIZE + 1)) + MIN_STRUCTURE_SIZE;
                const height = Math.floor(Math.random() * (MAX_STRUCTURE_SIZE - MIN_STRUCTURE_SIZE + 1)) + MIN_STRUCTURE_SIZE;

                if (width >= size || height >= size) {
                    attempts++;
                    continue;
                }

                const x = Math.floor(Math.random() * (size - width - 1)) + 1;
                const y = Math.floor(Math.random() * (size - height - 1)) + 1;

                if (this.canPlaceStructure(x, y, width, height, structures, size)) {
                    const nextItem = availableItems.shift();
                    if (nextItem === undefined) break;
                    this.buildStructure(grid, x, y, width, height, nextItem);
                    structures.push({ x, y, width, height });
                    placed = true;
                }
                attempts++;
            }

            if (!placed) {
                throw new Error('Could not place all structures');
            }
        }
    }

    // eslint-disable-next-line max-params
    private canPlaceStructure(x: number, y: number, width: number, height: number, structures: Structure[], gridSize: number): boolean {
        if (x + width > gridSize || y + height > gridSize) return false;

        for (const struct of structures) {
            const hasOverlap = !(
                x + width + STRUCTURE_SPACING <= struct.x ||
                x >= struct.x + struct.width + STRUCTURE_SPACING ||
                y + height + STRUCTURE_SPACING <= struct.y ||
                y >= struct.y + struct.height + STRUCTURE_SPACING
            );
            if (hasOverlap) return false;
        }

        return true;
    }

    private buildStructure(grid: BoardCell[][], x: number, y: number, width: number, height: number, itemId: string): void {
        for (let i = x; i < x + width; i++) {
            for (let j = y; j < y + height; j++) {
                if (i === x || i === x + width - 1 || j === y || j === y + height - 1) {
                    grid[i][j].tile = TileTypes.Wall;
                } else {
                    grid[i][j].tile = TileTypes.Default;
                }
            }
        }

        const doorSide = Math.floor(Math.random() * NUMBER_OF_SIDES);
        let doorX: number;
        let doorY: number;

        switch (doorSide) {
            case 0:
                doorX = x;
                doorY = y + Math.floor(Math.random() * (height - 2)) + 1;
                break;
            case 1:
                doorX = x + width - 1;
                doorY = y + Math.floor(Math.random() * (height - 2)) + 1;
                break;
            case 2:
                doorX = x + Math.floor(Math.random() * (width - 2)) + 1;
                doorY = y;
                break;
            default:
                doorX = x + Math.floor(Math.random() * (width - 2)) + 1;
                doorY = y + height - 1;
        }

        grid[doorX][doorY].tile = TileTypes.Door;

        const interiorX = x + 1 + Math.floor(Math.random() * (width - 2));
        const interiorY = y + 1 + Math.floor(Math.random() * (height - 2));
        const uniqueId = generateUniqueItemId(itemId, grid);
        grid[interiorX][interiorY].item = {
            name: uniqueId,
            description: '',
        };
    }

    private generateTileBodies(grid: BoardCell[][], percentage: number, tileType: TileTypes): void {
        if (percentage === 0) return;

        const size = grid.length;
        const targetTiles = Math.floor((size * size * percentage) / PERCENTAGE_DIVISOR);
        if (targetTiles === 0) return;

        let placedTiles = 0;
        let attempts = 0;

        while (placedTiles < targetTiles && attempts < MAX_PLACEMENT_ATTEMPTS) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);

            if (grid[x][y].tile === TileTypes.Default && !grid[x][y].item.name) {
                const remaining = targetTiles - placedTiles;
                const minRequired = Math.min(MIN_BODY_SIZE, remaining);
                const candidates = this.collectBodyPositions(grid, x, y, tileType, remaining);
                if (candidates.length >= minRequired) {
                    for (const pos of candidates) {
                        grid[pos.x][pos.y].tile = tileType;
                    }
                    placedTiles += candidates.length;
                    attempts = 0;
                } else {
                    attempts++;
                }
            } else {
                attempts++;
            }
        }
    }

    private collectBodyPositions(grid: BoardCell[][], startX: number, startY: number, tileType: TileTypes, maxTiles: number): Position[] {
        const size = grid.length;
        const visited = new Set<string>();
        const queue: Position[] = [{ x: startX, y: startY }];
        const candidates: Position[] = [];

        while (queue.length > 0 && candidates.length < maxTiles) {
            const pos = queue.shift();
            if (!pos) continue;
            const key = `${pos.x},${pos.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (pos.x < 0 || pos.x >= size || pos.y < 0 || pos.y >= size) continue;
            if (grid[pos.x][pos.y].tile !== TileTypes.Default) continue;
            if (grid[pos.x][pos.y].item.name) continue;

            candidates.push(pos);

            if (candidates.length < MIN_BODY_SIZE || Math.random() > BODY_EXPANSION_PROBABILITY) {
                queue.push({ x: pos.x + 1, y: pos.y });
                queue.push({ x: pos.x - 1, y: pos.y });
                queue.push({ x: pos.x, y: pos.y + 1 });
                queue.push({ x: pos.x, y: pos.y - 1 });
            }
        }

        return candidates;
    }

    private placeItems(grid: BoardCell[][], count: number, structures: Structure[], availableItems: string[]): void {
        const size = grid.length;
        let placed = 0;
        let attempts = 0;

        while (placed < count && attempts < MAX_PLACEMENT_ATTEMPTS) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);

            if (this.canPlaceItem(grid, x, y) && !this.isInsideStructure(x, y, structures)) {
                const itemId = availableItems.shift();
                if (itemId === undefined) break;
                const uniqueId = generateUniqueItemId(itemId, grid);
                grid[x][y].item = {
                    name: uniqueId,
                    description: '',
                };
                placed++;
                attempts = 0;
            } else {
                attempts++;
            }
        }

        if (placed < count) {
            throw new Error('Could not place all items');
        }
    }

    private placeFlag(grid: BoardCell[][]): void {
        const size = grid.length;
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < MAX_PLACEMENT_ATTEMPTS) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);

            if (this.canPlaceItem(grid, x, y)) {
                grid[x][y].item = {
                    name: ItemId.ItemFlag,
                    description: 'Drapeau',
                };
                placed = true;
            }
            attempts++;
        }

        if (!placed) {
            throw new Error('Could not place flag');
        }
    }

    private canPlaceItem(grid: BoardCell[][], x: number, y: number): boolean {
        if (grid[x][y].tile === TileTypes.Wall) return false;
        if (grid[x][y].item.name) return false;
        return true;
    }

    private isInsideStructure(x: number, y: number, structures: Structure[]): boolean {
        for (const struct of structures) {
            if (x >= struct.x && x < struct.x + struct.width && y >= struct.y && y < struct.y + struct.height) {
                return true;
            }
        }
        return false;
    }

    private getShuffledItems(count: number): string[] {
        const allItems = [ItemId.Item1, ItemId.Item2, ItemId.Item3, ItemId.Item4, ItemId.Item5, ItemId.Item6];
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
        return allItems.slice(0, count);
    }

    private validateGrid(grid: BoardCell[][], params: GeneratorParams): boolean {
        try {
            const gameData: CreateGameDto = {
                gridSize: params.gridSize,
                gameMode: params.gameMode,
                board: grid,
                name: 'Generated',
                description: 'Auto-generated',
                state: 'public',
                owner: '',
                ownerName: '',
                imagePayload: '',
            };

            const errors = this.boardService.validateGameMapFromFrontend(gameData, false);
            if (errors.length > 0) {
                this.logger.debug(`Validation errors: ${JSON.stringify(errors)}`);
            }
            return errors.length === 0;
        } catch (error) {
            this.logger.error(`Validation exception: ${error.message}`);
            return false;
        }
    }

    private hashGrid(grid: BoardCell[][]): string {
        return JSON.stringify(grid);
    }
}
