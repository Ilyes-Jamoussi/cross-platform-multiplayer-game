import { BoardController } from '@app/controllers/board/board.controller';
import { GameRoomController } from '@app/controllers/game-room/game-room.controller';
import { AuthController } from '@app/controllers/auth/auth.controller';
import { GameChatGateway } from '@app/gateways/game-chat/game-chat.gateway';
import { GameLogicGateway } from '@app/gateways/game-logic/game-logic.gateway';
import { GameModeGateway } from '@app/gateways/game-mode/game-mode.gateway';
import { GameRoomGateway } from '@app/gateways/game-room/game-room.gateway';
import { ItemGateway } from '@app/gateways/items/items.gateway';
import { TimerGateway } from '@app/gateways/timer/timer.gateway';
import { Game, gameSchema } from '@app/model/database/game';
import { User, userSchema } from '@app/model/database/user';
import { AuthService } from '@app/services/auth/auth.service';
import { AuthGuard } from '@app/guards/auth.guard';
import { BoardService } from '@app/services/board/board.service';
import { BoardGeneratorService } from '@app/services/board-generator/board-generator.service';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { DebugService } from '@app/services/debug/debug-service.service';
import { EndGameService } from '@app/services/end-game/end-game.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ItemService } from '@app/services/items/items.service';
import { MovementService } from '@app/services/movement-logic/movement-logic.service';
import { StartGameService } from '@app/services/start-game/start-game.service';
import { TimerService } from '@app/services/time/time.service';
import { TurnService } from '@app/services/turns/turn-service';
import { VirtualMovementService } from '@app/services/virtual-player/virtual-movement-service/virtual-player-movement.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { VirtualCurrencyGateway } from '@app/gateways/virtual-currency/virtual-currency.gateway';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalChannelGateway } from './gateways/chat-channel/global-channel.gateway';
import { CustomChannelGateway } from './gateways/chat-channel/custom-channel.gateway';
import { ChatChannelService } from './services/chat-channel/chat-channel.service';
import { ChatChannel, chatChannelSchema, ChatChannelMessage, chatChannelMessageSchema } from '@app/model/database/chat-channel';
import { FriendsGateway } from './gateways/friends/friends.gateway';
import { FriendsService } from './services/friends/friends.service';
import { FriendsController } from '@app/controllers/friends/friends.controller';
import { HealthController } from '@app/controllers/health/health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '.env.local'],
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        MongooseModule.forFeature([
            { name: Game.name, schema: gameSchema },
            { name: User.name, schema: userSchema },
            { name: ChatChannel.name, schema: chatChannelSchema },
            { name: ChatChannelMessage.name, schema: chatChannelMessageSchema },
        ]),
    ],
    controllers: [BoardController, GameRoomController, AuthController, FriendsController, HealthController],
    providers: [
        BoardService,
        BoardGeneratorService,
        Logger,
        GameRoomGateway,
        GameRoomService,
        StartGameService,
        GameLogicGateway,
        GameModeGateway,
        GameChatGateway,
        TimerService,
        TimerGateway,
        CombatService,
        TurnService,
        DebugService,
        MovementService,
        EndGameService,
        VirtualPlayerService,
        ItemGateway,
        GameModeService,
        ItemService,
        VirtualMovementService,
        GameLogicService,
        AuthService,
        AuthGuard,
        ChatChannelService,
        GlobalChannelGateway,
        CustomChannelGateway,
        FriendsService,
        FriendsGateway,
        VirtualCurrencyService,
        VirtualCurrencyGateway,
    ],
})
export class AppModule {}
