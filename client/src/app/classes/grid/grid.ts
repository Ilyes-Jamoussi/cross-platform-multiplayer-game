import { GameModes, GameSizes, TileTypes } from '@common/enums';
import { BoardCell } from '@common/interfaces';

export class GridGame {
    private _grid: BoardCell[][];
    private _gameMode: GameModes;
    private _size: number;

    constructor(mapSizeOrGrid: GameSizes | BoardCell[][], gameMode: GameModes) {
        if (Object.values(GameSizes).includes(mapSizeOrGrid as GameSizes)) {
            this._size = mapSizeOrGrid as GameSizes;
            this._grid = this.initializeGrid();
        } else {
            this._size = (mapSizeOrGrid as BoardCell[][]).length;
            this._grid = mapSizeOrGrid as BoardCell[][];
        }
        this._gameMode = gameMode;
    }

    get grid(): BoardCell[][] {
        return this._grid;
    }
    get size(): number {
        return this._size;
    }
    get gameMode(): GameModes {
        return this._gameMode;
    }
    set gameMode(newGameMode: GameModes) {
        this._gameMode = newGameMode;
    }
    set size(size: number) {
        this._size = size;
    }
    set grid(newGrid: BoardCell[][]) {
        this._grid = newGrid;
    }

    private initializeGrid(): BoardCell[][] {
        return Array.from({ length: this._size }, () =>
            Array.from({ length: this._size }, () => ({
                tile: TileTypes.Default,
                item: { name: '', description: '' },
            })),
        );
    }
}
