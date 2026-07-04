import { Injectable } from '@angular/core';
import { GridGame } from '@app/classes/grid/grid';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { ItemService } from '@app/services/item/item.service';
import { INVALID_COORD, LEFT_CLICK_BUTTON, NON_TERRAIN_TILES, RIGHT_CLICK_BUTTON } from '@common/constants';
import { GameModes, ItemTypes, TileTypes } from '@common/enums';
import { BoardCell, Coords, DragStartEvent, Grid } from '@common/interfaces';
import { BehaviorSubject, map, Observable, take } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class GridService {
    grid$: Observable<BoardCell[][]>;
    private _game: GridGame;
    private _objectGrid: Grid;
    private _initialBoard: BoardCell[][] | null = null;
    private _initialBoardSet = false;
    private _draggedItemCoords: number[] = [INVALID_COORD, INVALID_COORD];
    private _isDeleting: boolean = false;
    private _isDragging: boolean = false;
    private _isMoving: boolean = false;
    private _isTooltipVisible: boolean = false;
    private _hoveredTile: HTMLElement | null = null;
    private _clickedTile: TileTypes = TileTypes.Ice;
    private readonly _gridSubject: BehaviorSubject<BoardCell[][]>;
    constructor(
        private readonly dragDropService: DragDropService,
        private readonly itemService: ItemService,
    ) {
        this._gridSubject = new BehaviorSubject<BoardCell[][]>([]);
        this.grid$ = this._gridSubject.asObservable();
    }
    get game(): GridGame {
        return this._game;
    }
    get draggedItemCoords(): number[] {
        return this._draggedItemCoords;
    }
    get objectGrid() {
        return this._objectGrid;
    }
    get clickedTile(): TileTypes {
        return this._clickedTile;
    }
    get gridSubject(): BehaviorSubject<BoardCell[][]> {
        return this._gridSubject;
    }
    get isDragging() {
        return this._isDragging;
    }
    get isDeleting() {
        return this._isDeleting;
    }
    get isMoving() {
        return this._isMoving;
    }
    get isTooltipVisible() {
        return this._isTooltipVisible;
    }
    set isDeleting(value: boolean) {
        this._isDeleting = value;
    }
    set isMoving(value: boolean) {
        this._isMoving = value;
    }
    set clickedTile(value: TileTypes) {
        this._clickedTile = value;
    }
    set isDragging(value: boolean) {
        this._isDragging = value;
    }
    set draggedItemCoords(value: number[]) {
        this._draggedItemCoords = value;
    }
    onMouseMove(event: MouseEvent) {
        if (!this._isDragging) return;
        this._isMoving = true;
        const target = (event.target as HTMLElement).closest('.tile') as HTMLElement;
        if (target && !target.id.includes(ItemTypes.Item)) {
            const coords = this.getCoords(target);
            if (coords) {
                this.onMouseMoveUpdater(event, coords);
            }
        }
        event.preventDefault();
    }
    onDragEnd(event: DragEvent) {
        this.clearTileHighlight();
        this.clearSourceTileHover();
        this.dragDropService.onDragEnd(event);
        this._isTooltipVisible = false;
    }
    onMouseUp(event: MouseEvent, coords?: Coords) {
        if (coords && this._isDeleting && !this._isMoving && event.button === RIGHT_CLICK_BUTTON) {
            this.updateItem(coords);
        }
        this._isDeleting = false;
        this._isDragging = false;
        this._isMoving = false;
        event.preventDefault();
    }
    onContextMenu(event: MouseEvent) {
        event.preventDefault();
    }
    onMouseDown(event: MouseEvent, coords?: Coords) {
        if (!this.setBooleans(event.button)) return;
        const eventTarget = event.target as HTMLElement;
        if (eventTarget.closest('.center-content')) {
            if (coords) {
                this.onMouseDownUpdater(coords);
            }
            event.preventDefault();
        }
    }
    allowDrop(event: DragEvent) {
        const target = event.target as HTMLElement;
        const tile = target.parentElement as HTMLElement;
        const isInvalid = NON_TERRAIN_TILES.includes(target.id as TileTypes) || (tile && tile.childElementCount > 1);

        if (tile && tile.classList.contains('tile') && tile !== this._hoveredTile) {
            this.clearTileHighlight();
            this._hoveredTile = tile;
            tile.classList.add(isInvalid ? 'drag-invalid' : 'drag-valid');
        }

        if (!isInvalid) {
            event.preventDefault();
        }
    }
    onDragLeave(event: DragEvent): void {
        const tile = (event.target as HTMLElement).parentElement as HTMLElement;
        if (tile && !tile.contains(event.relatedTarget as HTMLElement)) {
            tile.classList.remove('drag-valid', 'drag-invalid');
            if (this._hoveredTile === tile) this._hoveredTile = null;
        }
    }
    onDragStart(dragStartEvent: DragStartEvent): void {
        this.dragDropService.onDragStart(dragStartEvent.event, dragStartEvent.item, dragStartEvent.description);
        this._draggedItemCoords = [dragStartEvent.coords.row, dragStartEvent.coords.col];
        this._isDragging = false;
        this._isTooltipVisible = true;
    }
    onDrop(event: DragEvent) {
        this.clearTileHighlight();
        this.clearSourceTileHover();
        this.dragDropService.setIsDragging(false);
        this.isDragging = false;
        const data = event.dataTransfer?.getData('text')?.split(',') ?? [];
        const target = (event.target as HTMLElement).parentElement as HTMLElement;
        if (data[0] && target.classList.contains('tile')) {
            const coords = this.getCoords(target);
            if (coords) this.onDropUpdater(data[0], data[1] ?? '', coords);
        }
        this._isTooltipVisible = false;
    }
    createNewGrid(grid: BoardCell[][]): BoardCell[][] {
        this.dragDropService.setItemCounter(+this.objectGrid.gridSize);
        for (const row of grid) {
            for (const tile of row) {
                if (tile.item.name !== '') {
                    setTimeout(() => {
                        const item = this.getElement(tile.item.name);
                        if (item) {
                            this.dragDropService.setDraggable(item, false);
                            this.dragDropService.decrementObject(item);
                        }
                    }, 0);
                }
            }
        }
        return grid.map((row) =>
            row.map((tile) => ({
                tile: tile.tile,
                item: { ...tile.item },
            })),
        );
    }
    init() {
        const objectGrid = sessionStorage.getItem('gameToEdit');
        if (objectGrid && objectGrid !== 'undefined') {
            this._objectGrid = JSON.parse(objectGrid) as Grid;
            this._game = new GridGame(this._objectGrid.board ?? +this._objectGrid.gridSize, this._objectGrid.gameMode as GameModes);
            if (!this._initialBoardSet) {
                this._initialBoard = this._objectGrid.board ? JSON.parse(JSON.stringify(this._objectGrid.board)) : null;
                this._initialBoardSet = true;
            }
        }
        const newGrid = this.createNewGrid(this._game.grid);
        this._gridSubject.next(newGrid);
    }
    clearInitialBoard() {
        this._initialBoard = null;
        this._initialBoardSet = false;
    }
    resetGrid() {
        this._isDeleting = true;
        this._isMoving = false;

        this.grid$.pipe(take(1)).subscribe((grid) => {
            for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
                const row = grid[rowIndex];
                for (let colIndex = 0; colIndex < row.length; colIndex++) {
                    const tile = row[colIndex].item.name;
                    if (tile.includes(ItemTypes.Item)) {
                        this.updateItem({ row: rowIndex, col: colIndex });
                    }
                }
            }

            if (this._initialBoard) {
                this._game = new GridGame(JSON.parse(JSON.stringify(this._initialBoard)), this._objectGrid.gameMode as GameModes);
            } else {
                this._game = new GridGame(+this._objectGrid.gridSize, this._objectGrid.gameMode as GameModes);
            }

            const newGrid = this.createNewGrid(this._game.grid);
            this._gridSubject.next(newGrid);
        });

        this._isDeleting = false;
    }
    getItem(coords: Coords): string {
        return this._gridSubject.getValue()[coords.row][coords.col].item.name;
    }
    dropDeleteItem() {
        this._isDeleting = true;
        this._isMoving = false;
        this.updateItem({ row: this._draggedItemCoords[0], col: this._draggedItemCoords[1] });
        this._isDeleting = false;
    }

    private updateItem(coords: Coords) {
        this.grid$.pipe(take(1)).subscribe((grid) => {
            const id = this.itemService.getItemId(this.getItem(coords)?.replace('tile-', ''));
            const item = id ? document.getElementById(id) : null;
            if (this._isDeleting && item && !this._isMoving) {
                this.dragDropService.setDraggable(item, true);
                this.itemDeleteHelper(grid, item, coords);
            }
            this._gridSubject.next(grid);
        });
    }
    private toggleDoor(cell: TileTypes) {
        if (cell !== TileTypes.Door && this._clickedTile === TileTypes.Door && !this._isMoving) {
            return TileTypes.Door;
        } else if (cell === TileTypes.Door && !this._isMoving) {
            return TileTypes.OpenedDoor;
        } else if (cell === TileTypes.OpenedDoor) {
            return TileTypes.Door;
        }
        return cell;
    }
    private getElement(id: string) {
        const baseId = this.itemService.getItemId(id);
        return document.getElementById(baseId);
    }
    private updateTile(coords: Coords) {
        this.grid$.pipe(take(1)).subscribe((grid) => {
            let cell = grid[coords.row][coords.col].tile;
            if (!this._isDeleting) {
                if (this.clickedTile === TileTypes.Door && !this._isMoving) {
                    cell = this.toggleDoor(cell);
                } else if (this.clickedTile) {
                    cell = this.clickedTile;
                }
            } else {
                cell = TileTypes.Default;
            }

            grid[coords.row][coords.col].tile = cell;
            this._gridSubject.next(grid);
        });
    }
    private handleTileUpdate(coords: Coords, existingItem?: HTMLElement) {
        if (!existingItem) return;
        this.grid$.pipe(take(1)).subscribe((grid) => {
            if (!this._isDeleting) {
                if (NON_TERRAIN_TILES.includes(this._clickedTile)) {
                    this.dragDropService.setDraggable(existingItem, true);
                    if (grid[coords.row][coords.col]) this.itemDeleteHelper(grid, existingItem, coords);
                }
                if (NON_TERRAIN_TILES.includes(this._clickedTile) || this._clickedTile !== TileTypes.Default) {
                    this.updateTile(coords);
                }
            }
            this._gridSubject.next(grid);
        });
    }
    private clearTileHighlight(): void {
        if (this._hoveredTile) {
            this._hoveredTile.classList.remove('drag-valid', 'drag-invalid');
            this._hoveredTile = null;
        }
    }
    private clearSourceTileHover(): void {
        const [row, col] = this._draggedItemCoords;
        if (row === INVALID_COORD || col === INVALID_COORD) return;
        document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`)?.classList.remove('tile-hovered');
    }
    private itemDeleteHelper(grid: BoardCell[][], item: HTMLElement, coords: Coords) {
        grid[coords.row][coords.col].item = { name: '', description: '' };
        this.dragDropService.incrementObject(item);
    }
    private getCoords(target: HTMLElement): Coords | undefined {
        const { row, col } = target.dataset;
        return row && col ? { row: +row, col: +col } : undefined;
    }
    private setBooleans(button: number) {
        this._isDeleting = button === RIGHT_CLICK_BUTTON;
        this._isDragging = (button === LEFT_CLICK_BUTTON && this._clickedTile !== TileTypes.Default) || button === RIGHT_CLICK_BUTTON;
        return this._isDragging;
    }
    private onDropUpdater(item: string, itemDescription: string, coords: Coords) {
        this.grid$
            .pipe(
                take(1),
                map((grid) => {
                    if (item) {
                        item = this.dragDropService.giveItemId(item, grid);
                        this.onDropHelper(item, coords, grid);
                    }
                    grid[coords.row][coords.col].item.description = itemDescription;
                }),
            )
            .subscribe();
    }
    private onMouseDownUpdater(coords: Coords) {
        this.grid$.pipe(take(1)).subscribe((grid) => {
            if (grid[coords.row][coords.col].item.name.includes(ItemTypes.Item)) {
                this.handleTileUpdate(coords, this.getElement(grid[coords.row][coords.col].item.name) as HTMLElement);
                this._gridSubject.next(grid);
            } else {
                this.updateTile(coords);
            }
        });
    }
    private onMouseMoveUpdater(event: MouseEvent, coords: Coords) {
        this.grid$.pipe(take(1)).subscribe((grid) => {
            const itemName = grid[coords.row][coords.col].item.name;
            if (itemName.includes(ItemTypes.Item)) {
                this.handleTileUpdate(coords, document.getElementById(this.itemService.getItemId(itemName)) as HTMLElement);
            }
            this.updateTile(coords);
            event.preventDefault();
        });
    }
    private onDropHelper(item: string, coords: Coords, newGrid: BoardCell[][]) {
        if (item?.includes('tile-')) {
            const [srcRow, srcCol] = this._draggedItemCoords;
            if ((coords.row !== srcRow || coords.col !== srcCol) && newGrid[srcRow]?.[srcCol]) {
                newGrid[srcRow][srcCol].item = { name: '', description: '' };
            }
        }
        if (item) newGrid[coords.row][coords.col].item.name = item.replace('tile-', '');
    }
}
