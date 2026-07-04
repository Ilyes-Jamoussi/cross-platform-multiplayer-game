import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionService } from '@app/services/action/action.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { AVATARS } from '@common/avatar';
import { MOCK_PLAYERS, POTION_ITEM, SHIELD_ITEM } from '@common/constants.spec';
import { ActiveGameEvents } from '@common/gateway-events';
import { CombatUpdate, Item, Player, Stats } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { PlayerPanelComponent } from './player-panel.component';

//  Non-null assertions (!) are used intentionally in this test file because:
//  1. We have full control over the test environment and the mocked data
//  2. All required properties are explicitly initialized in beforeEach()
//  3. Adding null checks would add unnecessary noise to the test cases
//  4. Edge cases with undefined values are tested separately
//  5. The assertions only appear where we guaranteed non-null values via the test setup

describe('PlayerPanelComponent', () => {
    let component: PlayerPanelComponent;
    let fixture: ComponentFixture<PlayerPanelComponent>;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockActionService: jasmine.SpyObj<ActionService>;
    let mockPlayer: Player;
    let mockInventory: Item[];
    let mockHasActionLeftSubject: Subject<number>;
    let mockInventorySubject: Subject<Item[]>;
    const completeStats: Stats = {
        life: 10,
        speed: 5,
        attack: 4,
        defense: 6,
        maxLife: 10,
        maxSpeed: 5,
    };
    const potionItem: Item = POTION_ITEM;
    const shieldItem: Item = SHIELD_ITEM;

    beforeEach(async () => {
        mockPlayer = MOCK_PLAYERS[0];

        mockPlayer = {
            ...mockPlayer,
            stats: { ...completeStats },
        };

        mockInventory = [
            {
                id: 'item-1',
                uniqueId: 'item-1-123',
                image: 'test-image.png',
                tooltip: 'Test tooltip',
                selected: false,
            },
        ];

        mockHasActionLeftSubject = new Subject<number>();
        mockInventorySubject = new Subject<Item[]>();

        mockPlayerService = jasmine.createSpyObj('PlayerService', [], {
            player: mockPlayer,
            inventory$: mockInventorySubject.asObservable(),
            avatar: mockPlayer.avatar,
        });

        mockSocketService = jasmine.createSpyObj('SocketService', ['on', 'off']);
        mockActionService = jasmine.createSpyObj('ActionService', [], {
            hasActionLeftSubject: mockHasActionLeftSubject.asObservable(),
        });

        await TestBed.configureTestingModule({
            imports: [PlayerPanelComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PlayerService, useValue: mockPlayerService },
                { provide: SocketService, useValue: mockSocketService },
                { provide: ActionService, useValue: mockActionService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PlayerPanelComponent);
        component = fixture.componentInstance;
        component['_player'] = { ...mockPlayer };
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Initialization', () => {
        it('should initialize with player from PlayerService', () => {
            expect(component.player).toEqual(mockPlayer);
        });

        it('should initialize with empty inventory', () => {
            expect(component.inventory).toBeUndefined();
        });

        it('should initialize with default actionsLeft', () => {
            expect(component.actionsLeft).toBe(1);
        });

        it('should return correct player avatar', () => {
            const expectedAvatar = AVATARS.find((avatar) => avatar.name === mockPlayer.avatar)?.image;
            expect(component.playerAvatar).toEqual(expectedAvatar);
        });
    });

    describe('Socket Event Handlers', () => {
        it('should update player on PlayerNextPosition event for current player', () => {
            const updatedPlayer: Player = {
                ...mockPlayer,
                position: { x: 10, y: 10 },
            };
            const callback = mockSocketService.on.calls.argsFor(0)[1];
            callback({ player: updatedPlayer });
            expect(component.player).toEqual(updatedPlayer);
        });

        it('should ignore PlayerNextPosition event for different player', () => {
            const differentPlayer: Player = MOCK_PLAYERS[1];
            const callback = mockSocketService.on.calls.argsFor(0)[1];
            callback({ player: differentPlayer });
            expect(component.player).toEqual(mockPlayer);
        });

        it('should reset speed on TurnUpdate event for other player', () => {
            const otherPlayer: Player = MOCK_PLAYERS[1];
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            component['_player'].stats!.speed = 3;
            const callback = mockSocketService.on.calls.argsFor(1)[1];
            callback({ player: otherPlayer });
            expect(component.player.stats?.speed).toBe(mockPlayer.stats?.maxSpeed);
        });

        it('should not reset speed on TurnUpdate event for same player', () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            component['_player'].stats!.speed = 3;
            const callback = mockSocketService.on.calls.argsFor(1)[1];
            callback({ player: mockPlayer });
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.player.stats?.speed).toBe(3);
        });

        it('should update life on CombatUpdate event', () => {
            const newLifeValue = 5;
            const combatUpdate: CombatUpdate = {
                roomId: 'test-room',
                gameState: {
                    players: [
                        {
                            ...mockPlayer,
                            stats: {
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                ...mockPlayer.stats!,
                                life: newLifeValue,
                            },
                        },
                    ],
                },
            };
            const callback = mockSocketService.on.calls.argsFor(2)[1];
            callback(combatUpdate);
            expect(component.player.stats?.life).toBe(newLifeValue);
        });

        it('should handle undefined stats in CombatUpdate', () => {
            const combatUpdate: CombatUpdate = {
                roomId: 'test-room',
                gameState: {
                    players: [
                        {
                            ...mockPlayer,
                            stats: undefined,
                        },
                    ],
                },
            };
            const callback = mockSocketService.on.calls.argsFor(2)[1];
            callback(combatUpdate);
            expect(component.player.stats).toBeDefined();
        });
    });

    describe('Observable Subscriptions', () => {
        it('should update actionsLeft when ActionService emits', () => {
            mockHasActionLeftSubject.next(1);
            expect(component.actionsLeft).toBe(1);

            mockHasActionLeftSubject.next(0);
            expect(component.actionsLeft).toBe(0);
        });

        it('should update inventory when PlayerService emits', () => {
            mockInventorySubject.next(mockInventory);
            expect(component.inventory).toEqual(mockInventory);
        });
    });

    describe('Inventory Subscription', () => {
        it('should reset potion buff flag when gaining a potion', () => {
            component['_hasAppliedPotionBuff'] = true;
            component['_previousInventory'] = [];
            component['_player'].stats = { ...completeStats };
            component['_buffedStats'] = { attack: 4, defense: 6, life: 10, speed: 5 };

            mockInventorySubject.next([potionItem]);

            expect(component['_hasAppliedPotionBuff']).toBeTrue();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_player'].stats.life).toBe(12);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].defense).toBe(5);
        });

        it('should remove potion buff effects when losing a potion after having it', () => {
            component['_hasAppliedPotionBuff'] = true;
            component['_previousInventory'] = [potionItem];
            component['_player'].stats = { ...completeStats };
            component['_buffedStats'] = { attack: 4, defense: 5, life: 10, speed: 5 };

            mockInventorySubject.next([]);

            expect(component['_hasAppliedPotionBuff']).toBeFalse();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].defense).toBe(6);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_player'].stats.life).toBe(8);
        });

        it('should apply potion buff when gaining a potion for the first time', () => {
            component['_hasAppliedPotionBuff'] = false;
            component['_previousInventory'] = [];
            component['_player'].stats = { ...completeStats };
            component['_buffedStats'] = { attack: 4, defense: 6, life: 10, speed: 5 };

            mockInventorySubject.next([potionItem]);

            expect(component['_hasAppliedPotionBuff']).toBeTrue();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_player'].stats.life).toBe(12);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].defense).toBe(5);
        });
        it('should reset shield buff flag when gaining a shield', () => {
            component['_hasAppliedShieldBuff'] = true;
            component['_previousInventory'] = [];

            mockInventorySubject.next([shieldItem]);

            expect(component['_hasAppliedShieldBuff']).toBeTrue();
        });

        it('should remove shield buff effects when losing a shield after having it', () => {
            component['_hasAppliedShieldBuff'] = true;
            component['_previousInventory'] = [shieldItem];
            component['_buffedStats'] = { attack: 4, defense: 5, life: 10, speed: 5 };

            mockInventorySubject.next([]);

            expect(component['_hasAppliedShieldBuff']).toBeFalse();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].attack).toBe(5);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].defense).toBe(3);
        });

        it('should apply shield buff when gaining a shield for the first time', () => {
            component['_hasAppliedShieldBuff'] = false;
            component['_previousInventory'] = [];
            component['_buffedStats'] = { attack: 4, defense: 6, life: 10, speed: 5 };

            mockInventorySubject.next([shieldItem]);

            expect(component['_hasAppliedShieldBuff']).toBeTrue();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].attack).toBe(3);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].defense).toBe(8);
        });

        it('should handle both potion and shield buffs simultaneously', () => {
            component['_hasAppliedPotionBuff'] = false;
            component['_hasAppliedShieldBuff'] = false;
            component['_previousInventory'] = [];
            component['_player'].stats = { ...completeStats };
            component['_buffedStats'] = { attack: 4, defense: 6, life: 10, speed: 5 };

            mockInventorySubject.next([potionItem, shieldItem]);

            expect(component['_hasAppliedPotionBuff']).toBeTrue();
            expect(component['_hasAppliedShieldBuff']).toBeTrue();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_player'].stats.life).toBe(12);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].defense).toBe(7);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component['_buffedStats'].attack).toBe(3);
        });
    });

    describe('Cleanup', () => {
        it('should unsubscribe from socket events on destroy', () => {
            component.ngOnDestroy();
            expect(mockSocketService.off).toHaveBeenCalledWith(ActiveGameEvents.PlayerNextPosition);
            expect(mockSocketService.off).toHaveBeenCalledWith(ActiveGameEvents.TurnUpdate);
            expect(mockSocketService.off).toHaveBeenCalledWith(ActiveGameEvents.CombatUpdate);
        });

        it('should complete destroy$ on destroy', () => {
            const nextSpy = spyOn(component['_destroy$'], 'next');
            const completeSpy = spyOn(component['_destroy$'], 'complete');

            component.ngOnDestroy();

            expect(nextSpy).toHaveBeenCalled();
            expect(completeSpy).toHaveBeenCalled();
        });

        it('should clear inventory on destroy', () => {
            component['_inventory'] = mockInventory;
            component.ngOnDestroy();
            expect(component['_inventory']).toEqual([]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle player without stats', () => {
            const playerWithoutStats: Player = {
                id: 'player-no-stats',
                isHost: false,
            };
            component['_player'] = playerWithoutStats;
            fixture.detectChanges();

            expect(component.player.stats).toBeUndefined();
        });

        it('should handle empty inventory', () => {
            mockInventorySubject.next([]);
            expect(component.inventory).toEqual([]);
        });

        it('should update player life when not negative on CombatUpdate', () => {
            const newLifeValue = 15;
            const combatUpdate: CombatUpdate = {
                roomId: 'test-room',
                gameState: {
                    players: [
                        {
                            ...mockPlayer,
                            stats: {
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                ...mockPlayer.stats!,
                                life: newLifeValue,
                            },
                        },
                    ],
                },
            };
            const callback = mockSocketService.on.calls.argsFor(2)[1];
            callback(combatUpdate);
            expect(component.player.stats?.life).toBe(newLifeValue);
            expect(component.player.stats?.life).not.toBe(mockPlayer.stats?.maxLife);
        });
    });
});
