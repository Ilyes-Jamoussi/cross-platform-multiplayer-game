import { BOARD_MESSAGES } from '@app/constants/messages';
import { currentUser } from '@app/decorators/current-user.decorator';
import { AuthGuard } from '@app/guards/auth.guard';
import { UserDocument } from '@app/model/database/user';
import { CreateGameDto } from '@app/model/dto/create-game.dto';
import { BoardGeneratorService, GeneratorParams } from '@app/services/board-generator/board-generator.service';
import { BoardService } from '@app/services/board/board.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { StartGameService } from '@app/services/start-game/start-game.service';
import { Grid } from '@common/interfaces';
import { Body, Controller, Delete, Get, HttpStatus, Logger, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Mutex } from 'async-mutex';
import { Response } from 'express';

@Controller('game')
export class BoardController {
    private readonly mutex = new Mutex();
    constructor(
        private readonly logger: Logger,
        private readonly boardService: BoardService,
        private readonly boardGeneratorService: BoardGeneratorService,
        private readonly startGameService: StartGameService,
        private readonly gameRoomService: GameRoomService,
    ) {}

    @Get()
    @UseGuards(AuthGuard)
    async getAllGames(@currentUser() user: UserDocument, @Query('context') context: string, @Res() response: Response): Promise<void> {
        try {
            const games =
                context === 'creation'
                    ? await this.boardService.getGamesForCreation(user.firebaseUid)
                    : await this.boardService.getGamesForManagement(user.firebaseUid);
            response.status(HttpStatus.OK).json(games);
        } catch (error) {
            this.logger.error('Erreur lors de la récupération des jeux');
            response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(BOARD_MESSAGES.internalError);
        }
    }

    @Post('/start')
    async startGame(@Body('roomId') roomId: string, @Res() response: Response): Promise<void> {
        await this.mutex.runExclusive(async () => {
            const room = this.gameRoomService.rooms.get(roomId);
            if (room && room.map) {
                response.status(HttpStatus.OK).json({
                    map: room.map,
                    teams: room.teams,
                    gameMode: room.map.gameMode,
                    lobbyGameMode: room.lobbyGameMode,
                    isFogOfWar: room.isFogOfWar,
                    isDropInDropOut: room.dropInDropOutEnabled,
                });
            } else {
                try {
                    this.logger.log(`Initialized game for room: ${roomId}`);
                    room.map = (await this.startGameService.placePlayersOnStartingPoints(roomId)) as Grid;
                    this.gameRoomService.notifyPublicRoomsChanged();
                    response.status(HttpStatus.OK).json({
                        map: room.map,
                        teams: room.teams,
                        gameMode: room.map.gameMode,
                        lobbyGameMode: room.lobbyGameMode,
                        isFogOfWar: room.isFogOfWar,
                        isDropInDropOut: room.dropInDropOutEnabled,
                    });
                } catch (error) {
                    response.status(HttpStatus.NOT_FOUND).send(BOARD_MESSAGES.mapNotFound);
                }
            }
        });
    }

    @Get(':id')
    async getGame(@Param('id') id: string, @Res() response: Response): Promise<void> {
        try {
            const game = await this.boardService.getGameById(id);
            if (game) {
                response.status(HttpStatus.OK).json(game);
            }
        } catch (error) {
            this.logger.error(`Erreur lors de la récupération du jeu: ${id}`);
            response.status(HttpStatus.NOT_FOUND).send(BOARD_MESSAGES.gameNotFound);
        }
    }

    @Post()
    @UseGuards(AuthGuard)
    async validateGameMap(@currentUser() user: UserDocument, @Body() gameData: CreateGameDto, @Res() response: Response): Promise<void> {
        try {
            gameData.owner = user.firebaseUid;
            gameData.ownerName = user.username;
            if (!gameData.state) {
                gameData.state = 'public';
            }
            if (!gameData.nbActions) {
                gameData.nbActions = 1;
            }

            const errors = await this.boardService.validateAndSaveGame(gameData);
            if (errors.length > 0) {
                this.logger.error('Erreur lors de la validation de la map');
                throw new Error(BOARD_MESSAGES.validationErrors);
            }

            response.status(HttpStatus.CREATED).json(errors);
        } catch (error) {
            this.logger.error('Erreur lors de la validation de la map');
            response.status(HttpStatus.BAD_REQUEST).send(BOARD_MESSAGES.gameNotConform);
        }
    }

    @Post('duplicate/:id')
    @UseGuards(AuthGuard)
    async duplicateGame(@currentUser() user: UserDocument, @Param('id') id: string, @Res() response: Response): Promise<void> {
        try {
            const duplicate = await this.boardService.duplicateGame(id, user.firebaseUid, user.username);
            response.status(HttpStatus.CREATED).json(duplicate);
        } catch (error) {
            this.logger.error(`Erreur lors de la duplication du jeu: ${id}`);
            if (error.status) {
                response.status(error.status).send(error.message);
            } else {
                response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(BOARD_MESSAGES.internalError);
            }
        }
    }

    @Post('generate')
    async generateGrid(@Body() params: GeneratorParams, @Res() response: Response): Promise<void> {
        try {
            this.logger.log('Génération de grille demandée');
            const grid = this.boardGeneratorService.generateGrid(params);
            response.status(HttpStatus.OK).json(grid);
        } catch (error) {
            this.logger.error('Erreur lors de la génération de la grille', error);
            response.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Erreur lors de la génération');
        }
    }

    @Patch('state/:id')
    @UseGuards(AuthGuard)
    async updateState(
        @currentUser() user: UserDocument,
        @Param('id') id: string,
        @Body('state') newState: string,
        @Res() response: Response,
    ): Promise<void> {
        try {
            const game = await this.boardService.updateGameState(id, newState, user.firebaseUid);
            response.status(HttpStatus.OK).json(game);
        } catch (error) {
            this.logger.error(`Erreur lors du changement d'état du jeu: ${id}`);
            if (error.status) {
                response.status(error.status).send(error.message);
            } else {
                response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(BOARD_MESSAGES.internalError);
            }
        }
    }

    @Patch(':id')
    @UseGuards(AuthGuard)
    async editingGame(
        @currentUser() user: UserDocument,
        @Body() gameData: CreateGameDto,
        @Param('id') id: string,
        @Res() response: Response,
    ): Promise<void> {
        try {
            this.logger.log(`Modification du jeu: ${id}`);
            const result = await this.boardService.modifyGame(id, gameData, user.firebaseUid);
            response.status(HttpStatus.OK).json(result);
        } catch (error) {
            this.logger.error(`Erreur de modification pour le jeu avec ID: ${id}`);
            if (error.status) {
                response.status(error.status).send(error.message);
            } else {
                response.status(HttpStatus.NOT_FOUND).send(BOARD_MESSAGES.gameNotFound);
            }
        }
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    async deleteGame(@currentUser() user: UserDocument, @Param('id') id: string, @Res() response: Response): Promise<void> {
        try {
            await this.boardService.deleteGameById(id, user.firebaseUid);
            response.status(HttpStatus.NO_CONTENT).send();
        } catch (error) {
            this.logger.error(`Erreur lors de la deletion du jeu: ${id}`);
            if (error.status) {
                response.status(error.status).send(error.message);
            } else {
                response.status(HttpStatus.NOT_FOUND).send(BOARD_MESSAGES.gameNotFound);
            }
        }
    }
}
