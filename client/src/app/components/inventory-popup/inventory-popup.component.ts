import { Component, OnDestroy, OnInit } from '@angular/core';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { ItemService } from '@app/services/item/item.service';
import { PlayerService } from '@app/services/player/player.service';
import { TimeService } from '@app/services/time/time.service';
import { ItemId } from '@common/enums';
import { Item } from '@common/interfaces';
import { resolveItemImage, shuffleArray } from '@common/shared-utils';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-inventory-popup',
    templateUrl: './inventory-popup.component.html',
    standalone: true,
    styleUrls: ['./inventory-popup.component.scss'],
    imports: [TranslateModule],
})
export class InventoryPopUpComponent implements OnInit, OnDestroy {
    private _inventory: Item[] = [];
    private _isVisible: boolean = false;
    private _popUpSubscription!: Subscription;
    private _inventorySubscription!: Subscription;
    private _timeSubscription!: Subscription;
    private _endTurn: boolean = false;

    constructor(
        private readonly itemService: ItemService,
        private readonly playerService: PlayerService,
        private readonly gameModeService: GameModeService,
        private readonly timeService: TimeService,
        private readonly translate: TranslateService,
    ) {}

    get isVisible(): boolean {
        return this._isVisible;
    }

    get inventory(): Item[] {
        return this._inventory;
    }

    ngOnInit(): void {
        this.setUpListener();
    }

    setUpListener() {
        this._popUpSubscription = this.itemService.inventoryPopUp.subscribe(() => {
            this._isVisible = true;
        });

        this._inventorySubscription = this.playerService.inventory$.subscribe((updatedInventory) => {
            this._inventory = updatedInventory;
        });

        this._timeSubscription = this.timeService.getTimeObservable().subscribe((time) => {
            if ((time as number) <= 0) {
                this._endTurn = true;
                this.closePopup();
            }
        });
    }

    closePopup() {
        if (this.getItemsCount() === 2) {
            this.removeItem();
            this._isVisible = false;
        } else if (this.isVisible && this._endTurn) {
            const shuffledArrayOfItems = shuffleArray(this._inventory);
            this.playerService.removeItemFromInventory(shuffledArrayOfItems[0]);
            this.playerService.updateInventory(this._inventory);
            this.itemService.itemSwapped(shuffledArrayOfItems[0], this._inventory);
            this._isVisible = false;
            this._endTurn = false;
        }
    }

    getItemsCount(): number {
        return this._inventory.filter((item) => item.selected === false).length;
    }

    removeItem(): void {
        const removedItem = this._inventory.find((item) => item.selected === true) as Item;
        if (removedItem && removedItem.id === ItemId.ItemFlag) {
            this.gameModeService.flagHolder = undefined;
        }
        this._inventory = this._inventory.filter((item) => item.selected === false);
        this.playerService.removeItemFromInventory(removedItem);
        this.playerService.updateInventory(this._inventory);
        this.itemService.itemSwapped(removedItem, this._inventory);
    }

    toggleItem(item: Item) {
        this._inventory.forEach((itemToFind) => (itemToFind.selected = false));

        const foundItem = this._inventory.find((itemToFind) => itemToFind.uniqueId === item.uniqueId);
        if (foundItem) {
            foundItem.selected = true;
        }
    }

    getItemName(itemId: string): string {
        if (itemId.includes(ItemId.ItemFlag)) {
            return this.translate.instant('inventory.flag');
        }
        return itemId.replace(/^item-\d+-/, '');
    }

    getItemImage(item: Item): string {
        return item.image || resolveItemImage(item.id);
    }

    ngOnDestroy() {
        this._popUpSubscription.unsubscribe();
        this._inventorySubscription.unsubscribe();
        this._timeSubscription.unsubscribe();
    }
}
