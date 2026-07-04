import { Injectable, OnDestroy } from '@angular/core';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TURN_TIME, COMBAT_TURN_TIME, COMBAT_TIME } from '@common/constants';
import { TimerEvents } from '@common/gateway-events';
import { TimerUpdatePayload } from '@common/interfaces';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class TimeService implements OnDestroy {
    private readonly time$ = new BehaviorSubject<number | string>('--');
    private readonly combatTime$ = new BehaviorSubject<number>(COMBAT_TIME);

    constructor(
        private readonly socketService: SocketService,
        private readonly playerService: PlayerService,
    ) {}

    init() {
        this.setupListeners();
    }

    startTimer(startValue?: number, isCombat: boolean = false, isCombatOver?: boolean) {
        const roomId = this.playerService.roomId;
        if (roomId) {
            this.socketService.sendMessage(TimerEvents.StartTimer, {
                roomId,
                startValue: startValue ?? (isCombat ? COMBAT_TURN_TIME : TURN_TIME),
                isCombat,
                isCombatOver,
            });
        }
    }

    stopTimer(isCombat: boolean = false) {
        const roomId = this.playerService.roomId;
        if (roomId) {
            this.socketService.sendMessage(TimerEvents.StopTimer, { roomId, isCombat });
        }
    }

    resetTimer(time?: number, isCombat: boolean = false) {
        const roomId = this.playerService.roomId;
        if (roomId) {
            this.socketService.sendMessage(TimerEvents.ResetTimer, {
                roomId,
                startValue: time ?? (isCombat ? COMBAT_TURN_TIME : TURN_TIME),
                isCombat,
            });
        }
    }

    getTimeObservable(): Observable<number | string> {
        return this.time$.asObservable();
    }

    getCombatTimeObservable(): Observable<number> {
        return this.combatTime$.asObservable();
    }

    ngOnDestroy() {
        this.stopTimer();
        this.socketService.off(TimerEvents.TimerUpdate);
    }

    reset() {
        this.time$.next('--');
    }

    private setupListeners() {
        this.socketService.on<TimerUpdatePayload>(TimerEvents.TimerUpdate, (data) => {
            if (data.isCombat) {
                this.combatTime$.next(data.timeLeft);
            } else {
                this.time$.next(data.timeLeft);
            }
        });
    }
}
