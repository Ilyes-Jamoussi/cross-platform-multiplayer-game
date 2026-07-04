import { Test, TestingModule } from '@nestjs/testing';
import { TimerService } from './time.service';
import { Server } from 'socket.io';
import { TimerEvents } from '@common/gateway-events';
import { TURN_TIME } from '@common/constants';
import { TICK_TIME } from '@app/services/time/timer-utils';
import { TimerInfo } from '@common/interfaces';

describe('TimerService', () => {
    let service: TimerService;
    let mockServer: Partial<Server>;
    let mockEmit: jest.Mock;

    beforeEach(async () => {
        mockEmit = jest.fn();
        mockServer = { to: jest.fn().mockReturnValue({ emit: mockEmit }) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [TimerService],
        }).compile();

        service = module.get<TimerService>(TimerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('startTimer - destructuring behavior', () => {
        it('should use provided roomId, startValue, and isCombat', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: 10, isCombat: true };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledWith(TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: 9, isCombat: true });
        });

        it('should use default startValue (TURN_TIME) when not provided', () => {
            const info: TimerInfo = { roomId: 'room1', isCombat: true };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledWith(TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: TURN_TIME - 1, isCombat: true });
        });

        it('should use default isCombat (false) when not provided', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: 5 };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledWith(TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: 4, isCombat: false });
        });

        it('should use default startValue and isCombat when only roomId is provided', () => {
            const info: TimerInfo = { roomId: 'room1' };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledWith(TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: TURN_TIME - 1, isCombat: false });
        });
    });

    describe('startTimer - timer behavior', () => {
        it('should start a timer and emit updates', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: 5, isCombat: false };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledWith(TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: 4, isCombat: false });
            expect(mockEmit).toHaveBeenCalledTimes(1);
        });

        it('should stop the timer and emit TimerEnd event when time reaches 0', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: TURN_TIME, isCombat: false };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenNthCalledWith(1, TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: 29, isCombat: false });

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.advanceTimersByTime(29000);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(mockEmit).toHaveBeenNthCalledWith(30, TimerEvents.TimerUpdate, { roomId: 'room1', timeLeft: 0, isCombat: false });

            jest.advanceTimersByTime(TICK_TIME);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(mockEmit).toHaveBeenNthCalledWith(31, TimerEvents.TimerEnd, { roomId: 'room1', isCombat: false, turnEnd: true });

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(mockEmit).toHaveBeenCalledTimes(31);
        });

        it('should not start a new timer for the same roomId', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: 5, isCombat: false };
            jest.useFakeTimers();

            service.startTimer(info, mockServer as Server);
            jest.advanceTimersByTime(TICK_TIME);
            service.startTimer(info, mockServer as Server);

            expect(mockEmit).toHaveBeenCalledTimes(1);
        });
    });

    describe('resetTimer', () => {
        it('should reset the timer by stopping and restarting it', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: 5, isCombat: false };
            jest.useFakeTimers();
            service.startTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledTimes(1);

            service.resetTimer(info, mockServer as Server);

            jest.advanceTimersByTime(TICK_TIME);
            expect(mockEmit).toHaveBeenCalledTimes(2);
        });
    });

    describe('stopTimer', () => {
        it('should stop the timer and clear it', () => {
            const info: TimerInfo = { roomId: 'room1', startValue: 5, isCombat: false };
            service.startTimer(info, mockServer as Server);
            service.stopTimer(info);

            expect(service['timers'].size).toBe(0);
        });
    });

    describe('onModuleDestroy', () => {
        it('should clear all active timers when the module is destroyed', () => {
            const info1: TimerInfo = { roomId: 'room1', startValue: 5, isCombat: false };
            const info2: TimerInfo = { roomId: 'room2', startValue: 3, isCombat: true };
            service.startTimer(info1, mockServer as Server);
            service.startTimer(info2, mockServer as Server);

            service.onModuleDestroy();

            expect(service['timers'].size).toBe(0);
        });
    });
});
