import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '@app/services/player/player.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-player-name-selection',
    imports: [FormsModule, TranslateModule],
    standalone: true,
    templateUrl: './player-name-selection.component.html',
    styleUrl: './player-name-selection.component.scss',
})
export class PlayerNameSelectionComponent {
    @Input() isVisible: boolean = true;
    @Output() isVisibleChange = new EventEmitter<boolean>();
    backGround: string = 'assets/creation_cards_back_ground.png';
    username: string = '';

    constructor(private readonly playerService: PlayerService) {}

    validateUsername(): boolean {
        return Boolean(this.username.trim());
    }

    xButtonClick() {
        this.isVisible = false;
        this.isVisibleChange.emit(this.isVisible);
    }
    validateButtonClick() {
        this.isVisible = false;
        this.isVisibleChange.emit(this.isVisible);

        void this.playerService.validatePlayerAndJoin(this.username);
    }

    preventEnter(event: Event): void {
        const keyboardEvent = event as KeyboardEvent;
        if (!this.validateUsername() && keyboardEvent.key === 'Enter') {
            event.preventDefault();
        }
    }
}
