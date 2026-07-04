import { GAME_ROOM_MESSAGES } from '@app/constants/messages';
import { currentUser } from '@app/decorators/current-user.decorator';
import { AuthGuard } from '@app/guards/auth.guard';
import { UserDocument } from '@app/model/database/user';
import { AuthService } from '@app/services/auth/auth.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { LobbyGameMode, PlayerState } from '@common/enums';
import { CreateGameResponse, Player, SelectAvatarPayload } from '@common/interfaces';
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Param, Post, UseGuards } from '@nestjs/common';

@Controller('game-room')
export class GameRoomController {
    constructor(
        private readonly gameRoomService: GameRoomService,
        private readonly authService: AuthService,
        private readonly logger: Logger,
    ) {}

    @Post('create')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AuthGuard)
    async createRoom(@currentUser() user: UserDocument, @Body() body: { gameId: string; entryFee?: number }): Promise<CreateGameResponse> {
        try {
            const entryFee = body.entryFee ?? 0;

            if (entryFee < 0) {
                throw new HttpException('server_msg.negative_entry_fee', HttpStatus.BAD_REQUEST);
            }

            const roomId = await this.gameRoomService.createGameRoom(body.gameId, user.firebaseUid, entryFee);

            this.logger.log(`New room created: ${roomId} for game ${body.gameId} by user ${user.firebaseUid} with entry fee ${entryFee}`);

            return { roomId };
        } catch (error) {
            this.logger.error(`Failed to create room for game ${body.gameId}`, error.stack);
            throw new HttpException(GAME_ROOM_MESSAGES.createRoomError, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    @Get('validate/:roomId')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard)
    validateCode(@currentUser() user: UserDocument, @Param('roomId') roomId: string) {
        if (this.gameRoomService.hasRoom(roomId)) {
            const canReconnectToStartedGame = this.gameRoomService.canReconnectToStartedGame(roomId, user.firebaseUid);
            const isStarted = this.gameRoomService.hasStarted(roomId);

            // For started games, let websocket join logic decide between reconnect and lock denial.
            if (this.gameRoomService.isLocked(roomId) && !canReconnectToStartedGame && !isStarted) {
                throw new HttpException({ message: GAME_ROOM_MESSAGES.roomNotFound }, HttpStatus.FORBIDDEN);
            }
            return;
        } else {
            throw new HttpException({ message: GAME_ROOM_MESSAGES.roomNotFound }, HttpStatus.NOT_FOUND);
        }
    }
    @Post('selectAvatar')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AuthGuard)
    async selectAvatar(@currentUser() user: UserDocument, @Body() payload: SelectAvatarPayload) {
        const result = await this.gameRoomService.selectAvatar(payload.roomId, payload.player, user.firebaseUid);
        if (result && typeof result === 'object' && 'error' in result) {
            throw new HttpException(result.error, HttpStatus.BAD_REQUEST);
        }

        const hasStarted = this.gameRoomService.hasStarted(payload.roomId);
        const room = this.gameRoomService.getRoom(payload.roomId);
        const returnedPlayer = result as Player;
        const isObserverReconnect = !!returnedPlayer && (returnedPlayer.state === PlayerState.ELIMINATED || !!returnedPlayer.isSpectator);
        const isFastElimDropIn = hasStarted && room?.lobbyGameMode === LobbyGameMode.FastElimination && !isObserverReconnect;
        const isClassicDropIn = this.gameRoomService.isDropInDropOut(payload.roomId) && hasStarted;
        const isDropIn = isClassicDropIn || isFastElimDropIn;
        let isDropInSuccess = false;
        if (isDropIn) {
            isDropInSuccess = await this.gameRoomService.dropInPlayer(payload.roomId, payload.player);
        }

        this.gameRoomService.notifyPublicRoomsChanged();
        return { player: result, isDropIn, isDropInSuccess };
    }

    @Get(':roomId/players')
    @HttpCode(HttpStatus.OK)
    getPlayers(@Param('roomId') roomId: string) {
        try {
            return this.gameRoomService.getPlayers(roomId);
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.NOT_FOUND);
        }
    }

    @Get(':roomId/player-state')
    @HttpCode(HttpStatus.OK)
    getPlayerState(@Param('roomId') roomId: string) {
        try {
            const room = this.gameRoomService.getRoom(roomId);
            return {
                players: room.players,
                disconnectedPlayers: room.disconnectedPlayers ?? [],
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.NOT_FOUND);
        }
    }

    @Get(':roomId/data')
    @HttpCode(HttpStatus.OK)
    getRoomData(@Param('roomId') roomId: string) {
        try {
            const room = this.gameRoomService.getRoom(roomId);
            return room;
        } catch (error) {
            throw new HttpException('Partie introuvable', HttpStatus.NOT_FOUND);
        }
    }

    @Get('public')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard)
    getPublicRooms(@currentUser() user: UserDocument) {
        Logger.log('fetching public games');
        return this.gameRoomService.getPublicRooms(user?.firebaseUid);
    }

    @Post('leaveRoom')
    @HttpCode(HttpStatus.OK)
    leaveRoom(@Body() body: { roomId: string }) {
        const roomId = body.roomId;
        const room = this.gameRoomService.getRoom(roomId);
        if (!room) return;
        if (!room.players || room.players.length === 0) {
            this.gameRoomService.removeRoom(body.roomId);
        }
    }
}
