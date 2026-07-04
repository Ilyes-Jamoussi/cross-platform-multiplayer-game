import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { CTFEvents } from '@common/gateway-events';
import { FlagTakenPayload, SocketPayload } from '@common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
import { GameModeGateway } from './game-mode.gateway';

describe('GameModeGateway', () => {
    let gateway: GameModeGateway;
    let gameModeService: GameModeService;
    let mockServer: Partial<Server>;

    beforeEach(async () => {
        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameModeGateway,
                {
                    provide: GameModeService,
                    useValue: {
                        flagTaken: jest.fn(),
                        flagDropped: jest.fn(),
                    },
                },
            ],
        }).compile();

        gateway = module.get<GameModeGateway>(GameModeGateway);
        gameModeService = module.get<GameModeService>(GameModeService);

        Object.defineProperty(gateway, '_server', { value: mockServer, writable: true });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('handleFlagTaken', () => {
        it('should call flagTaken on service and emit event', () => {
            const mockPlayer = { id: 'player1', name: 'Test Player' };
            const payload: FlagTakenPayload = {
                roomId: 'room1',
                flagHolderId: 'player1',
            };

            (gameModeService.flagTaken as jest.Mock).mockReturnValue(mockPlayer);

            gateway.handleFlagTaken(payload);

            expect(gameModeService.flagTaken).toHaveBeenCalledWith(payload);
            expect(mockServer.to).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledWith(CTFEvents.FlagTaken, {
                flagHolder: mockPlayer,
            });
        });

        it('should handle service returning undefined', () => {
            const payload: FlagTakenPayload = {
                roomId: 'room1',
                flagHolderId: 'player1',
            };

            (gameModeService.flagTaken as jest.Mock).mockReturnValue(undefined);

            gateway.handleFlagTaken(payload);

            expect(gameModeService.flagTaken).toHaveBeenCalledWith(payload);
            expect(mockServer.to).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledWith(CTFEvents.FlagTaken, {
                flagHolder: undefined,
            });
        });
    });

    describe('handleFlagDropped', () => {
        it('should call flagDropped on service and emit event', () => {
            const payload: SocketPayload = {
                roomId: 'room1',
            };

            gateway.handleFlagDropped(payload);

            expect(gameModeService.flagDropped).toHaveBeenCalledWith('room1');
            expect(mockServer.to).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledWith(CTFEvents.FlagDropped);
        });

        it('should handle empty roomId', () => {
            const payload: SocketPayload = {
                roomId: '',
            };

            gateway.handleFlagDropped(payload);

            expect(gameModeService.flagDropped).toHaveBeenCalledWith('');
            expect(mockServer.to).toHaveBeenCalledWith('');
            expect(mockServer.emit).toHaveBeenCalledWith(CTFEvents.FlagDropped);
        });
    });

    describe('WebSocket server', () => {
        it('should have server instance after initialization', () => {
            expect(gateway['_server']).toBeDefined();
        });
    });
});
