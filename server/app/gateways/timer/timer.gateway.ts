import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TimerService } from '@app/services/time/time.service';
import { TimerEvents } from '@common/gateway-events';
import { TimerInfo } from '@common/interfaces';
import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class TimerGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly timerService: TimerService,
        private readonly gameRoomService: GameRoomService,
    ) {}

    @SubscribeMessage(TimerEvents.StartTimer)
    handleStartTimer(client: Socket, data: TimerInfo) {
        this.timerService.startTimer(data, this.server);
    }

    @SubscribeMessage(TimerEvents.StopTimer)
    handleStopTimer(client: Socket, data: TimerInfo) {
        this.timerService.stopTimer(data);
    }

    @SubscribeMessage(TimerEvents.ResetTimer)
    handleResetTimer(client: Socket, data: TimerInfo) {
        // Turn-timer resets (outside combat) are triggered client-side by the `TurnUpdate`
        // listener, which emits `resetTimer(TURN_DELAY)` then `resetTimer(TURN_TIME)`. A player
        // doing a drop-in receives a private `TurnUpdate` (via `client.emit`) to simply
        // display the current turn — they must not be able to reset the timer for the whole
        // room. So we only allow resets coming from sockets that were already
        // in the room at the time of the last `TurnUpdate` broadcast (captured in
        // `room.turnAwareSockets` par `TurnService.broadcastTurnUpdate`).
        if (!data.isCombat) {
            const room = this.gameRoomService.getRoom(data.roomId);
            if (room && !room.turnAwareSockets?.has(client.id)) {
                return;
            }
        }
        this.timerService.resetTimer(data, this.server);
    }
}
