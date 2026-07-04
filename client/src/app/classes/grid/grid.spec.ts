import { GameModes, GameSizes, TileTypes } from '@common/enums';
import { BoardCell } from '@common/interfaces';
import { GridGame } from '@app/classes/grid/grid';
import { GAME_DATA } from '@common/constants.spec';

describe('GridGame', () => {
    describe('Getters and Setters', () => {
        let gridGame: GridGame;
        const mockGrid: BoardCell[][] = GAME_DATA.board;

        beforeEach(() => {
            gridGame = new GridGame(GameSizes.Medium, GameModes.Classic);
        });

        it('should get and set the grid', () => {
            expect(gridGame.grid).toBeDefined();
            expect(gridGame.grid.length).toBe(GameSizes.Medium);
            gridGame.grid = mockGrid;
            expect(gridGame.grid).toEqual(mockGrid);
        });

        it('should get and set the size', () => {
            expect(gridGame.size).toBe(GameSizes.Medium);

            const newSize = 10;
            gridGame.size = newSize;
            expect(gridGame.size).toBe(newSize);
        });

        it('should get and set the game mode', () => {
            expect(gridGame.gameMode).toBe(GameModes.Classic);

            const newGameMode = GameModes.CTF;
            gridGame.gameMode = newGameMode;
            expect(gridGame.gameMode).toBe(newGameMode);
        });

        it('should initialize grid with correct size when constructed with GameSizes', () => {
            const smallGridGame = new GridGame(GameSizes.Small, GameModes.Classic);
            expect(smallGridGame.grid.length).toBe(GameSizes.Small);
            expect(smallGridGame.grid[0].length).toBe(GameSizes.Small);

            const largeGridGame = new GridGame(GameSizes.Big, GameModes.Classic);
            expect(largeGridGame.grid.length).toBe(GameSizes.Big);
            expect(largeGridGame.grid[0].length).toBe(GameSizes.Big);
        });

        it('should use provided grid when constructed with BoardCell[][]', () => {
            const customGridGame = new GridGame(mockGrid, GameModes.Classic);
            expect(customGridGame.grid).toEqual(mockGrid);
            expect(customGridGame.size).toBe(mockGrid.length);
        });
    });

    describe('initializeGrid', () => {
        it('should initialize grid with default values', () => {
            const gridGame = new GridGame(GameSizes.Big, GameModes.Classic);

            const expectedCell = {
                tile: TileTypes.Default,
                item: { name: '', description: '' },
            };

            for (const row of gridGame.grid) {
                for (const cell of row) {
                    expect(cell).toEqual(expectedCell);
                }
            }
        });
    });
});
