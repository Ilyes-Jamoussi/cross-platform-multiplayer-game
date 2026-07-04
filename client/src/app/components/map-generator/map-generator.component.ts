import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DEFAULT_MAP_GENERATOR_ICE_PERCENT, DEFAULT_MAP_GENERATOR_WATER_PERCENT } from '@app/constants/map-editor.constants';
import { TranslateModule } from '@ngx-translate/core';
import { GameModes, GameSizes } from '@common/enums';

const PERCENTAGE_SCALE = 100;

export interface GeneratorParams {
    gridSize: number;
    gameMode: string;
    waterPercentage: number;
    icePercentage: number;
}

@Component({
    selector: 'app-map-generator',
    standalone: true,
    imports: [FormsModule, TranslateModule],
    templateUrl: './map-generator.component.html',
    styleUrls: ['./map-generator.component.scss'],
})
export class MapGeneratorComponent {
    @Input() gridSize: number = GameSizes.Small;
    @Input() gameMode: string = GameModes.Classic;
    @Input() isModalOpen: boolean = false;
    @Input() isGenerating: boolean = false;
    @Output() generate = new EventEmitter<GeneratorParams>();
    @Output() closeGenerator = new EventEmitter<void>();

    waterPercentage: number = DEFAULT_MAP_GENERATOR_WATER_PERCENT;
    icePercentage: number = DEFAULT_MAP_GENERATOR_ICE_PERCENT;

    sliderGradient(value: number, max: number): string {
        const pct = (value / max) * PERCENTAGE_SCALE;
        return `linear-gradient(to right, var(--app-secondary) ${pct}%, var(--app-secondary-disabled) ${pct}%)`;
    }

    onCloseModal(): void {
        this.closeGenerator.emit();
    }

    onGenerate(): void {
        const params: GeneratorParams = {
            gridSize: this.gridSize,
            gameMode: this.gameMode,
            waterPercentage: this.waterPercentage,
            icePercentage: this.icePercentage,
        };
        this.generate.emit(params);
    }
}
