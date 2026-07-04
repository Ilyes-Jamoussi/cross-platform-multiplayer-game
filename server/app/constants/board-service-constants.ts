import { CreateGameDto } from '@app/model/dto/create-game.dto';
import { ItemTypes, TileTypes, GameSizes } from '@common/enums';
import { BoardCell } from '@common/interfaces';
import { Position } from '@common/types';

export interface TestBoardCell {
    tile: TileTypes;
    item?: { name: string; description?: string };
    position?: Position;
}

export const getValidFakeGame = (gameMode: string): CreateGameDto => {
    const gridSize = GameSizes.Small;
    const board: BoardCell[][] = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => ({
            tile: TileTypes.Default,
            item: { name: '', description: '' },
        })),
    );
    board[0][0].item.name = ItemTypes.StartingPoint;
    board[0][1].item.name = ItemTypes.StartingPoint;
    board[0][2].item.name = 'Sword';
    board[0][3].item.name = 'Potion';

    return {
        name: getRandomString(),
        description: getRandomString(),
        gameMode,
        state: 'public',
        owner: 'test-uid',
        ownerName: 'test-user',
        gridSize,
        nbActions: 1,
        imagePayload: getRandomString(),
        lastModified: new Date().toISOString(),
        board,
    };
};

export const addTileToGame = (game: CreateGameDto, cell: TestBoardCell): CreateGameDto => {
    const position = cell.position;
    const rowNumber = position.x;
    const colNumber = position.y;

    game.board[rowNumber][colNumber] = {
        tile: cell.tile,
        ...(cell.item?.name ? { item: { name: cell.item.name, description: '' } } : { item: { name: '', description: '' } }),
    };

    return game;
};

export const BASE_36 = 36;
export const TILE_PERCENTAGE = 0.51;
export const POSITION_4 = 4;
export const POSITION_5 = 5;
export const POSITION_3 = 3;
export const POSITION_2 = 2;
export const POSITION_6 = 6;
const getRandomString = (): string => (Math.random() + 1).toString(BASE_36).substring(2);
