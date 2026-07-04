import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { ItemService } from '@app/services/item/item.service';
import { PlayerService } from '@app/services/player/player.service';
import { TimeService } from '@app/services/time/time.service';
import { FLAG, MOCK_PLAYERS, SELECTED_DAGUE_ITEM, SELECTED_FLAG, SELECTED_POTION_ITEM, SHIELD_ITEM } from '@common/constants.spec';
import { ItemId } from '@common/enums';
import { Item } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryPopUpComponent } from './inventory-popup.component';

describe('InventoryPopUpComponent', () => {
    let component: InventoryPopUpComponent;
    let fixture: ComponentFixture<InventoryPopUpComponent>;
    let mockItemService: jasmine.SpyObj<ItemService>;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;
    let mockGameModeService: jasmine.SpyObj<GameModeService>;
    let mockTimeService: jasmine.SpyObj<TimeService>;
    let timeSubject: Subject<number>;

    const mockFlag: Item = FLAG;
    const mockShield: Item = SHIELD_ITEM;

    const mockInventory: Item[] = [{ ...mockFlag }, { ...mockShield }];

    beforeEach(async () => {
        timeSubject = new Subject<number>();

        mockItemService = jasmine.createSpyObj('ItemService', ['itemSwapped'], {
            inventoryPopUp: of(null),
        });
        mockPlayerService = jasmine.createSpyObj('PlayerService', ['removeItemFromInventory', 'updateInventory'], {
            inventory$: of(mockInventory),
        });
        mockGameModeService = jasmine.createSpyObj('GameModeService', [], { flagHolder: undefined });
        mockTimeService = jasmine.createSpyObj('TimeService', ['getTimeObservable']);
        mockTimeService.getTimeObservable.and.returnValue(timeSubject.asObservable());

        await TestBed.configureTestingModule({
            imports: [InventoryPopUpComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ItemService, useValue: mockItemService },
                { provide: PlayerService, useValue: mockPlayerService },
                { provide: GameModeService, useValue: mockGameModeService },
                { provide: TimeService, useValue: mockTimeService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(InventoryPopUpComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        component.ngOnDestroy();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize subscriptions', () => {
        expect(component['_popUpSubscription']).toBeDefined();
        expect(component['_inventorySubscription']).toBeDefined();
        expect(component['_timeSubscription']).toBeDefined();
    });

    it('should set isVisible to true when inventoryPopUp emits', () => {
        expect(component.isVisible).toBeTrue();
    });

    it('should update inventory when inventory$ emits', () => {
        expect(component.inventory).toEqual(mockInventory);
    });

    it('should get correct selected items count', () => {
        component['_inventory'] = [{ ...mockFlag, selected: false }, { ...mockShield }];
        expect(component.getItemsCount()).toBe(2);
    });

    it('should toggle item selection', () => {
        component['_inventory'] = [...mockInventory];
        component.toggleItem(mockFlag);

        const foundItem = component.inventory.find((item) => item.uniqueId === mockFlag.uniqueId);
        expect(foundItem?.selected).toBeTrue();
        expect(component.inventory[1].selected).toBeFalse();
    });

    it('should get correct item name', () => {
        expect(component.getItemName(ItemId.ItemFlag)).toBe('inventory.flag');
        expect(component.getItemName('item-2-test')).toBe('test');
    });

    it('should unsubscribe on destroy', () => {
        const popUpUnsubscribeSpy = spyOn(component['_popUpSubscription'], 'unsubscribe');
        const inventoryUnsubscribeSpy = spyOn(component['_inventorySubscription'], 'unsubscribe');
        const timeUnsubscribeSpy = spyOn(component['_timeSubscription'], 'unsubscribe');

        component.ngOnDestroy();

        expect(popUpUnsubscribeSpy).toHaveBeenCalled();
        expect(inventoryUnsubscribeSpy).toHaveBeenCalled();
        expect(timeUnsubscribeSpy).toHaveBeenCalled();
    });

    describe('closePopup()', () => {
        let mockInventory1: Item[];

        beforeEach(() => {
            mockInventory1 = [mockFlag, mockShield];
            component['_inventory'] = [...mockInventory1];
            mockPlayerService.removeItemFromInventory.calls.reset();
            mockPlayerService.updateInventory.calls.reset();
            mockItemService.itemSwapped.calls.reset();
        });

        it('should remove item and hide popup when exactly 2 items are NOT selected', () => {
            component['_inventory'] = [mockFlag, mockShield, SELECTED_DAGUE_ITEM];

            component.closePopup();
            expect(mockPlayerService.removeItemFromInventory).toHaveBeenCalled();
            expect(component.isVisible).toBeFalse();
            component['_inventory'] = [SELECTED_POTION_ITEM, mockShield];

            component.closePopup();
            expect(mockPlayerService.removeItemFromInventory).toHaveBeenCalled();
            expect(component.isVisible).toBeFalse();
        });

        it('should shuffle inventory, remove random item and hide popup when endTurn is true', () => {
            component['_isVisible'] = true;
            component['_endTurn'] = true;
            component['_inventory'] = [mockShield, SELECTED_DAGUE_ITEM];

            component.closePopup();
            expect(mockPlayerService.removeItemFromInventory).toHaveBeenCalled();
            expect(mockPlayerService.updateInventory).toHaveBeenCalled();
            expect(mockItemService.itemSwapped).toHaveBeenCalled();

            expect(component.isVisible).toBeFalse();
            expect(component['_endTurn']).toBeFalse();
        });

        it('should do nothing when conditions are not met', () => {
            component['_inventory'] = [SELECTED_POTION_ITEM, mockShield];
            component['_isVisible'] = true;
            component['_endTurn'] = false;

            component.closePopup();

            expect(mockPlayerService.removeItemFromInventory).not.toHaveBeenCalled();
            expect(mockPlayerService.updateInventory).not.toHaveBeenCalled();
            expect(mockItemService.itemSwapped).not.toHaveBeenCalled();
            expect(component.isVisible).toBeTrue();
        });

        it('should handle empty inventory gracefully when endTurn is true', () => {
            component['_isVisible'] = true;
            component['_endTurn'] = true;
            component['_inventory'] = [];

            expect(() => component.closePopup()).not.toThrow();
            expect(component.isVisible).toBeFalse();
        });
    });

    it('should close popup when time ≤ 0', () => {
        component['_isVisible'] = true;
        component['_inventory'] = [{ ...mockFlag, selected: true }, { ...mockShield }];

        timeSubject.next(0);

        expect(component.isVisible).toBeFalse();
        expect(mockPlayerService.removeItemFromInventory).toHaveBeenCalled();
    });

    it('should clear flagHolder when removing a flag item', () => {
        component['_inventory'] = [SELECTED_FLAG];
        mockGameModeService.flagHolder = MOCK_PLAYERS[0];

        component.removeItem();

        expect(mockGameModeService.flagHolder).toBeUndefined();
        expect(mockPlayerService.removeItemFromInventory).toHaveBeenCalledWith(SELECTED_FLAG);
    });
});
