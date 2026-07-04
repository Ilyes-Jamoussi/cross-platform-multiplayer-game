import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Routes } from '@app/enums/routes-enums';
import { GameModes, GameSizes } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-map-settings',
    standalone: true,
    templateUrl: './map-settings.component.html',
    styleUrls: ['./map-settings.component.scss'],
    imports: [FormsModule, MatTooltip, TranslateModule],
})
export class MapSettingsComponent {
    readonly gameModes = GameModes;
    readonly gameSizes = GameSizes;

    gameMode: string = GameModes.Classic;
    mapSize: number = GameSizes.Small;

    constructor(private readonly router: Router) {}

    @HostListener('document:keydown.enter', ['$event'])
    onSubmit() {
        sessionStorage.clear();
        const gameToEdit = { gridSize: this.mapSize, gameMode: this.gameMode, state: 'public', nbActions: 1 };
        sessionStorage.setItem('gameToEdit', JSON.stringify(gameToEdit));
        void this.router.navigate([Routes.MapEditor]);
    }
}
