import { Server } from 'socket.io';

export interface TurnInfo {
    roomId: string;
    quittingPlayerId: string;
    server: Server;
}
