import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid-service/grid-service.service';
import { PRELOAD_TILES, TILE_DESCRIPTIONS, TILE_IMAGES, TILE_NAMES, TILES } from '@common/constants';
import { TileTypes } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-tile-bar',
    standalone: true,
    templateUrl: './tile-bar.component.html',
    styleUrls: ['./tile-bar.component.scss'],
    imports: [CommonModule, MatTooltip, MatTooltipModule, TranslateModule],
})
export class TileBarComponent implements OnInit, OnDestroy {
    readonly tiles = TILES.filter((tile) => !PRELOAD_TILES.includes(tile));
    readonly preloadTiles = PRELOAD_TILES;
    readonly tileDescriptions = TILE_DESCRIPTIONS;
    readonly tileNames = TILE_NAMES;
    private _currentTileDescription = '';
    private readonly destroy$ = new Subject<void>();

    constructor(
        private readonly dragDropService: DragDropService,
        private readonly gridService: GridService,
    ) {}
    get currentTileDescription() {
        return this._currentTileDescription;
    }
    set currentTileDescription(value: string) {
        this._currentTileDescription = value;
    }
    ngOnInit() {
        this.dragDropService.isDragging$.pipe(takeUntil(this.destroy$)).subscribe((isDragging) => {
            if (isDragging) {
                this._currentTileDescription = '';
            }
            this.gridService.clickedTile = TileTypes.Default;
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    getTileImage(tile: TileTypes): string {
        return TILE_IMAGES.get(tile) as string;
    }

    onClick(tile: TileTypes) {
        if (this._currentTileDescription !== tile) {
            this._currentTileDescription = tile;
            this.gridService.clickedTile = tile;
        } else {
            this._currentTileDescription = '';
            this.gridService.clickedTile = TileTypes.Default;
        }
    }
}
