import { Component } from '@angular/core';
import { MapSettingsComponent } from '@app/components/map-settings/map-settings.component';

@Component({
    selector: 'app-editor-creation-page',
    templateUrl: './editor-creator-page.component.html',
    styleUrls: ['./editor-creator-page.component.scss'],
    imports: [MapSettingsComponent],
    standalone: true,
})
export class EditorCreatorPageComponent {}
