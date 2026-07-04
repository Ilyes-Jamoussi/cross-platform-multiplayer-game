import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { GAME_DATA, MOCK_BOARD_ITEM, MOCK_PLAYERS, PLAYER_1 } from '@common/constants.spec';
import { CombatResults, GameModes, GameSizes, ItemCategory, ItemCounts, ItemId, ItemTypes, TileTypes } from '@common/enums';
import { ActiveGameEvents, CTFEvents } from '@common/gateway-events';
import {
    CombatUpdate,
    GameDisconnect,
    GameState,
    Grid,
    Item,
    ItemCell,
    ItemInformation,
    ItemsDropped,
    ItemUpdate,
    Player,
    Section,
} from '@common/interfaces';
import { createItem } from '@common/shared-utils';
import { Position } from '@common/types';
import { ItemService } from './item.service';
/* eslint-disable max-lines */
describe('ItemService', () => {
    let service: ItemService;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockGameModeService: jasmine.SpyObj<GameModeService>;
    let mockGrid: Grid;
    let originalPlayerId: string;

    beforeEach(() => {
        mockPlayerService = jasmine.createSpyObj('PlayerService', ['canAddToInventory', 'addItemToInventory', 'updateInventory'], {
            player: { ...MOCK_PLAYERS[0] },
            roomId: 'room1',
        });

        mockSocketService = jasmine.createSpyObj('SocketService', ['sendMessage', 'on', 'off']);
        mockGameModeService = jasmine.createSpyObj('GameModeService', [], {
            flagHolder: MOCK_PLAYERS[0],
        });

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: PlayerService, useValue: mockPlayerService },
                { provide: SocketService, useValue: mockSocketService },
                { provide: GameModeService, useValue: mockGameModeService },
            ],
        }).compileComponents();

        service = TestBed.inject(ItemService);
        const mockBoard = JSON.parse(JSON.stringify(MOCK_BOARD_ITEM));
        mockGrid = JSON.parse(JSON.stringify(GAME_DATA)) as Grid;
        mockGrid.board = mockBoard;
        originalPlayerId = mockPlayerService.player.id;
    });

    afterEach(() => {
        mockPlayerService.player.id = originalPlayerId;
        mockGameModeService.flagHolder = undefined;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('setSize', () => {
        it('should set the mapSize', () => {
            service.mapSize = GameSizes.Small;
            expect(service.mapSize).toBe(GameSizes.Small);
        });
    });

    describe('setMode', () => {
        it('should set the mode', () => {
            service.mode = 'Classic';
            expect(service.mode).toBe('Classic');
        });
    });

    describe('filterItemsByMapSize', () => {
        let items: Item[][];

        beforeEach(() => {
            items = [
                [{ id: ItemTypes.StartingPoint + '1' } as Item, { id: '2' } as Item],
                [{ id: '3' } as Item, { id: '4' } as Item],
                [{ id: '5' } as Item, { id: '6' } as Item],
            ];
        });

        it('should return original items if first item is not a starting point', () => {
            const nonStartingItems = [[{ id: 'non-starting' } as Item]];
            expect(service.filterItemsByMapSize(nonStartingItems)).toEqual(nonStartingItems);
        });

        it('should filter items for Small map size', () => {
            service.mapSize = GameSizes.Small;
            const result = service.filterItemsByMapSize(items);
            expect(result.length).toBe(Math.ceil(ItemCounts.SmallItem / 2));
            expect(result[0].length).toBe(2);
        });

        it('should filter items for MED map size', () => {
            service.mapSize = GameSizes.Medium;
            const result = service.filterItemsByMapSize(items);
            expect(result.length).toBe(Math.ceil(ItemCounts.MediumItem / 2));
            expect(result[0].length).toBe(2);
        });

        it('should filter items for Big map size', () => {
            service.mapSize = GameSizes.Big;
            const result = service.filterItemsByMapSize(items);
            expect(result.length).toBe(Math.ceil(ItemCounts.BigItem / 2));
            expect(result[0].length).toBe(2);
        });

        it('should filter items for Random map size', () => {
            service.mapSize = GameSizes.Small + 1;
            const result = service.filterItemsByMapSize(items);
            expect(result.length).toBe(Math.ceil(ItemCounts.SmallItem / 2));
            expect(result[0].length).toBe(2);
        });
    });

    describe('filterSectionsByMode', () => {
        let sections: Section[];

        beforeEach(() => {
            sections = [{ label: ItemCategory.Flag } as Section, { label: ItemCategory.Random } as Section];
        });

        it('should filter out "Drapeau" section in Classic mode', () => {
            service.mode = GameModes.Classic;
            const result = service.filterSectionsByMode(sections);
            expect(result.length).toBe(1);
            expect(result[0].label).toBe(ItemCategory.Random);
        });

        it('should return all sections in non-Classic mode', () => {
            service.mode = GameModes.CTF;
            const result = service.filterSectionsByMode(sections);
            expect(result).toEqual(sections);
        });
    });

    describe('updateItemStyles', () => {
        let mockElement: {
            setAttribute: jasmine.Spy;
            style: {
                cursor?: string;
                opacity?: string;
            };
        };

        beforeEach(() => {
            mockElement = {
                setAttribute: jasmine.createSpy('setAttribute'),
                style: {},
            };
            spyOn(document, 'getElementById').and.returnValue(mockElement as unknown as HTMLElement);
        });

        it('should make items undraggable', () => {
            service.updateItemStyles(true);
            expect(mockElement.setAttribute).toHaveBeenCalledWith('draggable', 'false');
            expect(mockElement.style.cursor).toBe('default');
        });

        it('should make items draggable if not faded', () => {
            mockElement.style.opacity = '1';
            service.updateItemStyles(false);
            expect(mockElement.setAttribute).toHaveBeenCalledWith('draggable', 'true');
            expect(mockElement.style.cursor).toBe('grab');
        });
    });

    describe('pickUpItem', () => {
        beforeEach(() => {
            mockGrid.board = JSON.parse(JSON.stringify(MOCK_BOARD_ITEM));
        });
        it('should do nothing if position is undefined', () => {
            service.pickUpItem(undefined as unknown as Position, mockGrid);
            expect(mockPlayerService.addItemToInventory).not.toHaveBeenCalled();
            expect(mockSocketService.sendMessage).not.toHaveBeenCalled();
        });
        it('should not pick up starting point items', () => {
            const position = { x: 0, y: 1 } as Position;
            service.pickUpItem(position, mockGrid);
            expect(mockPlayerService.addItemToInventory).not.toHaveBeenCalled();
            expect(mockGrid.board[0][1].item.name).not.toBe('');
        });

        it('should handle flag items specially', () => {
            const position = { x: 1, y: 1 } as Position;
            mockPlayerService.canAddToInventory.and.returnValue(true);
            service.pickUpItem(position, mockGrid);
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(CTFEvents.FlagTaken, {
                roomId: 'room1',
                flagHolderId: 'player1000',
            });
        });

        it('should emit inventoryPopUp when inventory is full', () => {
            const position = { x: 1, y: 0 } as Position;
            mockPlayerService.canAddToInventory.and.returnValue(false);
            const emitSpy = spyOn(service['_inventoryPopUp'], 'emit');
            mockGrid.board[1][0].item = { name: ItemTypes.Item, description: 'normal' } as ItemCell;

            service.pickUpItem(position, mockGrid);

            expect(emitSpy).toHaveBeenCalled();
        });
    });

    describe('itemSwapped', () => {
        it('should send item swap message and flag event when item is flag', () => {
            const flagItem = { id: ItemTypes.Flag + '1' } as Item;
            service.itemSwapped(flagItem, []);
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(ActiveGameEvents.ItemSwapped, jasmine.any(Object));
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(CTFEvents.FlagDropped, { roomId: 'room1' });
        });

        it('should send only swap message when item is not flag', () => {
            const normalItem = createItem('item-1-Potion' as ItemId, 'super');
            service.itemSwapped(normalItem, []);
            expect(mockSocketService.sendMessage).toHaveBeenCalledTimes(1);
            expect(mockSocketService.sendMessage).not.toHaveBeenCalledWith(CTFEvents.FlagDropped, jasmine.any(Object));
        });
    });

    describe('resetInventory', () => {
        it('should send reset message with playerId', () => {
            service.resetInventory('test-player');
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(ActiveGameEvents.ResetInventory, {
                roomId: 'room1',
                playerId: 'test-player',
            });
        });
    });

    describe('onSwappedItem', () => {
        let updateCallback: (data: ItemUpdate) => void;

        beforeEach(() => {
            mockSocketService.on.calls.reset();
            service.onSwappedItem(mockGrid);
            updateCallback = mockSocketService.on.calls.argsFor(0)[1] as (data: ItemUpdate) => void;
        });

        it('should update item for matching player', () => {
            const testItem = { id: 'swapped-item', tooltip: 'new-tooltip', image: '' };
            const playerCell = mockGrid.board[0][0];
            updateCallback({
                playerId: MOCK_PLAYERS[0].id,
                item: testItem,
            });
            expect(playerCell.item.name).toBe('swapped-item');
            expect(playerCell.item.description).toBe('new-tooltip');
        });
    });

    describe('onItemPickedUp', () => {
        let pickupCallback: (data: ItemUpdate) => void;
        let pickUpSpy: jasmine.Spy;

        beforeEach(() => {
            mockSocketService.on.calls.reset();
            pickUpSpy = spyOn(service, 'pickUpItem').and.callThrough();
            service.onItemPickedUp(mockGrid);
            pickupCallback = mockSocketService.on.calls.argsFor(0)[1] as (data: ItemUpdate) => void;
        });

        it('should handle pickup for current player', () => {
            const itemPosition = { x: 1, y: 0 } as Position;
            pickupCallback({
                playerId: MOCK_PLAYERS[0].id,
                itemPosition,
            });
            expect(pickUpSpy).toHaveBeenCalledWith(itemPosition, mockGrid);
            expect(mockGrid.board[1][0].item.name).toBe('');
        });
    });

    describe('onCombatEnded', () => {
        let combatCallback: (data: CombatUpdate) => void;
        let mockLoser: Player;
        let mockGameState: GameState;

        beforeEach(() => {
            mockSocketService.on.calls.reset();
            mockLoser = {
                id: 'player1000',
                position: { x: 0, y: 0 } as Position,
                inventory: [{ id: 'item1', tooltip: 'tooltip1' }],
            } as Player;

            mockGameState = {
                players: [PLAYER_1, mockLoser],
            };

            service.onCombatEnded(mockGrid);
            combatCallback = mockSocketService.on.calls.argsFor(0)[1] as (data: CombatUpdate) => void;
        });

        it('should handle combat defeat for current player', () => {
            const combatData: CombatUpdate = {
                message: CombatResults.AttackDefeated,
                gameState: mockGameState,
                roomId: '123',
            };

            combatCallback(combatData);
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(
                ActiveGameEvents.ItemsDropped,
                jasmine.objectContaining({
                    roomId: 'room1',
                    inventory: mockLoser.inventory,
                    positions: jasmine.any(Array),
                }),
            );
        });

        it('should not process if not ATTACK_DEFEATED', () => {
            const combatData: CombatUpdate = { roomId: '123', message: CombatResults.AttackNotDefeated, gameState: mockGameState };
            combatCallback(combatData);
            expect(mockSocketService.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('onPlayerDisconnect', () => {
        let disconnectCallback: (data: GameDisconnect) => void;
        let mockDisconnectedPlayer: Player;
        let mockItemInfo: ItemInformation;

        beforeEach(() => {
            mockSocketService.on.calls.reset();
            mockDisconnectedPlayer = {
                id: 'disconnectedPlayer',
                position: { x: 1, y: 1 } as Position,
                inventory: [{ id: 'item1', tooltip: 'tooltip1' }],
            } as Player;

            mockItemInfo = {
                position: mockDisconnectedPlayer.position as Position,
                inventory: mockDisconnectedPlayer.inventory as Item[],
            };

            service.onPlayerDisconnect(mockGrid);
            disconnectCallback = mockSocketService.on.calls.argsFor(0)[1] as (data: GameDisconnect) => void;
        });

        it('should handle player disconnect and drop items', () => {
            const disconnectData: GameDisconnect = {
                playerId: 'disconnectedPlayer',
                roomId: 'room1',
                itemInformation: mockItemInfo,
            };

            disconnectCallback(disconnectData);
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(
                ActiveGameEvents.ItemsDropped,
                jasmine.objectContaining({
                    roomId: 'room1',
                    inventory: mockDisconnectedPlayer.inventory,
                    positions: jasmine.any(Array),
                }),
            );
        });
        it('should send FlagDropped if disconnected player is the flag holder', () => {
            const playerMock = { id: 'player1000', inventory: [], isHost: false } as Player;

            mockPlayerService.player = playerMock;
            mockPlayerService.roomId = 'room1';
            const disconnectData: GameDisconnect = {
                playerId: 'player1000',
                roomId: 'room1',
                itemInformation: mockItemInfo,
            };
            disconnectCallback(disconnectData);

            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(CTFEvents.FlagDropped, { roomId: 'room1' });
        });

        it('should handle current player disconnect and drop flag if flag holder', () => {
            mockPlayerService.player.id = 'disconnectedPlayer';
            mockGameModeService.flagHolder = { id: 'disconnectedPlayer' } as Player;

            const disconnectData: GameDisconnect = {
                playerId: 'disconnectedPlayer',
                roomId: 'room1',
                itemInformation: mockItemInfo,
            };

            disconnectCallback(disconnectData);
            expect(mockPlayerService.updateInventory).toHaveBeenCalledWith([]);
        });
    });

    describe('placeItems', () => {
        let dropCallback: (data: ItemsDropped) => void;
        let dropSpy: jasmine.Spy;

        beforeEach(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dropSpy = spyOn(service as any, 'dropItemsOnGrid');
            service.placeItems(mockGrid);
            dropCallback = mockSocketService.on.calls.argsFor(0)[1] as (data: ItemsDropped) => void;
        });

        it('should call dropItemsOnGrid when ItemsDropped event is received', () => {
            const testData: ItemsDropped = {
                positions: [{ x: 0, y: 0 } as Position],
                inventory: [createItem('item-1-Potion' as ItemId, 'super')],
                roomId: 'room1',
            };

            dropCallback(testData);
            expect(dropSpy).toHaveBeenCalledWith(testData.positions, testData.inventory, mockGrid);
        });
    });
    describe('getItemId', () => {
        it('should return ITEM_7 when id contains ITEM_7', () => {
            expect(service.getItemId('prefix-item-7-suffix')).toBe(ItemId.Item7);
        });

        it('should return ITEM_STARTING_POINT_RED when id contains it', () => {
            expect(service.getItemId('some-item-StartingPoint-red-thing')).toBe(ItemId.ItemStartingPoint);
        });

        it('should return original id when no special cases match', () => {
            const testId = 'normal-item-id';
            expect(service.getItemId(testId)).toBe(testId);
        });
    });

    describe('setUpListeners', () => {
        it('should set up all required listeners', () => {
            const spyPickUp = spyOn(service, 'onItemPickedUp');
            const spySwap = spyOn(service, 'onSwappedItem');
            const spyCombat = spyOn(service, 'onCombatEnded');
            const spyDisconnect = spyOn(service, 'onPlayerDisconnect');
            const spyPlace = spyOn(service, 'placeItems');

            service.setUpListeners(mockGrid);

            expect(spyPickUp).toHaveBeenCalledWith(mockGrid);
            expect(spySwap).toHaveBeenCalledWith(mockGrid);
            expect(spyCombat).toHaveBeenCalledWith(mockGrid);
            expect(spyDisconnect).toHaveBeenCalledWith(mockGrid);
            expect(spyPlace).toHaveBeenCalledWith(mockGrid);
        });
    });

    describe('inventoryPopUp', () => {
        it('should return the EventEmitter instance', () => {
            const emitter = service.inventoryPopUp;
            expect(emitter).toBeDefined();
        });
    });

    describe('dropItemsOnGrid', () => {
        let mockPositions: Position[];
        let mockInventory: Item[];

        beforeEach(() => {
            mockPositions = [{ x: 0, y: 0 } as Position, { x: 1, y: 1 } as Position];

            mockInventory = [
                createItem('item-1-Potion' as ItemId, 'super'),
                { id: ItemTypes.Flag + '1', tooltip: 'Flag tooltip', image: '' } as Item,
            ];
            mockGrid.board = [
                [
                    { item: { name: '', description: '' }, tile: TileTypes.Default },
                    { item: { name: '', description: '' }, tile: TileTypes.Default },
                ],
                [
                    { item: { name: '', description: '' }, tile: TileTypes.Default },
                    { item: { name: '', description: '' }, tile: TileTypes.Default },
                ],
            ];
        });

        it('should drop items on valid positions', () => {
            service['dropItemsOnGrid'](mockPositions, mockInventory, mockGrid);

            expect(mockGrid.board[0][0].item).toEqual({
                name: 'item-1-Potion',
                description: 'super',
            });

            expect(mockGrid.board[1][1].item).toEqual({
                name: ItemTypes.Flag + '1',
                description: 'Flag tooltip',
            });
        });

        it('should send FlagDropped message for flag items', () => {
            service['dropItemsOnGrid'](mockPositions, mockInventory, mockGrid);

            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(CTFEvents.FlagDropped, { roomId: 'room1' });
        });

        it('should handle empty inventory', () => {
            service['dropItemsOnGrid'](mockPositions, [], mockGrid);
            expect(mockSocketService.sendMessage).not.toHaveBeenCalled();
        });

        it('should drop maximum 2 items', () => {
            const manyPositions = [{ x: 0, y: 0 } as Position, { x: 1, y: 0 } as Position, { x: 0, y: 1 } as Position];

            const manyItems = [
                createItem('item-1-Potion' as ItemId, 'super'),
                createItem('item-2-Dague' as ItemId, 'super'),
                createItem('item-3-Bouclier' as ItemId, 'super'),
            ];

            service['dropItemsOnGrid'](manyPositions, manyItems, mockGrid);

            expect(mockGrid.board[0][0].item.name).toBe('item-1-Potion');
            expect(mockGrid.board[1][0].item.name).toBe('item-2-Dague');
            expect(mockGrid.board[0][1].item.name).toBe('');
        });
    });
});
