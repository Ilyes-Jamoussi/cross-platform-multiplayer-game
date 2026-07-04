import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
    BLANK_IMAGE_SRC,
    DRAG_DISABLED_OPACITY,
    DRAG_GHOST_BORDER_RADIUS,
    DRAG_GHOST_OPACITY,
    DRAG_GHOST_Z_INDEX,
    OFFSCREEN_POSITION,
} from '@common/constants';
import { ItemCounts, GameSizes, ItemId } from '@common/enums';
import { BoardCell } from '@common/interfaces';
import { generateUniqueItemId } from '@common/shared-utils';

@Injectable({
    providedIn: 'root',
})
export class DragDropService {
    private readonly isDragging: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private readonly _isDragging$ = this.isDragging.asObservable();
    private readonly itemCounter: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    private readonly startCounter: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    private ghostElement: HTMLImageElement | null = null;
    private ghostMoveHandler: ((e: DragEvent) => void) | null = null;
    private ghostPointerUpHandler: (() => void) | null = null;

    get isDragging$() {
        return this._isDragging$;
    }
    getIsDragging() {
        return this.isDragging.value;
    }
    setIsDragging(isDragging: boolean): void {
        if (!isDragging) {
            this.removeGhost();
        }
        this.isDragging.next(isDragging);
    }
    incrementObject(item: HTMLElement): void {
        if (item.id.includes(ItemId.ItemStartingPoint)) {
            this.incrementStartCounter();
        } else if (/\d/.test(item.id)) {
            this.incrementItemCounter();
        }
    }
    decrementObject(item: HTMLElement) {
        if (item.id.includes(ItemId.ItemStartingPoint)) {
            this.decrementStartCounter();
        } else if (/\d/.test(item.id)) {
            this.decrementItemCounter();
        }
    }
    observeItemCounter(): BehaviorSubject<number> {
        return this.itemCounter;
    }

    observeStartCounter(): BehaviorSubject<number> {
        return this.startCounter;
    }

    setItemCounter(value: number): void {
        let itemCount: number;
        switch (value) {
            case GameSizes.Small:
                itemCount = ItemCounts.SmallItem;
                break;
            case GameSizes.Medium:
                itemCount = ItemCounts.MediumItem;
                break;
            case GameSizes.Big:
                itemCount = ItemCounts.BigItem;
                break;
            default:
                itemCount = ItemCounts.MediumItem;
        }
        this.startCounter.next(itemCount);
        this.itemCounter.next(itemCount);
    }

    onDragStart(event: DragEvent, item: string, itemDescription: string): void {
        this.setIsDragging(true);
        event.dataTransfer?.setData('text', item + ',' + itemDescription);

        const target = event.target as HTMLImageElement;

        if (target) {
            this.setDraggable(target, false);

            const rect = target.getBoundingClientRect();
            this.createGhost(target.src, rect.width, rect.height);

            const blank = new Image();
            blank.src = BLANK_IMAGE_SRC;
            blank.style.position = 'fixed';
            blank.style.left = OFFSCREEN_POSITION;
            document.body.appendChild(blank);
            event.dataTransfer?.setDragImage(blank, 0, 0);
            setTimeout(() => blank.remove(), 0);
        }
    }

    onDragEnd(event: DragEvent) {
        this.removeGhost();

        const draggedItem = event.target as HTMLElement;
        const didNotDrop = this.getIsDragging();
        if (didNotDrop) {
            if (draggedItem) {
                this.setDraggable(draggedItem, true);
            }
        } else if (/\d/.test(draggedItem.id)) {
            this.itemCounter.next(this.itemCounter.value - 1);
        } else if (draggedItem.id.includes(ItemId.ItemStartingPoint)) {
            this.startCounter.next(this.startCounter.value - 1);
        }
        this.setIsDragging(false);
        event.preventDefault();
        if (draggedItem?.parentElement?.classList.contains('item-container')) {
            this.setDraggable(draggedItem, true);
        } else if (draggedItem?.parentElement?.classList.contains('tile')) {
            this.setDraggable(draggedItem, true);
            event.preventDefault();
        }

        event.stopImmediatePropagation();
    }

    setDraggable(draggedItem: HTMLElement, draggable: boolean) {
        if (draggable) {
            draggedItem.style.opacity = '1';
            draggedItem.draggable = true;
            draggedItem.style.cursor = 'grab';
        } else {
            draggedItem.style.opacity = DRAG_DISABLED_OPACITY;
            draggedItem.draggable = false;
            draggedItem.style.cursor = 'default';
        }
    }

    giveItemId(id: string, grid: BoardCell[][]) {
        if (id === ItemId.Item7 || id === ItemId.ItemStartingPoint) {
            return generateUniqueItemId(id, grid);
        }
        return id;
    }
    incrementItemCounter(): void {
        this.itemCounter.next(this.itemCounter.value + 1);
    }
    incrementStartCounter(): void {
        this.startCounter.next(this.startCounter.value + 1);
    }
    private decrementItemCounter(): void {
        this.itemCounter.next(this.itemCounter.value - 1);
    }
    private decrementStartCounter(): void {
        this.startCounter.next(this.startCounter.value - 1);
    }
    private createGhost(src: string, width: number, height: number): void {
        this.removeGhost();

        const ghost = document.createElement('img');
        ghost.src = src;
        ghost.style.position = 'fixed';
        ghost.style.width = `${width}px`;
        ghost.style.height = `${height}px`;
        ghost.style.opacity = DRAG_GHOST_OPACITY;
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = DRAG_GHOST_Z_INDEX;
        ghost.style.transform = 'translate(-50%, -50%)';
        ghost.style.borderRadius = DRAG_GHOST_BORDER_RADIUS;
        ghost.style.left = OFFSCREEN_POSITION;
        ghost.style.top = OFFSCREEN_POSITION;
        document.body.appendChild(ghost);
        this.ghostElement = ghost;

        this.ghostMoveHandler = (event: DragEvent) => {
            if (this.ghostElement) {
                this.ghostElement.style.left = `${event.clientX}px`;
                this.ghostElement.style.top = `${event.clientY}px`;
            }
        };
        document.addEventListener('dragover', this.ghostMoveHandler);

        this.ghostPointerUpHandler = () => {
            this.removeGhost();
        };
        document.addEventListener('pointerup', this.ghostPointerUpHandler, { once: true });
    }
    private removeGhost(): void {
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
        if (this.ghostMoveHandler) {
            document.removeEventListener('dragover', this.ghostMoveHandler);
            this.ghostMoveHandler = null;
        }
        if (this.ghostPointerUpHandler) {
            document.removeEventListener('pointerup', this.ghostPointerUpHandler);
            this.ghostPointerUpHandler = null;
        }
    }
}
