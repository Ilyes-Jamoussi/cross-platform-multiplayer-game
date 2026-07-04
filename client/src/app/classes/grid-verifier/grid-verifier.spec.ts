import { TestBed } from '@angular/core/testing';
import { GridVerifier } from '@app/classes/grid-verifier/grid-verifier';
import { GridGame } from '@app/classes/grid/grid';
import { GameModes, GameSizes, ItemTypes, TileTypes } from '@common/enums';

describe('GridVerifier', () => {
    let game: GridGame;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [GridVerifier],
        });
        game = new GridGame(GameSizes.Small, GameModes.Classic);

        game.grid[0][0].item.name = ItemTypes.StartingPoint;
        game.grid[0][1].item.name = ItemTypes.StartingPoint;
        game.grid[0][2].item.name = ItemTypes.Item;
        game.grid[0][3].item.name = ItemTypes.Item;
    });

    describe('validateGameMapFromFrontend', () => {
        it('should return no errors for a valid game map', () => {
            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors).toEqual([]);
        });

        it('should return an error if terrain percentage is less than 50%', () => {
            for (const row of game.grid) {
                for (const col of row) {
                    col.tile = TileTypes.Wall;
                }
            }

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.low_terrain_coverage')).toBeTrue();
        });

        it('should return an error if not all items are placed', () => {
            game.grid[0][3].item.name = '';

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.not_enough_items')).toBeTrue();
        });

        it('should return an error if the tiles are not valid in door placement validation', () => {
            expect(GridVerifier['isDoorValid'](game.grid, game.grid.length + 1, game.grid.length + 1)).toBe(false);
        });

        it('should return an error if not all starting points are placed', () => {
            game.grid[0][1].item.name = '';

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.missing_starting_points')).toBeTrue();
        });

        it('should return an error if the flag is not placed in CTF mode', () => {
            game.gameMode = GameModes.CTF;
            game.grid[2][3].item.name = '';

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.missing_flag')).toBeTrue();
        });

        it('should return an error if items are placed on wall tiles', () => {
            game.grid[0][0].tile = TileTypes.Wall;

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.items_on_wall')).toBeTrue();
        });

        describe('areDoorsValid', () => {
            it('should validate a horizontally valid door', () => {
                game.grid[1][1].tile = TileTypes.Door;
                game.grid[1][0].tile = TileTypes.Wall;
                game.grid[1][2].tile = TileTypes.Wall;
                expect(GridVerifier['areDoorsValid'](game)).toBeTrue();
            });

            it('should valide a vertically valid door', () => {
                game.grid[1][1].tile = TileTypes.Door;
                game.grid[0][1].tile = TileTypes.Wall;
                game.grid[2][1].tile = TileTypes.Wall;
                expect(GridVerifier['areDoorsValid'](game)).toBeTrue();
            });
        });

        it('should return an error if door is on the edge of the board', () => {
            game.grid[0][0].tile = TileTypes.Door;

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.invalid_door')).toBeTrue();
        });

        it('should return an error if door has walls on both its axes', () => {
            game.grid[1][0].tile = TileTypes.Door;
            game.grid[1][1].tile = TileTypes.Door;
            game.grid[1][2].tile = TileTypes.Wall;
            game.grid[0][1].tile = TileTypes.Door;
            game.grid[2][1].tile = TileTypes.Door;

            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.invalid_door')).toBeTrue();
        });
    });

    describe('calculateTerrainPercentage', () => {
        it('should return 100% if all tiles are terrain', () => {
            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors).toEqual([]);
        });
    });

    describe('areTerrainsAccessible', () => {
        it('should return no errors if all terrains are accessible', () => {
            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors).toEqual([]);
        });

        it('should return an error if not all terrains are accessible', () => {
            game.grid[9][9].tile = TileTypes.Ice;
            game.grid[9][8].tile = TileTypes.Wall;
            game.grid[8][9].tile = TileTypes.Wall;
            game.grid[8][8].tile = TileTypes.Wall;
            const errors = GridVerifier.validateGameMapFromFrontend(game);
            expect(errors.some((e) => e.key === 'validation.inaccessible_tiles')).toBeTrue();
        });
    });
});
