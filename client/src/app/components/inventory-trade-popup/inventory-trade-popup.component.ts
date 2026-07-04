import { Component, OnDestroy, OnInit } from '@angular/core';
import { ItemService } from '@app/services/item/item.service';
import { Item } from '@common/interfaces';
import { resolveItemImage } from '@common/shared-utils';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-inventory-trade-popup',
    standalone: true,
    imports: [TranslateModule],
    templateUrl: './inventory-trade-popup.component.html',
    styleUrls: ['./inventory-trade-popup.component.scss'],
})
export class InventoryTradePopupComponent implements OnInit, OnDestroy {
    private _isVisible = false;
    private _playerInventory: Item[] = [];
    private _teammateInventory: Item[] = [];
    private _playerSelected?: Item;
    private _teammateItemOffered?: Item;
    private _playerAccepted = false;
    private _teammateAccepted = false;
    private _popupSub!: Subscription;
    private _tradeClosedSub!: Subscription;
    private _teammateId!: string;

    constructor(private readonly itemService: ItemService) {}

    get isVisible() {
        return this._isVisible;
    }

    get playerInventory() {
        return this._playerInventory;
    }

    get teammateInventory() {
        return this._teammateInventory;
    }

    get playerSelected() {
        return this._playerSelected;
    }

    get teammateItemOffered() {
        return this._teammateItemOffered;
    }

    get playerAccepted() {
        return this._playerAccepted;
    }

    get teammateAccepted() {
        return this._teammateAccepted;
    }

    ngOnInit() {
        this._popupSub = this.itemService.tradePopUp.subscribe((payload) => {
            this._playerInventory = payload.playerInventory;
            this._teammateInventory = payload.teammateInventory;
            this._teammateId = payload.teammateId;
            this._playerSelected = payload.playerSelected;
            this._teammateItemOffered = payload.teammateItemOffered;
            this._playerAccepted = payload.playerAccepted || false;
            this._teammateAccepted = payload.teammateAccepted || false;
            this._isVisible = true;
        });
        this._tradeClosedSub = this.itemService.tradeClosed.subscribe(() => {
            this.closePopup();
        });
    }

    selectPlayerItem(item: Item) {
        this._playerSelected = item;
        if (!item.uniqueId) return;
        this.itemService.updateTrade(item.uniqueId, this._teammateId);
    }

    acceptTrade() {
        this.itemService.acceptTrade(this._teammateId);
    }

    cancelTrade() {
        this.itemService.cancelTrade(this._teammateId);
    }

    getItemImage(item: Item): string {
        return item.image || resolveItemImage(item.id);
    }

    closePopup() {
        this._playerSelected = undefined;
        this._teammateItemOffered = undefined;
        this._playerAccepted = false;
        this._teammateAccepted = false;
        this._isVisible = false;
    }

    ngOnDestroy() {
        this._popupSub?.unsubscribe();
        this._tradeClosedSub?.unsubscribe();
    }
}
