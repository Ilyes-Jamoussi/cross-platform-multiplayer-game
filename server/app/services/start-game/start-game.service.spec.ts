import { MOCK_ROOM_ID, MOCK_ROOMS } from '@app/constants/test-consts';
import { BoardService } from '@app/services/board/board.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { GAME_DATA } from '@common/constants.spec';
import { ItemCategory, ItemTypes, TileTypes } from '@common/enums';
import * as sharedUtils from '@common/shared-utils';
import { Test, TestingModule } from '@nestjs/testing';
import { StartGameService } from './start-game.service';

describe('StartGameService', () => {
    let service: StartGameService;
    let gameRoom: GameRoomService;
    let boardService: BoardService;

    beforeEach(async () => {
        gameRoom = {
            rooms: MOCK_ROOMS,
            getRoom: jest.fn((id: string) => MOCK_ROOMS.get(id)),
            setStartingPoints: jest.fn(),
        } as unknown as GameRoomService;

        boardService = {
            getGameById: jest.fn(),
        } as unknown as BoardService;

        jest.spyOn(sharedUtils, 'shuffleArray').mockImplementation((arr) => arr);

        const module: TestingModule = await Test.createTestingModule({
            providers: [StartGameService, { provide: GameRoomService, useValue: gameRoom }, { provide: BoardService, useValue: boardService }],
        }).compile();

        service = module.get<StartGameService>(StartGameService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should retrieve game correctly', async () => {
        const game = GAME_DATA;
        boardService.getGameById = jest.fn().mockResolvedValue(game);

        const result = await service.getGame(MOCK_ROOM_ID);
        expect(result).toEqual(game);
    });

    it('should place random items correctly based on Random category', async () => {
        const game = { ...GAME_DATA };
        game.board = [
            [
                {
                    tile: TileTypes.Default,
                    item: { name: 'item-7', description: ItemCategory.Random },
                    position: { x: 0, y: 0 },
                },
                {
                    tile: TileTypes.Default,
                    item: { name: 'item-7', description: ItemCategory.Random },
                    position: { x: 0, y: 0 },
                },
                {
                    tile: TileTypes.Default,
                    item: { name: 'item-1-Potion', description: 'Vous donne +2 Vies et -1 défense' },
                    position: { x: 0, y: 0 },
                },
            ],
        ];

        const MOCK_PLAYERS = [
            { id: '1', name: 'Player1' },
            { id: '2', name: 'Player2' },
        ];

        boardService.getGameById = jest.fn().mockResolvedValue(game);
        gameRoom.rooms.get = jest.fn().mockReturnValue({ players: MOCK_PLAYERS });

        const availableItemIds = ['item-3-Bouclier', 'item-4-Poison'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'getAvailableItemIds').mockReturnValue(availableItemIds);

        await service.placePlayersOnStartingPoints(MOCK_ROOM_ID);

        expect(game.board[0][0].item.name).toBe(availableItemIds[0]);

        expect(game.board[0][1].item.name).toBe(availableItemIds[1]);

        expect(game.board[0][2].item.name).toBe('item-1-Potion');
        expect(game.board[0][2].item.description).toBe('Vous donne +2 Vies et -1 défense');
    });

    it('should place players on starting points and remove unused ones', async () => {
        const game = { ...GAME_DATA };
        game.board = [
            [
                { tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint, description: 'hello' }, position: { x: 0, y: 0 } },
                { tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint, description: 'hello' }, position: { x: 0, y: 0 } },
                { tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint, description: 'hello' }, position: { x: 0, y: 0 } },
            ],
        ];
        boardService.getGameById = jest.fn().mockResolvedValue(game);

        const MOCK_PLAYERS = [
            { id: '1', name: 'Player1' },
            { id: '2', name: 'Player2' },
        ];
        gameRoom.rooms.get = jest.fn().mockReturnValue({ players: MOCK_PLAYERS });
        await service.placePlayersOnStartingPoints(MOCK_ROOM_ID);

        expect(gameRoom.setStartingPoints).toHaveBeenCalledTimes(2);
        expect(gameRoom.setStartingPoints).toHaveBeenCalledWith(
            MOCK_ROOM_ID,
            expect.objectContaining({ x: 0, y: 0 }),
            expect.objectContaining(MOCK_PLAYERS[0]),
        );
        expect(gameRoom.setStartingPoints).toHaveBeenCalledWith(
            MOCK_ROOM_ID,
            expect.objectContaining({ x: 0, y: 1 }),
            expect.objectContaining(MOCK_PLAYERS[1]),
        );

        expect(game.board[0][2].item.name).toBe(ItemTypes.UnusedStartingPoint);
        expect(game.board[0][2].item.description).toBe('');
    });
});
