import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { Game } from '@common/types';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-game-card',
    templateUrl: './game-card.component.html',
    styleUrls: ['./game-card.component.scss'],
    standalone: true,
    imports: [MatTooltip, MatTooltipModule, CommonModule, TranslateModule],
})
export class GameCardComponent {
    @Input() game: Game;
    @Input() isOwner: boolean = false;
    @Input() canEdit: boolean = false;
    @Input() canDelete: boolean = false;
    @Input() canDuplicate: boolean = false;

    @Output() edit = new EventEmitter<void>();
    @Output() stateChange = new EventEmitter<string>();
    @Output() duplicate = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();

    onEdit() {
        this.edit.emit();
    }

    onStateSelect(newState: string) {
        if (this.isOwner && newState !== this.game.state) {
            this.stateChange.emit(newState);
        }
    }

    onDuplicate() {
        this.duplicate.emit();
    }

    onDelete() {
        this.delete.emit();
    }
}
