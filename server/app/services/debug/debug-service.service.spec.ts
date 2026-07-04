import { GameRoomService } from '@app/services/game-room/game-room.service';
import { RoomData } from '@common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { DebugService } from './debug-service.service';

describe('DebugService', () => {
    let service: DebugService;
    let gameRoomService: jest.Mocked<GameRoomService>;

    beforeEach(async () => {
        const MOCK_ROOM: RoomData = {
            players: [
                { id: 'player1', name: 'Player 1', isHost: true },
                { id: 'player2', name: 'Player 2', isHost: false },
            ],
            isDebug: false,
            playerMax: 4,
            playerMin: 2,
            isLocked: false,
            isFriendsOnly: false,
            selectedAvatars: new Map(),
            entryFee: 0,
            playerUids: new Map(),
            paidPlayers: new Set(),
            hasGameStarted: false,
            dropInDropOutEnabled: false,
            isHostReady: false,
        };

        gameRoomService = {
            rooms: new Map([['room1', MOCK_ROOM]]),
            getRoom: jest.fn((id: string) => gameRoomService.rooms.get(id)),
        } as unknown as jest.Mocked<GameRoomService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DebugService,
                {
                    provide: GameRoomService,
                    useValue: gameRoomService,
                },
            ],
        }).compile();

        service = module.get<DebugService>(DebugService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('toggleDebug', () => {
        it('should toggle debug mode from false to true', () => {
            const room = service.toggleDebug('room1');
            expect(room.isDebug).toBe(true);
        });

        it('should toggle debug mode from true to false', () => {
            const room = gameRoomService.rooms.get('room1');
            room.isDebug = true;

            const updatedRoom = service.toggleDebug('room1');
            expect(updatedRoom.isDebug).toBe(false);
        });
    });

    describe('hasHostLeft', () => {
        it('should return true and disable debug mode when debug was enabled and host has left', () => {
            const room = gameRoomService.rooms.get('room1');
            room.isDebug = true;
            room.players = room.players.filter((player) => !player.isHost);

            const result = service.hasHostLeft('room1');
            expect(result).toBe(true);
            expect(room.isDebug).toBe(false);
        });

        it('should return true when debug was already disabled and host is still in the room', () => {
            const result = service.hasHostLeft('room1');
            expect(result).toBe(false);
        });

        it('should return false when debug is enabled and host is still in the room', () => {
            const room = gameRoomService.rooms.get('room1');
            room.isDebug = true;

            const result = service.hasHostLeft('room1');
            expect(result).toBe(false);
        });

        it('should return false when the room does not exist', () => {
            const result = service.hasHostLeft('invalidRoomId');
            expect(result).toBe(false);
        });
    });
});
