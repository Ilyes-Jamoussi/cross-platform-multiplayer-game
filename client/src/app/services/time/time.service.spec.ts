import { TestBed } from '@angular/core/testing';
import { TimeService } from './time.service';
import { SocketService } from '@app/services/socket/socket.service';
import { PlayerService } from '@app/services/player/player.service';
import { TURN_TIME, COMBAT_TURN_TIME, COMBAT_TIME } from '@common/constants';
import { TimerEvents } from '@common/gateway-events';
import { TimerUpdatePayload } from '@common/interfaces';
import { take } from 'rxjs';

describe('TimeService', () => {
    let service: TimeService;
    let socketServiceSpy: jasmine.SpyObj<SocketService>;
    let playerServiceSpy: jasmine.SpyObj<PlayerService>;

    beforeEach(() => {
        const socketSpy = jasmine.createSpyObj('SocketService', ['sendMessage', 'on', 'off']);
        const playerSpy = jasmine.createSpyObj('PlayerService', [], { roomId: 'testRoomId' });

        TestBed.configureTestingModule({
            providers: [TimeService, { provide: SocketService, useValue: socketSpy }, { provide: PlayerService, useValue: playerSpy }],
        });

        service = TestBed.inject(TimeService);
        socketServiceSpy = TestBed.inject(SocketService) as jasmine.SpyObj<SocketService>;
        playerServiceSpy = TestBed.inject(PlayerService) as jasmine.SpyObj<PlayerService>;
        service.init();
    });

    const triggerTimeUpdate = (payload: TimerUpdatePayload) => {
        const handler = socketServiceSpy.on.calls.allArgs().find((args) => args[0] === TimerEvents.TimerUpdate)?.[1];
        if (handler) handler(payload);
    };

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('startTimer', () => {
        it('should start the timer with default TURN_TIME', () => {
            service.startTimer();
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.StartTimer, {
                roomId: 'testRoomId',
                startValue: TURN_TIME,
                isCombat: false,
                isCombatOver: undefined,
            });
        });

        it('should start the timer with custom startValue', () => {
            const customTime = 30;
            service.startTimer(customTime);
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.StartTimer, {
                roomId: 'testRoomId',
                startValue: customTime,
                isCombat: false,
                isCombatOver: undefined,
            });
        });

        it('should start the timer with COMBAT_TURN_TIME when isCombat is true', () => {
            service.startTimer(undefined, true);
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.StartTimer, {
                roomId: 'testRoomId',
                startValue: COMBAT_TURN_TIME,
                isCombat: true,
                isCombatOver: undefined,
            });
        });

        it('should not start the timer if roomId is not set', () => {
            Object.defineProperty(playerServiceSpy, 'roomId', { get: () => null });
            service.startTimer();
            expect(socketServiceSpy.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('stopTimer', () => {
        it('should stop the timer', () => {
            service.stopTimer();
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.StopTimer, {
                roomId: 'testRoomId',
                isCombat: false,
            });
        });

        it('should stop the timer with isCombat set to true', () => {
            service.stopTimer(true);
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.StopTimer, {
                roomId: 'testRoomId',
                isCombat: true,
            });
        });

        it('should not stop the timer if roomId is not set', () => {
            Object.defineProperty(playerServiceSpy, 'roomId', { get: () => null });
            service.stopTimer();
            expect(socketServiceSpy.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('resetTimer', () => {
        it('should reset the timer with default TURN_TIME', () => {
            service.resetTimer();
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.ResetTimer, {
                roomId: 'testRoomId',
                startValue: TURN_TIME,
                isCombat: false,
            });
        });

        it('should reset the timer with custom startValue', () => {
            const customTime = 30;
            service.resetTimer(customTime);
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.ResetTimer, {
                roomId: 'testRoomId',
                startValue: customTime,
                isCombat: false,
            });
        });

        it('should reset the timer with COMBAT_TURN_TIME when isCombat is true', () => {
            service.resetTimer(undefined, true);
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.ResetTimer, {
                roomId: 'testRoomId',
                startValue: COMBAT_TURN_TIME,
                isCombat: true,
            });
        });

        it('should not reset the timer if roomId is not set', () => {
            Object.defineProperty(playerServiceSpy, 'roomId', { get: () => null });
            service.resetTimer();
            expect(socketServiceSpy.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('getTimeObservable', () => {
        it('should return time observable with initial value "--"', (done) => {
            service
                .getTimeObservable()
                .pipe(take(1))
                .subscribe((time) => {
                    expect(time).toBe('--');
                    done();
                });
        });

        it('should update time observable on TimerUpdate event', (done) => {
            const timeUpdatePayload: TimerUpdatePayload = { roomId: '', timeLeft: 50, isCombat: false };
            triggerTimeUpdate(timeUpdatePayload);

            service
                .getTimeObservable()
                .pipe(take(1))
                .subscribe((time) => {
                    expect(time).toBe(timeUpdatePayload.timeLeft);
                    done();
                });
        });
    });

    describe('getCombatTimeObservable', () => {
        it('should return combat time observable with initial value as COMBAT_TIME', (done) => {
            service
                .getCombatTimeObservable()
                .pipe(take(1))
                .subscribe((time) => {
                    expect(time).toBe(COMBAT_TIME);
                    done();
                });
        });

        it('should update combat time observable on TimerUpdate event', (done) => {
            const combatTimeUpdatePayload: TimerUpdatePayload = { roomId: '', timeLeft: 30, isCombat: true };
            triggerTimeUpdate(combatTimeUpdatePayload);

            service
                .getCombatTimeObservable()
                .pipe(take(1))
                .subscribe((time) => {
                    expect(time).toBe(combatTimeUpdatePayload.timeLeft);
                    done();
                });
        });
    });

    describe('reset', () => {
        it('should reset the timer to "--"', () => {
            service.reset();
            expect(service['time$'].value).toBe('--');
        });
    });

    describe('ngOnDestroy', () => {
        it('should stop the timer and remove listeners on destroy', () => {
            service.ngOnDestroy();
            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(TimerEvents.StopTimer, {
                roomId: 'testRoomId',
                isCombat: false,
            });
            expect(socketServiceSpy.off).toHaveBeenCalledWith(TimerEvents.TimerUpdate);
        });
    });
});
