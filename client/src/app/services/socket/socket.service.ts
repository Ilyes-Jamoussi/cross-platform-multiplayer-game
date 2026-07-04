import { Injectable } from '@angular/core';
import { SocketListen } from '@app/enums/socket-enums';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class SocketService {
    private readonly socket: Socket;
    private readonly connectionStatus = new BehaviorSubject<boolean>(false);

    constructor() {
        this.socket = io(environment.socketUrl, {
            transports: [SocketListen.WebSocket],
            autoConnect: false,
        });

        this.setupSocketListeners();
    }
    connect() {
        if (!this.socket.connected) {
            this.socket.connect();
        }
    }
    disconnect() {
        this.socket.disconnect();
    }

    isConnected(): Observable<boolean> {
        return this.connectionStatus.asObservable();
    }
    on<T>(event: string, callback: (data: T) => void) {
        this.socket.on(event, callback);
    }
    off<T>(event: string, callback?: (data: T) => void) {
        this.socket.off(event, callback);
    }
    sendMessage<T>(event: string, message: T): void {
        if (!this.socket.connected) {
            this.socket.connect();
            this.socket.once(SocketListen.Connect, () => {
                this.socket.emit(event, message);
            });
            return;
        }
        this.socket.emit(event, message);
    }
    getSocketId(): string {
        return this.socket.id as string;
    }
    private setupSocketListeners() {
        this.socket.on(SocketListen.Connect, () => {
            this.connectionStatus.next(true);
        });

        this.socket.on(SocketListen.Disconnect, () => {
            this.connectionStatus.next(false);
        });

        this.socket.on(SocketListen.ConnectError, () => {
            this.connectionStatus.next(false);
        });
    }
}
