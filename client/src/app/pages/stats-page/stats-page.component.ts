import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AvatarIconComponent } from '@app/components/avatar-icon/avatar-icon.component';
import { CharacterStatsComponent } from '@app/components/character-stats/character-stats.component';
import { PlayerNameSelectionComponent } from '@app/components/player-name-selection/player-name-selection.component';
import { Routes } from '@app/enums/routes-enums';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { CosmeticsService } from '@app/services/cosmetics/cosmetics.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { Avatar, AVATARS } from '@common/avatar';
import { GameRoomEvents } from '@common/gateway-events';
import { SelectedAvatars } from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-stats-page',
    imports: [CommonModule, AvatarIconComponent, CharacterStatsComponent, PlayerNameSelectionComponent, MatTooltip, TranslateModule],
    standalone: true,
    templateUrl: './stats-page.component.html',
    styleUrl: './stats-page.component.scss',
})
export class StatsPageComponent implements OnInit, OnDestroy {
    @Input() selectedAvatar: Avatar;
    @ViewChild(CharacterStatsComponent) private readonly characterStats: CharacterStatsComponent;
    avatars = AVATARS.map((avatar) => ({ ...avatar, isAvailable: true }));
    isValid: boolean = false;
    showUsernameInput: boolean = false;
    userOwnedAvatars: string[] = [];
    accountUsername?: string;
    private currentPlayerAvatar: string;
    private initialSelectionMade = false;
    private attemptedJoin = false;
    private roomId: string;
    private readonly http = inject(HttpClient);
    constructor(
        private readonly playerService: PlayerService,
        private readonly socketService: SocketService,
        private readonly router: Router,
        private readonly authService: AuthService,
        private readonly cosmeticsService: CosmeticsService,
        private readonly translate: TranslateService,
    ) {}

    ngOnInit(): void {
        if (this.playerService.roomId !== '' && this.playerService.player.name === '') {
            this.authService.userProfile$.subscribe((profile) => {
                if (profile) {
                    this.userOwnedAvatars = profile.ownedAvatars || [];
                    this.accountUsername = profile.username;
                }
            });
            this.roomId = this.playerService.roomId;
            this.setupRoomUpdateListener();
            this.playerService.updateAvatars();
        } else {
            void this.router.navigate([Routes.Home]).then(() => this.socketService.disconnect());
        }
    }

    ngOnDestroy() {
        if (!this.attemptedJoin) {
            this.http.post(`${environment.serverUrl}/game-room/leaveRoom`, { roomId: this.roomId }).subscribe();
        }
        this.socketService.off(GameRoomEvents.AvatarUpdate);
    }

    getValidateTooltip(): string {
        const keys: string[] = [];
        if (!this.characterStats?.isLifeOrSpeedMax()) keys.push('character_stats_page.tooltip.life_speed');
        if (!this.characterStats?.isAttackOrDefenseMax()) keys.push('character_stats_page.tooltip.attack_defense');
        return keys.map((key) => '\u2022 ' + this.translate.instant(key)).join('\n');
    }

    onIsValidChange(isValid: boolean) {
        this.isValid = isValid;
    }

    validateStats() {
        if (!this.isValid) return;

        if (this.accountUsername && this.accountUsername.trim()) {
            void this.playerService.validatePlayerAndJoin(this.accountUsername);
        } else {
            this.showUsernameInput = true;
        }
    }

    onUsernameVisibilityChange(isVisible: boolean) {
        this.showUsernameInput = isVisible;
    }

    onAvatarSelected(avatar: Avatar) {
        this.socketService.sendMessage(GameRoomEvents.AvatarUpdate, {
            roomId: this.playerService.roomId,
            nextAvatar: avatar.name,
        });
        this.currentPlayerAvatar = avatar.name;
        this.selectedAvatar = avatar;
    }

    isAvailable(avatar: Avatar): boolean {
        if (avatar.name === this.currentPlayerAvatar) return true;

        const foundAvatar = this.avatars.find((avt) => avt.name === avatar.name);
        return foundAvatar ? foundAvatar.isAvailable : false;
    }

    isLocked(avatar: Avatar): boolean {
        const featuredAvatars = this.cosmeticsService.getShopAvatars();
        const isFeatured = featuredAvatars.some((featuredAvatar) => featuredAvatar.name === avatar.name);
        return isFeatured && !this.userOwnedAvatars.includes(avatar.name);
    }

    private setupRoomUpdateListener() {
        this.socketService.on<SelectedAvatars>(GameRoomEvents.AvatarUpdate, (data) => {
            this.updateAvatarsAvailability(data.selectedAvatars);

            if (!this.initialSelectionMade) {
                this.makeInitialSelection();
                this.initialSelectionMade = true;
            } else {
                this.selectFirstAvailableAvatar();
            }
        });
    }

    private makeInitialSelection() {
        const availableAvatar = this.avatars.find((avatar) => avatar.isAvailable && !this.isLocked(avatar)) || AVATARS[0];
        this.selectedAvatar = availableAvatar;
        this.currentPlayerAvatar = availableAvatar.name;
        this.playerService.player.avatar = this.currentPlayerAvatar;
        this.socketService.sendMessage(GameRoomEvents.AvatarUpdate, {
            roomId: this.playerService.roomId,
            nextAvatar: this.currentPlayerAvatar,
        });
    }

    private updateAvatarsAvailability(selectedAvatars: string[]) {
        this.avatars.forEach((avatar) => {
            if (avatar.name === this.currentPlayerAvatar) {
                avatar.isAvailable = true;
            } else {
                avatar.isAvailable = !selectedAvatars.includes(avatar.name);
            }
        });
    }

    private selectFirstAvailableAvatar() {
        if (!this.isAvailable(this.selectedAvatar) || this.isLocked(this.selectedAvatar)) {
            const newAvatar = this.avatars.find((avatar) => this.isAvailable(avatar) && !this.isLocked(avatar)) || AVATARS[0];
            if (newAvatar.name !== this.selectedAvatar.name) {
                this.onAvatarSelected(newAvatar);
            }
        }
    }
}
