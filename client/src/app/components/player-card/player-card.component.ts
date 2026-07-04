import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlayerService } from '@app/services/player/player.service';
import { AVATARS } from '@common/avatar';
import { VirtualPlayerTypes } from '@common/enums';
import { Player } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-player-card',
    templateUrl: './player-card.component.html',
    styleUrls: ['./player-card.component.scss'],
    standalone: true,
    imports: [CommonModule, TranslateModule],
})
export class PlayerCardComponent {
    @Input() player: Player;
    @Output() kick = new EventEmitter<void>();

    virtualPlayerTypes = VirtualPlayerTypes;

    constructor(private readonly playerService: PlayerService) {}

    getIcon() {
        const matchingAvatar = AVATARS.find((avatar) => avatar.name === this.player.avatar);
        return matchingAvatar ? matchingAvatar.image : undefined;
    }
    isHost() {
        return this.playerService.player.isHost;
    }
    isCurrentUser() {
        return this.player.name === this.playerService.player.name;
    }
}
