import {
    addTileToGame,
    getValidFakeGame,
    POSITION_2,
    POSITION_3,
    POSITION_4,
    POSITION_5,
    POSITION_6,
    TILE_PERCENTAGE,
} from '@app/constants/board-service-constants';
import { Game, GameDocument, gameSchema } from '@app/model/database/game';
import { BoardService } from '@app/services/board/board.service';
import { FAKE_ID } from '@common/constants.spec';
import { GameModes, GameSizes, GameState, ItemTypes, TileTypes } from '@common/enums';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, DeleteResult, Model } from 'mongoose';

const MONGO_SETUP_TIMEOUT = 120000;

describe('BoardServiceEndToEnd', () => {
    let service: BoardService;
    let boardModel: Model<GameDocument>;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRootAsync({
                    useFactory: () => ({
                        uri: mongoServer.getUri(),
                    }),
                }),
                MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
            ],
            providers: [BoardService, { provide: Logger, useValue: mockLogger }],
        }).compile();

        service = module.get<BoardService>(BoardService);
        boardModel = module.get<Model<GameDocument>>(getModelToken(Game.name));
        connection = await module.get(getConnectionToken());
    }, MONGO_SETUP_TIMEOUT);

    afterEach(async () => {
        jest.restoreAllMocks();
        if (boardModel) {
            await boardModel.deleteMany({});
        }
    });

    afterAll(async () => {
        if (connection) {
            await connection.close();
        }
        if (mongoServer) await mongoServer.stop({ doCleanup: true });
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
        expect(boardModel).toBeDefined();
    });

    it('getGamesForManagement() returns all games visible to the user', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        const savedGame = new boardModel(game);
        await savedGame.save();
        expect((await service.getGamesForManagement('test-uid')).length).toBeGreaterThan(0);
    });

    it('getGamesForManagement() returns empty array when no games exist', async () => {
        const result = await service.getGamesForManagement('test-uid');
        expect(result).toEqual([]);
    });

    it('getGameById() returns a game with the specified _id', async () => {
        const game = getValidFakeGame(GameModes.Classic);

        const savedGame = new boardModel(game);
        await savedGame.save();

        const result = await service.getGameById(savedGame._id.toString());
        expect(result).toEqual(expect.objectContaining(game));
    });

    it('deleteGameById() deletes a game when it exists', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        const savedGame = await boardModel.create(game);

        jest.spyOn(boardModel, 'findById').mockResolvedValue(savedGame);
        jest.spyOn(boardModel, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as DeleteResult);

        await expect(service.deleteGameById(savedGame._id, 'test-uid')).resolves.toBeUndefined();
    });

    it('updateGameState() updates the state when game exists and user is owner', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        game.state = GameState.Public;
        const savedGame = await boardModel.create(game);

        jest.spyOn(boardModel, 'findById').mockResolvedValue(savedGame);
        jest.spyOn(savedGame, 'save').mockResolvedValue(savedGame);

        const updatedGame = await service.updateGameState(savedGame._id, GameState.Private, 'test-uid');
        expect(updatedGame.state).toBe(GameState.Private);
    });

    it('validateAndSaveGame should succeed if map is valid', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        await expect(service.validateAndSaveGame(game)).resolves.toBeTruthy();
    });

    it('validateAndSaveGame should succeed if flag is placed in CTF mode', async () => {
        const game = getValidFakeGame(GameModes.CTF);
        addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Default, item: { name: ItemTypes.Flag } });
        await expect(service.validateAndSaveGame(game)).resolves.toBeTruthy();
    });

    it('validateAndSaveGame should fail if flag is not placed in CTF mode', async () => {
        const game = getValidFakeGame(GameModes.CTF);
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    describe('Door Placement Tests', () => {
        it('validateAndSaveGame should fail if door is placed on edge of map', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Door });
            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should fail for a door at the top-right corner (0, gridSize-1)', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            const gridSize = game.gridSize;
            addTileToGame(game, { position: { x: 0, y: gridSize - 1 }, tile: TileTypes.Door });
            addTileToGame(game, { position: { x: 0, y: gridSize - POSITION_2 }, tile: TileTypes.Wall });
            addTileToGame(game, { position: { x: 1, y: gridSize - 1 }, tile: TileTypes.Wall });

            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should return false for an invalid gridSize', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            game.gridSize += 1;
            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should return false if door has walls around it and terrain tiles adjacent', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            addTileToGame(game, { tile: TileTypes.Door, position: { x: 1, y: 0 } });
            addTileToGame(game, { tile: TileTypes.Wall, position: { x: 1, y: 1 } });
            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should return false for a door at the bottom-right corner (gridSize-1, gridSize-1)', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            const gridSize = game.gridSize;
            addTileToGame(game, { position: { x: gridSize - 1, y: gridSize - 1 }, tile: TileTypes.Door });
            addTileToGame(game, { position: { x: gridSize - POSITION_2, y: gridSize - 1 }, tile: TileTypes.Wall });
            addTileToGame(game, { position: { x: gridSize - 1, y: gridSize - POSITION_2 }, tile: TileTypes.Wall });

            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should return false if door is placed on the top edge with non-wall tiles around', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Door });
            addTileToGame(game, { position: { x: 0, y: POSITION_3 }, tile: TileTypes.Ice });
            addTileToGame(game, { position: { x: 1, y: POSITION_4 }, tile: TileTypes.Wall });

            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should return false if door is placed on the left edge', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            addTileToGame(game, { position: { x: 0, y: 0 }, tile: TileTypes.Door });
            addTileToGame(game, { position: { x: 0, y: POSITION_5 }, tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint } });
            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('validateAndSaveGame should succeed if door is placed vertically the right way', async () => {
            let game = getValidFakeGame(GameModes.Classic);
            game = addTileToGame(game, { position: { x: 1, y: POSITION_4 }, tile: TileTypes.Door });
            game = addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Wall });
            game = addTileToGame(game, { position: { x: POSITION_2, y: POSITION_4 }, tile: TileTypes.Wall });

            await expect(service.validateAndSaveGame(game)).resolves.toBeTruthy();
        });

        it('validateAndSaveGame should fail if door is placed vertically with POSITION_3 walls around it', async () => {
            let game = getValidFakeGame(GameModes.Classic);
            game = addTileToGame(game, { position: { x: 1, y: POSITION_4 }, tile: TileTypes.Door });
            game = addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Wall });
            game = addTileToGame(game, { position: { x: POSITION_2, y: POSITION_4 }, tile: TileTypes.Wall });
            game = addTileToGame(game, { position: { x: 1, y: POSITION_3 }, tile: TileTypes.Wall });

            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('validateAndSaveGame should fail if door is placed horizontally with POSITION_3 walls around it', async () => {
            let game = getValidFakeGame(GameModes.Classic);
            game = addTileToGame(game, { position: { x: 1, y: POSITION_4 }, tile: TileTypes.Door });
            game = addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Wall });
            game = addTileToGame(game, { position: { x: 1, y: POSITION_5 }, tile: TileTypes.Wall });
            game = addTileToGame(game, { position: { x: 1, y: POSITION_3 }, tile: TileTypes.Wall });
            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('validateAndSaveGame should succeed if door is placed horizontally the right way', async () => {
            let game = getValidFakeGame(GameModes.Classic);
            game = addTileToGame(game, { position: { x: 1, y: POSITION_4 }, tile: TileTypes.Door });
            game = addTileToGame(game, { position: { x: 1, y: POSITION_5 }, tile: TileTypes.Wall });
            game = addTileToGame(game, { position: { x: 1, y: POSITION_3 }, tile: TileTypes.Wall });
            await expect(service.validateAndSaveGame(game)).resolves.toBeTruthy();
        });

        it('should return false for a door at the top-left corner (0, 0)', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            addTileToGame(game, { position: { x: 0, y: 0 }, tile: TileTypes.Door });
            addTileToGame(game, { position: { x: 0, y: 1 }, tile: TileTypes.Wall });
            addTileToGame(game, { position: { x: 1, y: 0 }, tile: TileTypes.Wall });
            addTileToGame(game, { position: { x: 0, y: POSITION_5 }, tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint } });
            addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint } });

            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });

        it('should fail for invalid grid size (1x1)', async () => {
            const game = getValidFakeGame(GameModes.Classic);
            game.gridSize = 1;
            addTileToGame(game, { position: { x: 0, y: 0 }, tile: TileTypes.Door });
            await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
        });
    });

    it('validateAndSaveGame should fail if not all the terrains are available', async () => {
        let game = getValidFakeGame(GameModes.Classic);
        game = addTileToGame(game, { position: { x: 0, y: POSITION_5 }, tile: TileTypes.Ice });
        game = addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Wall });
        game = addTileToGame(game, { position: { x: 0, y: POSITION_6 }, tile: TileTypes.Wall });
        game = addTileToGame(game, { position: { x: 1, y: POSITION_5 }, tile: TileTypes.Wall });

        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if less than 50% of the map are terrain tiles', async () => {
        let game = getValidFakeGame(GameModes.Classic);

        const totalTiles = GameSizes.Small * GameSizes.Small;
        const murTilesNeeded = Math.ceil(totalTiles * TILE_PERCENTAGE);

        let count = 0;
        for (let row = 0; row < GameSizes.Small; row++) {
            for (let col = 0; col < GameSizes.Small; col++) {
                if (count >= murTilesNeeded) break;
                game = addTileToGame(game, { position: { x: row, y: col }, tile: TileTypes.Wall });
                count++;
            }
            if (count >= murTilesNeeded) break;
        }
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if not all items have been placed', async () => {
        let game = getValidFakeGame(GameModes.Classic);
        game = addTileToGame(game, { position: { x: 0, y: POSITION_2 }, tile: TileTypes.Ice });
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if too many items have been placed', async () => {
        let game = getValidFakeGame(GameModes.Classic);
        game = addTileToGame(game, { position: { x: 0, y: POSITION_5 }, tile: TileTypes.Ice, item: { name: 'sword' } });
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if too many StartingPoints have been placed', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        addTileToGame(game, { position: { x: 0, y: POSITION_4 }, tile: TileTypes.Default, item: { name: ItemTypes.StartingPoint } });
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if not all StartingPoints have been placed', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        addTileToGame(game, { position: { x: 0, y: 0 }, tile: TileTypes.Default });
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if an item is placed on a Wall tile', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        addTileToGame(game, { position: { x: 0, y: POSITION_5 }, tile: TileTypes.Wall, item: { name: 'sword' } });
        await expect(service.validateAndSaveGame(game)).rejects.toBeTruthy();
    });

    it('validateAndSaveGame should fail if same name is used for two games', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        const game2 = game;
        await boardModel.create(game);
        await expect(service.validateAndSaveGame(game2)).rejects.toBeTruthy();
    });

    it('modifyGame should succeed if a game is updated with a valid game', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        const updatedGame = game;
        const savedGame = await boardModel.create(game);
        await expect(service.modifyGame(savedGame._id, updatedGame, 'test-uid')).resolves.toBeTruthy();
    });
    it('modifyGame should fail if validation errors are returned', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        const updatedGame = addTileToGame(game, { position: { x: 0, y: 0 }, tile: TileTypes.Ice });
        const savedGame = await boardModel.create(game);

        jest.spyOn(service, 'validateGameMapFromFrontend').mockReturnValue(['Pas tous les points de departs ont ete placees']);

        await expect(service.modifyGame(savedGame._id, updatedGame, 'test-uid')).rejects.toThrowError(
            new HttpException(['Pas tous les points de departs ont ete placees'], HttpStatus.BAD_REQUEST),
        );
    });

    it('modifyGame should fail if a game is updated with a non-valid game', async () => {
        const game = getValidFakeGame(GameModes.Classic);
        const updatedGame = addTileToGame(game, { position: { x: 0, y: 0 }, tile: TileTypes.Ice });
        const savedGame = await boardModel.create(game);
        await expect(service.modifyGame(savedGame._id, updatedGame, 'test-uid')).rejects.toBeTruthy();
    });

    it('should save a new game if the game is not found (i.e., deleted)', async () => {
        const updatedGame = getValidFakeGame(GameModes.Classic);

        jest.spyOn(boardModel, 'findById').mockResolvedValue(null);
        jest.spyOn(boardModel, 'findOneAndUpdate').mockResolvedValue(null);
        const saveMock = jest.spyOn(boardModel.prototype, 'save').mockResolvedValue(updatedGame);

        await service.modifyGame(FAKE_ID, updatedGame, 'test-uid');

        expect(saveMock).toHaveBeenCalled();
    });
});
