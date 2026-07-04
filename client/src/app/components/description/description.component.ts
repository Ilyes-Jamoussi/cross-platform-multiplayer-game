import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, HostListener, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { EditorService } from '@app/services/editor/editor.service';
import { Grid } from '@common/interfaces';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-description',
    imports: [FormsModule, TranslateModule, MatTooltip],
    templateUrl: './description.component.html',
    standalone: true,
    styleUrl: './description.component.scss',
})
export class DescriptionComponent implements OnInit {
    @Output() visibilityChange = new EventEmitter<boolean>();
    private _gameObject: Grid;

    constructor(
        private readonly alertService: AlertService,
        private readonly router: Router,
        private readonly editorService: EditorService,
    ) {}

    get gameObject() {
        return this._gameObject;
    }
    set gameObject(gameObject: Grid) {
        this._gameObject = gameObject;
    }

    @HostListener('document:keydown.enter', ['$event'])
    async onSubmit() {
        if (this.gameObject.name && this.gameObject.description) {
            try {
                await this.validate();
                await this.router.navigate([Routes.Admin]);
                sessionStorage.clear();
                this.alertService.showSuccess('popup.game_saved_title', 'popup.game_saved_message');
            } catch (error) {
                if (error instanceof HttpErrorResponse) {
                    if (error.error instanceof Array) {
                        const errors: string[] = [];
                        error.error.forEach((message) => errors.push(message + '\n'));
                        this.alertService.showInfo('popup.error_title', errors.join(''));
                        this.visibilityChange.emit(false);
                    } else if (error.error === 'Jeu non conforme') {
                        this.alertService.showInfo('popup.error_title', 'common.save_error_name_taken');
                    } else {
                        this.alertService.showInfo('popup.error_title', 'common.save_error_generic');
                    }
                }
            }
        } else {
            this.setColor();
        }
    }

    ngOnInit() {
        const game = sessionStorage.getItem('gameToEdit');
        if (game && game !== 'undefined') {
            this.gameObject = JSON.parse(game) as Grid;
            if (!this.gameObject.state) {
                this.gameObject.state = 'public';
            }
            if (!this.gameObject.nbActions) {
                this.gameObject.nbActions = 1;
            }
        }
    }

    reset(event: Event): void {
        if (event) {
            const input = event.target as HTMLElement;
            input.style.color = 'black';
            input.style.border = '5pt solid cornflowerblue';
        }
    }
    back() {
        this.visibilityChange.emit(false);
    }
    async validate() {
        this.gameObject.name = this.removeExtraSpaces(this.gameObject.name);
        this.gameObject.description = this.removeExtraSpaces(this.gameObject.description);
        if (!(this.gameObject.name && /\S/.test(this.gameObject.name)) || !(this.gameObject.description && /\S/.test(this.gameObject.description))) {
            this.alertService.showInfo('popup.error_title', 'common.name_desc_required');
            throw new Error();
        }
        await firstValueFrom(
            this._gameObject._id ? this.editorService.updateGame(this.gameObject) : this.editorService.validateAndAddMap(this.gameObject),
        );
    }
    private removeExtraSpaces(input: string): string {
        return input.replace(/\s{2,}/g, ' ').trim();
    }
    private setColor() {
        if (!this.gameObject.description) {
            const description = document.getElementById('description');
            if (description) {
                description.style.color = 'red';
                description.style.border = '5pt solid red';
            }
        }
        if (!this.gameObject.name) {
            const name = document.getElementById('name');
            if (name) {
                name.style.color = 'red';
                name.style.border = '5pt solid red';
            }
        }
    }
}
