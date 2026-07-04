import { Injectable } from '@angular/core';
import { SocketService } from '@app/services/socket/socket.service';
import { DebugEvents } from '@common/gateway-events';
import { DebugResponse, SocketPayload } from '@common/interfaces';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class DebugService {
    private readonly _isDebugSubject = new BehaviorSubject<boolean>(false);
    private _isInitialized = false;
    constructor(private readonly socketService: SocketService) {
        this.debugListener();
    }
    get isDebug(): Observable<boolean> {
        return this._isDebugSubject.asObservable();
    }
    init(roomId: string) {
        if (!this._isInitialized) {
            this.debugListener();
            this._isInitialized = true;
        }
        this.socketService.sendMessage<SocketPayload>(DebugEvents.RequestDebugState, { roomId });
    }
    toggleDebug(roomId: string) {
        this.socketService.sendMessage<SocketPayload>(DebugEvents.ToggleDebug, { roomId });
    }
    reset() {
        this._isInitialized = false;
        this._isDebugSubject.next(false);
        this.socketService.off(DebugEvents.ToggleDebug);
    }
    private debugListener() {
        this.socketService.on<DebugResponse>(DebugEvents.ToggleDebug, (response) => {
            this._isDebugSubject.next(response.isDebug);
        });
    }
}
