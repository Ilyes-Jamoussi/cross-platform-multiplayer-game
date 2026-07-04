import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid-service/grid-service.service';
import { ItemService } from '@app/services/item/item.service';
import { GROUPED_ITEMS, ITEM_DESCRIPTIONS, ITEM_SECTIONS_NAMES } from '@common/constants';
import { ItemCategory, ItemId, ItemTypes } from '@common/enums';
import { Grid, Item, Section } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-item-bar',
    standalone: true,
    templateUrl: './item-bar.component.html',
    styleUrls: ['./item-bar.component.scss'],
    imports: [MatTooltip, TranslateModule],
})
export class ItemBarComponent implements OnInit, OnDestroy {
    readonly itemsDescription = ITEM_DESCRIPTIONS;
    readonly itemsNames = ITEM_SECTIONS_NAMES;
    protected readonly groupedItems = GROUPED_ITEMS;
    protected readonly itemCategory = ItemCategory;
    private readonly destroy$ = new Subject<void>();
    constructor(
        private readonly dragDropService: DragDropService,
        private readonly itemService: ItemService,
        private readonly gridService: GridService,
    ) {
        this.itemCounter();
        this.startCounter();
    }

    @HostListener('document:dragend', ['$event'])
    onDragEnd(event: DragEvent) {
        this.dragDropService.onDragEnd(event);
    }

    ngOnInit() {
        const game = sessionStorage.getItem('gameToEdit');
        if (game && game !== 'undefined') {
            const gameObject = JSON.parse(game) as Grid;
            this.itemService.mapSize = +gameObject.gridSize;
            this.itemService.mode = gameObject.gameMode;
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onDragStart(event: DragEvent, item: string, itemDescription: string): void {
        this.dragDropService.onDragStart(event, item, itemDescription);
    }

    getItemLeft() {
        const itemCount: number = this.dragDropService.observeItemCounter().value;
        return `${itemCount}`;
    }

    getStartLeft() {
        const startCount: number = this.dragDropService.observeStartCounter().value;
        return `${startCount}`;
    }

    onDrop(event: DragEvent) {
        this.dragDropService.setIsDragging(false);
        let id = event.dataTransfer?.getData('text')?.split(',')[0];
        if (id) {
            let item;
            if (id.includes('tile-')) {
                item = document.getElementById(id);
                item?.parentElement?.removeChild(item);
                id = id.replace('tile-', '');
                item = document.getElementById(id);
                if (item) this.dragDropService.setDraggable(item, true);
                this.gridService.dropDeleteItem();
            } else {
                item = document.getElementById(id);
                if (item) {
                    this.dragDropService.setDraggable(item, true);
                    if (/\d/.test(item.id)) {
                        this.dragDropService.incrementItemCounter();
                    } else if (item.id.includes(ItemTypes.StartingPoint)) {
                        this.dragDropService.incrementStartCounter();
                    }
                }
            }
        }
    }
    allowDrop(event: DragEvent) {
        event.preventDefault();
    }
    filterSectionsByMode(sections: Section[]): Section[] {
        return this.itemService.filterSectionsByMode(sections);
    }
    filterItemsByMapSize(items: Item[][]): Item[][] {
        return this.itemService.filterItemsByMapSize(items);
    }
    private startCounter() {
        this.dragDropService
            .observeStartCounter()
            .pipe(takeUntil(this.destroy$))
            .subscribe((startCount) => {
                const item = document.getElementById(ItemId.ItemStartingPoint) as HTMLElement;
                if (item) {
                    if (startCount === 0) {
                        this.dragDropService.setDraggable(item, false);
                    } else if (startCount > 0) {
                        this.dragDropService.setDraggable(item, true);
                    }
                }
            });
    }
    private itemCounter() {
        this.dragDropService
            .observeItemCounter()
            .pipe(takeUntil(this.destroy$))
            .subscribe((itemCount) => {
                if (itemCount === 0) {
                    this.itemService.updateItemStyles(itemCount === 0);
                } else if (itemCount > 0) {
                    this.itemService.updateItemStyles(itemCount === 0);
                    const item = document.getElementById(ItemId.Item7) as HTMLElement;
                    if (item) this.dragDropService.setDraggable(item, true);
                }
            });
    }
}
