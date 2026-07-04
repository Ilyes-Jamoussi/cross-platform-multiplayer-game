import { ADJACENT_POSITIONS, EXTENDED_DIRECTIONS, ITEM_IMAGE_MAP, ITEM_VALID_TERRAINS, VALID_TERRAINS } from './constants';
import { Directions, ItemId, TileTypes } from './enums';
import { BoardCell, Item, Neighbor, Path, PathfindingResult, QueueItem } from './interfaces';
import { Position } from './types';

export const DIRECTIONS: [number, number][] = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
];

export const newDate = () => {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
};

export const isValidMove = (position: Position, board: BoardCell[][], visitedCells: Set<string>, validTerrains: Set<TileTypes>): boolean => {
    const { x, y } = position;
    return isInBoardBounds(position, board.length) && validTerrains.has(board[x][y]?.tile as TileTypes) && !visitedCells.has(`${x},${y}`);
};

export const isInBoardBounds = (pos: Position, gridSize: number): boolean => {
    return pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize;
};

export const generateUniqueItemId = (baseId: string, grid: BoardCell[][]): string => {
    const items: string[] = [];
    for (const row of grid) {
        for (const tile of row) {
            if (tile.item.name.includes(baseId)) {
                items.push(tile.item.name);
            }
        }
    }

    let suffix = 'A';
    while (items.includes(baseId + suffix)) {
        suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
        if (suffix > 'Z') {
            suffix = 'A' + (parseInt(suffix.slice(1) || '0', 10) + 1);
        }
    }
    return baseId + suffix;
};

export const dfs = (position: Position, board: BoardCell[][], visitedCells: Set<string>): void => {
    const { x, y } = position;
    visitedCells.add(`${x},${y}`);

    for (const [dx, dy] of DIRECTIONS) {
        const newX = x + dx;
        const newY = y + dy;

        if (isValidMove({ x: newX, y: newY }, board, visitedCells, VALID_TERRAINS)) {
            dfs({ x: newX, y: newY }, board, visitedCells);
        }
    }
};
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
export const resolveItemImage = (id: string): string => {
    if (ITEM_IMAGE_MAP[id as ItemId]) return ITEM_IMAGE_MAP[id as ItemId];
    for (const itemId of Object.values(ItemId)) {
        if (id.includes(itemId)) return ITEM_IMAGE_MAP[itemId];
    }
    return '';
};

export const createItem = (id: ItemId, tooltip: string): Item => {
    return {
        id,
        image: resolveItemImage(id),
        tooltip,
        selected: false,
        uniqueId: generateUUID(),
    };
};

export const findAvailableTerrainForItem = (position: Position, map: BoardCell[][]): Position[] => {
    const availablePositions: Position[] = [];

    for (const dir of ADJACENT_POSITIONS) {
        const newX = position.x + dir.x;
        const newY = position.y + dir.y;

        if (isValidPositionForItem({ x: newX, y: newY }, map)) {
            availablePositions.push({ x: newX, y: newY });
        }
    }

    for (const dir of EXTENDED_DIRECTIONS) {
        if (availablePositions.length >= 2) break;

        const newX = position.x + dir.x;
        const newY = position.y + dir.y;

        if (isValidPositionForItem({ x: newX, y: newY }, map)) {
            availablePositions.push({ x: newX, y: newY });
        }
    }

    return shuffleArray(availablePositions);
};

export const shuffleArray = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const isValidPositionForItem = (position: Position, map: BoardCell[][]): boolean =>
    isInBoardBounds(position, map.length) &&
    ITEM_VALID_TERRAINS.has(map[position.x][position.y].tile) &&
    map[position.x][position.y].item.name === '' &&
    !map[position.x][position.y].player;

export const getBestPath = (allPaths: Path[], reachableTiles: Position[]): PathfindingResult => {
    if (allPaths.length > 0) {
        allPaths.sort((a, b) => a.cost - b.cost || a.positions.length - b.positions.length || a.turns - b.turns);
        return { path: allPaths[0], reachableTiles };
    }
    return { reachableTiles };
};

export const getNeighbors = (position: Position): Neighbor[] => {
    return [
        { position: { x: position.x + 1, y: position.y }, direction: Directions.Right },
        { position: { x: position.x - 1, y: position.y }, direction: Directions.Left },
        { position: { x: position.x, y: position.y + 1 }, direction: Directions.Up },
        { position: { x: position.x, y: position.y - 1 }, direction: Directions.Down },
    ];
};

export const getNextTile = (queue: QueueItem[]): QueueItem | undefined => {
    queue.sort((a, b) => a.cost - b.cost || a.path.positions.length - b.path.positions.length || a.turns - b.turns);
    return queue.shift();
};
