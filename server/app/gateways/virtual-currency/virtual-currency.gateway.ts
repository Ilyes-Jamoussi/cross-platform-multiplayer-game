import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { VirtualCurrencyEvents } from '@common/gateway-events';

@WebSocketGateway()
export class VirtualCurrencyGateway {
    @WebSocketServer() server: Server;

    notifyCurrencyChange(socketId: string, newAmount: number, change: number) {
        this.server.to(socketId).emit(VirtualCurrencyEvents.CurrencyUpdate, {
            newAmount,
            change,
        });
    }
}
