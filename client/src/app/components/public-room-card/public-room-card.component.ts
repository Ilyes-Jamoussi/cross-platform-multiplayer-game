import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicRoomInfo } from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-public-room-card',
    standalone: true,
    imports: [CommonModule, CoinIconComponent, TranslateModule],
    templateUrl: './public-room-card.component.html',
    styleUrl: './public-room-card.component.scss',
})
export class PublicRoomCardComponent {
    @Input() room!: PublicRoomInfo;
    @Output() join = new EventEmitter<PublicRoomInfo>();

    playersIcon = 'assets/players.png';

    constructor(private readonly translate: TranslateService) {}

    get status(): string {
        return this.room.hasGameStarted ? this.translate.instant('public_room.in_progress') : this.translate.instant('public_room.waiting');
    }

    get accessibility(): string {
        return this.room.isOpenToMorePlayers ? this.translate.instant('public_room.open') : this.translate.instant('public_room.closed');
    }

    joinRoom() {
        if (!this.room.isOpenToMorePlayers) return;
        this.join.emit(this.room);
    }
}
