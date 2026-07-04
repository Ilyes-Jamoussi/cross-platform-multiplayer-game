import { Injectable } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CTFEvents } from '@common/gateway-events';
import { FlagTakenPayload, SocketPayload } from '@common/interfaces';
import { GameModeService } from '@app/services/game-mode/game-mode.service';

@WebSocketGateway({ cors: true })
@Injectable()
export class GameModeGateway {
    @WebSocketServer()
    private readonly _server: Server;

    constructor(private readonly gameModeService: GameModeService) {}

    @SubscribeMessage(CTFEvents.FlagTaken)
    handleFlagTaken(@MessageBody() payload: FlagTakenPayload): void {
        const player = this.gameModeService.flagTaken(payload);
        this._server.to(payload.roomId).emit(CTFEvents.FlagTaken, { flagHolder: player });
    }

    @SubscribeMessage(CTFEvents.FlagDropped)
    handleFlagDropped(@MessageBody() payload: SocketPayload): void {
        this.gameModeService.flagDropped(payload.roomId);
        this._server.to(payload.roomId).emit(CTFEvents.FlagDropped);
    }
}
