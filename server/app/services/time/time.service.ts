import { COMBAT_TICK, TICK_TIME, Timers } from '@app/services/time/timer-utils';
import { TURN_TIME } from '@common/constants';
import { TimerEvents } from '@common/gateway-events';
import { TimerInfo } from '@common/interfaces';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class TimerService implements OnModuleDestroy {
    protected timers = new Map<string, Timers>();
    private endTimeouts = new Map<string, NodeJS.Timeout>();

    startTimer(info: TimerInfo, server: Server) {
        const { roomId, startValue = TURN_TIME, isCombat = false, isCombatOver } = info;
        const tickRate = isCombat ? COMBAT_TICK : TICK_TIME;

        if (this.timers.has(roomId)) return;

        let counter = startValue;
        const interval = setInterval(() => {
            counter--;
            server.to(roomId).emit(TimerEvents.TimerUpdate, { roomId, timeLeft: counter, isCombat });

            if (counter <= 0) {
                clearInterval(interval);
                this.timers.delete(roomId);
                const turnEnd = startValue === TURN_TIME || isCombatOver;
                const endTimeout = setTimeout(() => {
                    server.to(roomId).emit(TimerEvents.TimerEnd, { roomId, isCombat, turnEnd });
                    this.endTimeouts.delete(roomId);
                }, tickRate);
                this.endTimeouts.set(roomId, endTimeout);
            }
        }, tickRate);

        this.timers.set(roomId, { counter, interval });
    }

    resetTimer(info: TimerInfo, server: Server) {
        this.stopTimer(info);
        this.startTimer(info, server);
    }

    stopTimer(info: TimerInfo) {
        const { roomId } = info;
        const timer = this.timers.get(roomId);
        if (timer) {
            clearInterval(timer.interval);
            this.timers.delete(roomId);
        }
        const endTimeout = this.endTimeouts.get(roomId);
        if (endTimeout) {
            clearTimeout(endTimeout);
            this.endTimeouts.delete(roomId);
        }
    }

    onModuleDestroy() {
        this.timers.forEach((timer) => clearInterval(timer.interval));
        this.timers.clear();
        this.endTimeouts.forEach((t) => clearTimeout(t));
        this.endTimeouts.clear();
    }
}
