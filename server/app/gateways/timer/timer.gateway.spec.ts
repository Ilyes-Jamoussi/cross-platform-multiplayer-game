import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { TimerGateway } from './timer.gateway';
import { TimerService } from '@app/services/time/time.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TimerInfo } from '@common/interfaces';

describe('TimerGateway', () => {
    let gateway: TimerGateway;
    let timerService: TimerService;
    let server: Server;
    let client: Socket;
    const timerInfo: TimerInfo = { roomId: 'test-room', startValue: 10, isCombat: false };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TimerGateway,
                {
                    provide: TimerService,
                    useValue: {
                        startTimer: jest.fn(),
                        stopTimer: jest.fn(),
                        resetTimer: jest.fn(),
                    },
                },
                {
                    provide: GameRoomService,
                    useValue: {
                        getRoom: jest.fn(),
                    },
                },
            ],
        }).compile();

        gateway = module.get<TimerGateway>(TimerGateway);
        timerService = module.get<TimerService>(TimerService);
        server = gateway['server'];
        client = {
            id: 'test-client-id',
            emit: jest.fn(),
            join: jest.fn(),
            leave: jest.fn(),
        } as unknown as Socket;
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('handleStartTimer', () => {
        it('should call timerService.startTimer with correct parameters', () => {
            gateway.handleStartTimer(client, timerInfo);
            expect(timerService.startTimer).toHaveBeenCalledWith(timerInfo, server);
        });
    });

    describe('handleStopTimer', () => {
        it('should call timerService.stopTimer with correct parameters', () => {
            gateway.handleStopTimer(client, timerInfo);
            expect(timerService.stopTimer).toHaveBeenCalledWith(timerInfo);
        });
    });

    describe('handleResetTimer', () => {
        it('should call timerService.resetTimer with correct parameters', () => {
            gateway.handleResetTimer(client, timerInfo);
            expect(timerService.resetTimer).toHaveBeenCalledWith(timerInfo, server);
        });
    });
});
