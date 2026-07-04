import { UserDocument } from '@app/model/database/user';
import { AuthService } from '@app/services/auth/auth.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { Player } from '@common/interfaces';
import { HttpException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameRoomController } from './game-room.controller';

describe('GameRoomController', () => {
    let controller: GameRoomController;
    let gameRoomService: jest.Mocked<GameRoomService>;
    let logger: jest.Mocked<Logger>;

    beforeEach(async () => {
        const mockGameRoomService = {
            createGameRoom: jest.fn(),
            hasRoom: jest.fn(),
            isLocked: jest.fn(),
            canReconnectToStartedGame: jest.fn(),
            selectAvatar: jest.fn(),
            getPlayers: jest.fn(),
            isDropInDropOut: jest.fn(),
            hasStarted: jest.fn(),
            getRoom: jest.fn(),
            notifyPublicRoomsChanged: jest.fn(),
        };

        const mockAuthService = {
            verifyToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
        };

        const mockLogger = {
            log: jest.fn().mockReturnValue(undefined),
            error: jest.fn().mockReturnValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [GameRoomController],
            providers: [
                { provide: GameRoomService, useValue: mockGameRoomService },
                { provide: AuthService, useValue: mockAuthService },
                { provide: Logger, useValue: mockLogger },
            ],
        }).compile();

        controller = module.get<GameRoomController>(GameRoomController);
        gameRoomService = module.get(GameRoomService);
        logger = module.get(Logger);
    });

    const roomId = 'room1';

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createRoom', () => {
        it('should create a room successfully', async () => {
            const gameId = 'game123';
            const mockUser = { firebaseUid: 'test-uid' } as UserDocument;
            gameRoomService.createGameRoom.mockResolvedValue(roomId);

            const result = await controller.createRoom(mockUser, { gameId });

            expect(result).toEqual({ roomId });
            expect(logger.log).toHaveBeenCalled();
        });

        it('should throw an exception when room creation fails', async () => {
            const gameId = 'game123';
            const mockUser = { firebaseUid: 'test-uid' } as UserDocument;
            gameRoomService.createGameRoom.mockRejectedValue(new Error('Creation failed'));

            await expect(controller.createRoom(mockUser, { gameId })).rejects.toThrow(HttpException);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('validateCode', () => {
        const mockUser = { firebaseUid: 'test-uid' } as UserDocument;

        it('should return successfully for an existing and unlocked room', () => {
            gameRoomService.hasRoom.mockReturnValue(true);
            gameRoomService.isLocked.mockReturnValue(false);
            gameRoomService.isDropInDropOut.mockReturnValue(false);
            gameRoomService.hasStarted.mockReturnValue(false);
            gameRoomService.canReconnectToStartedGame.mockReturnValue(false);

            expect(() => controller.validateCode(mockUser, roomId)).not.toThrow();
        });
        it('should throw an exception for a locked room', () => {
            gameRoomService.hasRoom.mockReturnValue(true);
            gameRoomService.isLocked.mockReturnValue(true);
            gameRoomService.isDropInDropOut.mockReturnValue(false);
            gameRoomService.hasStarted.mockReturnValue(false);
            gameRoomService.canReconnectToStartedGame.mockReturnValue(false);

            expect(() => controller.validateCode(mockUser, roomId)).toThrow(HttpException);
        });

        it('should allow reconnecting to a locked started room', () => {
            gameRoomService.hasRoom.mockReturnValue(true);
            gameRoomService.isLocked.mockReturnValue(true);
            gameRoomService.isDropInDropOut.mockReturnValue(false);
            gameRoomService.hasStarted.mockReturnValue(false);
            gameRoomService.canReconnectToStartedGame.mockReturnValue(true);

            expect(() => controller.validateCode(mockUser, roomId)).not.toThrow();
        });

        it('should allow validating a locked started room even without reconnect info', () => {
            gameRoomService.hasRoom.mockReturnValue(true);
            gameRoomService.isLocked.mockReturnValue(true);
            gameRoomService.isDropInDropOut.mockReturnValue(false);
            gameRoomService.hasStarted.mockReturnValue(true);
            gameRoomService.canReconnectToStartedGame.mockReturnValue(false);

            expect(() => controller.validateCode(mockUser, roomId)).not.toThrow();
        });

        it('should throw an exception for a non-existent room', () => {
            gameRoomService.hasRoom.mockReturnValue(false);

            expect(() => controller.validateCode(mockUser, roomId)).toThrow(HttpException);
        });
    });

    describe('selectAvatar', () => {
        it('should select an avatar successfully', async () => {
            const mockUser = { firebaseUid: 'test-uid' } as UserDocument;
            const payload = { roomId: 'room123', player: { id: 'player1' } as Player };
            const updatedPlayer = { ...payload.player, avatar: 'avatar1' };
            gameRoomService.selectAvatar.mockResolvedValue(updatedPlayer);

            gameRoomService.isDropInDropOut.mockReturnValue(false);
            gameRoomService.hasStarted.mockReturnValue(false);

            const result = await controller.selectAvatar(mockUser, payload);

            expect(result).toEqual({ player: updatedPlayer, isDropIn: false, isDropInSuccess: false });
        });

        it('should throw an exception when avatar selection fails', async () => {
            const mockUser = { firebaseUid: 'test-uid' } as UserDocument;
            const payload = { roomId: 'room123', player: { id: 'player1' } as Player };
            gameRoomService.selectAvatar.mockResolvedValue({ error: 'Avatar not available' });
            gameRoomService.isDropInDropOut.mockReturnValue(false);
            gameRoomService.hasStarted.mockReturnValue(false);

            await expect(controller.selectAvatar(mockUser, payload)).rejects.toThrow(HttpException);
        });
    });
    describe('getPlayers', () => {
        it('should return players successfully', () => {
            const players = [
                { id: 'player1', name: 'Player 1', avatar: 'avatar1', isHost: false },
                { id: 'player2', name: 'Player 2', avatar: 'avatar2', isHost: false },
            ];
            gameRoomService.getPlayers.mockReturnValue(players);

            const result = controller.getPlayers(roomId);

            expect(result).toEqual(players);
        });

        it('should throw an exception when players are not found', () => {
            const errorMessage = 'Players not found';
            gameRoomService.getPlayers.mockImplementation(() => {
                throw new Error(errorMessage);
            });

            expect(() => controller.getPlayers(roomId)).toThrow(HttpException);
        });
    });
});
