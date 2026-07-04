import { DAGGER_LIFE_APPLY } from '@app/constants/test-consts';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ItemService } from '@app/services/items/items.service';
import { ItemId } from '@common/enums';

describe('ItemService', () => {
    let itemService: ItemService;
    let mockGameRoomService: Partial<GameRoomService>;

    const mockPlayer = (overrides = {}) => ({
        id: 'player1',
        inventory: [],
        stats: { life: 10, attack: 5, defense: 5 },
        ...overrides,
    });

    const mockRoom = {
        players: [mockPlayer()],
    };

    beforeEach(() => {
        mockGameRoomService = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rooms: new Map<string, any>([['room1', mockRoom]]),
            getRoom: jest.fn((id: string) => mockGameRoomService.rooms.get(id)),
        };
        itemService = new ItemService(mockGameRoomService as GameRoomService);
    });

    describe('applyAttributesBuffs', () => {
        it('applies potion effect', () => {
            const player = mockRoom.players[0];
            player.inventory = [{ id: ItemId.Item1 }];
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const stats = itemService.applyAttributesBuffs('room1', 'player1', { attack: 2, defense: 5, life: 0, speed: 0 });
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(player.stats.life).toBe(12);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(stats.defense).toBe(4);
        });

        it('applies shield effect when no potion', () => {
            const player = mockRoom.players[0];
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            player.stats = { life: 10, attack: 5, defense: 5 };
            player.inventory = [{ id: ItemId.Item3 }];
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const stats = itemService.applyAttributesBuffs('room1', 'player1', { attack: 2, defense: 5, life: 0, speed: 0 });
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(stats.defense).toBe(7);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(stats.attack).toBe(1);
        });

        it('does not crash if player has no inventory', () => {
            const player = mockRoom.players[0];
            delete player.inventory;
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(() => itemService.applyAttributesBuffs('room1', 'player1', { attack: 2, defense: 5, life: 0, speed: 0 })).not.toThrow();
            expect(player.inventory).toEqual([]);
        });
    });

    describe('applyPoison', () => {
        it('returns true if player has poison', () => {
            const player = mockRoom.players[0];
            player.inventory = [{ id: ItemId.Item4 }];
            expect(itemService.applyPoison('room1', 'player1')).toBe(true);
        });

        it('returns false if player has no poison', () => {
            const player = mockRoom.players[0];
            player.inventory = [];
            expect(itemService.applyPoison('room1', 'player1')).toBe(false);
        });
    });

    describe('applyDagger', () => {
        it('returns true if player has dagger and life is below threshold', () => {
            const player = mockRoom.players[0];
            player.inventory = [{ id: ItemId.Item2 }];
            player.stats.life = DAGGER_LIFE_APPLY - 1;
            expect(itemService.applyDagger('room1', 'player1')).toBe(true);
        });

        it('returns false if no dagger', () => {
            const player = mockRoom.players[0];
            player.inventory = [];
            expect(itemService.applyDagger('room1', 'player1')).toBe(false);
        });

        it('returns false if dagger but life is high', () => {
            const player = mockRoom.players[0];
            player.inventory = [{ id: ItemId.Item2 }];
            player.stats.life = DAGGER_LIFE_APPLY + 1;
            expect(itemService.applyDagger('room1', 'player1')).toBe(false);
        });
    });

    describe('applyDiceEffect', () => {
        it('returns number if dice exists', () => {
            const player = mockRoom.players[0];
            player.inventory = [{ id: ItemId.Item6 }];
            const result = itemService.applyDiceEffect('room1', 'player1', 2);
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(1);
            expect(result).toBeLessThanOrEqual(2);
        });

        it('returns null if no dice', () => {
            const player = mockRoom.players[0];
            player.inventory = [];
            expect(itemService.applyDiceEffect('room1', 'player1', 2)).toBeNull();
        });
    });

    describe('applyRevive', () => {
        it('returns true if revive item is present', () => {
            const player = mockRoom.players[0];
            player.inventory = [{ id: ItemId.Item5 }];
            expect(itemService.applyRevive('room1', 'player1')).toBe(true);
        });

        it('returns false if revive item is not present', () => {
            const player = mockRoom.players[0];
            player.inventory = [];
            expect(itemService.applyRevive('room1', 'player1')).toBe(false);
        });
    });
});
