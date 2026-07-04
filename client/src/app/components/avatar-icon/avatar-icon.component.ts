import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlayerService } from '@app/services/player/player.service';
import { Avatar, AVATARS } from '@common/avatar';

import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-avatar-icon',
    imports: [CoinIconComponent],
    standalone: true,
    templateUrl: './avatar-icon.component.html',
    styleUrl: './avatar-icon.component.scss',
})
export class AvatarIconComponent {
    @Input() avatar: Avatar = AVATARS[0];
    @Input() isAvailable: boolean = true;
    @Input() isLocked: boolean = false;
    @Input() isSelected: boolean = false;

    @Output() selected = new EventEmitter<void>();

    constructor(private readonly playerService: PlayerService) {}

    get isClickable(): boolean {
        return this.isAvailable && !this.isLocked;
    }

    onSelect(): void {
        if (!this.isClickable) return;
        this.playerService.player.avatar = this.avatar.name;
        this.selected.emit();
    }
}
