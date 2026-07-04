import { Component } from '@angular/core';
import { DescriptionComponent } from '@app/components/description/description.component';
import { GameGridComponent } from '@app/components/game-grid/game-grid.component';
import { ItemBarComponent } from '@app/components/item-bar/item-bar.component';
import { TileBarComponent } from '@app/components/tile-bar/tile-bar.component';
import { MapGeneratorComponent, GeneratorParams } from '@app/components/map-generator/map-generator.component';
import { AlertService } from '@app/services/alert/alert.service';
import { BoardGeneratorService } from '@app/services/board-generator/board-generator.service';
import { GridService } from '@app/services/grid-service/grid-service.service';
import { GameModes, GameSizes } from '@common/enums';

@Component({
    selector: 'app-game-page',
    templateUrl: './editor-page.component.html',
    styleUrls: ['./editor-page.component.scss'],
    imports: [DescriptionComponent, TileBarComponent, ItemBarComponent, GameGridComponent, MapGeneratorComponent],
    standalone: true,
})
export class EditorPageComponent {
    isSaving: boolean = false;
    showGeneratorModal: boolean = false;
    isGenerating: boolean = false;
    gridSize: number = GameSizes.Small;
    gameMode: string = GameModes.Classic;

    constructor(
        private readonly gridService: GridService,
        private readonly boardGeneratorService: BoardGeneratorService,
        private readonly alertService: AlertService,
    ) {
        this.gridService.clearInitialBoard();
        this.loadGameSettings();
    }

    onMouseMove(event: MouseEvent) {
        this.gridService.onMouseMove(event);
    }

    onDragEnd(event: DragEvent) {
        this.gridService.onDragEnd(event);
    }

    onContextMenu(event: MouseEvent) {
        this.gridService.onContextMenu(event);
    }

    onMouseUp(event: MouseEvent) {
        this.gridService.onMouseUp(event);
    }

    onMouseDown(event: MouseEvent) {
        this.gridService.onMouseDown(event);
    }

    toggleIsSaving(newValue: boolean) {
        this.isSaving = newValue;
    }

    openGeneratorModal(): void {
        this.showGeneratorModal = true;
    }

    closeGeneratorModal(): void {
        this.showGeneratorModal = false;
    }

    onGenerateGrid(params: GeneratorParams): void {
        this.isGenerating = true;
        this.boardGeneratorService.generateGrid(params).subscribe({
            next: (grid) => {
                this.gridService.game.grid = grid;
                const processedGrid = this.gridService.createNewGrid(grid);
                this.gridService.gridSubject.next(processedGrid);
                this.closeGeneratorModal();
                this.isGenerating = false;
            },
            error: () => {
                this.alertService.showInfo('popup.error_title', 'map_generator.error');
                this.isGenerating = false;
            },
        });
    }

    private loadGameSettings(): void {
        const gameToEdit = sessionStorage.getItem('gameToEdit');
        if (gameToEdit) {
            const settings = JSON.parse(gameToEdit);
            this.gridSize = settings.gridSize || GameSizes.Small;
            this.gameMode = settings.gameMode || GameModes.Classic;
        }
    }
}
