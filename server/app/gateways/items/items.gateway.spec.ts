import { ItemGateway } from '@app/gateways/items/items.gateway';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ITEM_DROP_DELAY } from '@common/constants';
import { DEFAULT_ROOM_MOCK, ITEMS, NEW_ITEM, ROOM_ID } from '@common/constants.spec';
import { ActiveGameEvents } from '@common/gateway-events';
import { ItemsDropped, ItemUpdate } from '@common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { Server } from 'socket.io';

describe('ItemGateway', () => {
    let gateway: ItemGateway;
    let gameRoomService: GameRoomService;
    let mockServer: Partial<Server>;

    beforeEach(async () => {
        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ItemGateway,
                {
                    provide: GameRoomService,
                    useValue: {
                        rooms: new Map([[ROOM_ID, DEFAULT_ROOM_MOCK]]),
                        getRoom: jest.fn((id: string) => {
                            const mockService = {
                                rooms: new Map([[ROOM_ID, DEFAULT_ROOM_MOCK]]),
                            };
                            return mockService.rooms.get(id);
                        }),
                        roomRemoved$: new Subject<string>(),
                        registerRoomTimeout: jest.fn((_roomId: string, timeout: NodeJS.Timeout) => timeout),
                        unregisterRoomTimeout: jest.fn(),
                        clearRoomTimeouts: jest.fn(),
                    },
                },
                {
                    provide: GameModeService,
                    useValue: {
                        isPartOfTeam: jest.fn().mockReturnValue(false),
                    },
                },
            ],
        }).compile();

        gateway = module.get<ItemGateway>(ItemGateway);
        gameRoomService = module.get<GameRoomService>(GameRoomService);

        gateway.server = mockServer as Server;
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('handleItemSwap', () => {
        it('should update player inventory and emit ItemUpdate event', () => {
            const itemUpdate: ItemUpdate = {
                roomId: 'room1',
                playerId: 'player1',
                inventory: ITEMS,
                item: NEW_ITEM,
                itemPosition: { x: 0, y: 0 },
            };

            gateway.handleItemSwap(itemUpdate);

            expect(DEFAULT_ROOM_MOCK.players[0].inventory).toEqual(ITEMS);
            expect(mockServer.to).toHaveBeenCalledWith(ROOM_ID);
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.ItemUpdate, {
                item: NEW_ITEM,
                itemPosition: { x: 0, y: 0 },
                playerId: 'player1',
            });
        });
    });

    describe('handleResetItems', () => {
        it('should reset player inventory', () => {
            const itemUpdate: ItemUpdate = {
                roomId: ROOM_ID,
                playerId: 'player1',
                inventory: [],
            };

            gateway.handleResetItems(itemUpdate);

            expect(gameRoomService.rooms.get(ROOM_ID).players[0].inventory).toEqual([]);
        });
    });

    describe('handleDroppedItems', () => {
        it('should process first item drop event and store data', () => {
            jest.useFakeTimers();
            const itemsDropped: ItemsDropped = {
                roomId: 'room1',
                inventory: ITEMS,
                positions: [{ x: 0, y: 0 }],
            };

            gateway.handleDroppedItems(itemsDropped);
            expect(mockServer.to).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.ItemsDropped, itemsDropped);
            expect(gateway['processedConnections'].has('room1')).toBeTruthy();

            jest.advanceTimersByTime(ITEM_DROP_DELAY);
            expect(gateway['processedConnections'].has('room1')).toBeFalsy();
        });

        it('should reuse stored data for subsequent events', () => {
            const storedData: ItemsDropped = {
                roomId: 'room1',
                inventory: ITEMS,
                positions: [{ x: 0, y: 0 }],
            };
            gateway['processedConnections'].set('room1', storedData);

            const newData: ItemsDropped = {
                roomId: 'room1',
                inventory: ITEMS,
                positions: [{ x: 0, y: 0 }],
            };

            gateway.handleDroppedItems(newData);

            expect(mockServer.to).toHaveBeenCalledWith('room1');
            expect(mockServer.emit).toHaveBeenCalledTimes(1);
            expect(mockServer.emit).toHaveBeenCalledWith(ActiveGameEvents.ItemsDropped, storedData);
        });
    });
});
