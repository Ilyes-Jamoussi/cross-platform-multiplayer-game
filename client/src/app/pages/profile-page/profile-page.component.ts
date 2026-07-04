import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpStatusCode } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
    BACKGROUND_DEFAULT_ID,
    DEFAULT_OWNED_BACKGROUNDS,
    DEFAULT_OWNED_MUSICS,
    MUSIC_DEFAULT_ID,
    MUSIC_OFF_ID,
} from '@app/constants/cosmetics.constants';
import { MAX_AVATAR_UPLOAD_BYTES } from '@app/constants/profile.constants';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { Background, CosmeticsService, FeaturedAvatar, Music } from '@app/services/cosmetics/cosmetics.service';
import { MS_IN_SECOND, PADDED_SECONDS, SECONDS_IN_MINUTE, USERNAME_MAX_LENGTH } from '@common/constants';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-profile-page',
    imports: [AsyncPipe, FormsModule, DatePipe, TranslateModule, CoinIconComponent],
    templateUrl: './profile-page.component.html',
    styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit, OnDestroy {
    readonly musicOffId = MUSIC_OFF_ID;
    userProfile$ = this.authService.userProfile$;
    isEditingAvatar = false;
    selectedAvatar = '';
    uploadedAvatar = '';
    activeTab: 'avatars' | 'backgrounds' | 'musics' = 'backgrounds';

    isEditingUsername = false;
    isEditingEmail = false;
    editUsername = '';
    editEmail = '';
    usernameError = '';
    emailError = '';

    selectedBackgroundId = BACKGROUND_DEFAULT_ID;
    selectedMusicId = MUSIC_DEFAULT_ID;
    ownedBackgrounds: Background[] = [];
    ownedFeaturedAvatars: FeaturedAvatar[] = [];
    ownedMusics: Music[] = [];

    avatars: string[] = [
        'assets/account_avatar/avatar-1.png',
        'assets/account_avatar/avatar-2.png',
        'assets/account_avatar/avatar-3.png',
        'assets/account_avatar/avatar-4.png',
        'assets/account_avatar/avatar-5.png',
        'assets/account_avatar/avatar-6.png',
        'assets/account_avatar/avatar-7.png',
        'assets/account_avatar/avatar-8.png',
        'assets/account_avatar/avatar-9.png',
    ];

    private profileSub?: Subscription;

    constructor(
        private readonly alertService: AlertService,
        private readonly authService: AuthService,
        private readonly router: Router,
        private readonly cosmeticsService: CosmeticsService,
        private readonly translate: TranslateService,
    ) {}

    get totalGamesPlayed(): number {
        const profile = this.authService.currentUserProfile;
        return (profile?.gamesPlayedClassic || 0) + (profile?.gamesPlayedCTF || 0);
    }

    get averageGameTime(): string {
        const profile = this.authService.currentUserProfile;
        const total = this.totalGamesPlayed;
        if (!total || !profile?.totalGameTime) return '0m 00s';
        const avgMs = profile.totalGameTime / total;
        const totalSeconds = Math.floor(avgMs / MS_IN_SECOND);
        const minutes = Math.floor(totalSeconds / SECONDS_IN_MINUTE);
        const seconds = totalSeconds % SECONDS_IN_MINUTE;
        const paddedSeconds = seconds < PADDED_SECONDS ? `0${seconds}` : `${seconds}`;
        return `${minutes}m ${paddedSeconds}s`;
    }

    ngOnInit(): void {
        this.profileSub = this.authService.userProfile$.subscribe((profile) => {
            if (profile) {
                this.selectedBackgroundId = profile.selectedBackground || BACKGROUND_DEFAULT_ID;
                this.selectedMusicId = profile.selectedMusic || MUSIC_DEFAULT_ID;
                this.ownedBackgrounds = this.cosmeticsService.getOwnedBackgrounds(profile.ownedBackgrounds || DEFAULT_OWNED_BACKGROUNDS);
                this.ownedFeaturedAvatars = this.cosmeticsService.getOwnedAvatars(profile.ownedAvatars || []);
                this.ownedMusics = this.cosmeticsService.getOwnedMusics(profile.ownedMusics || DEFAULT_OWNED_MUSICS);
            }
        });
    }

    ngOnDestroy(): void {
        this.profileSub?.unsubscribe();
    }

    toggleEditUsername(currentUsername: string) {
        this.isEditingUsername = !this.isEditingUsername;
        this.editUsername = currentUsername;
        this.usernameError = '';
        if (this.isEditingUsername) {
            this.isEditingEmail = false;
            this.emailError = '';
        }
    }

    toggleEditEmail(currentEmail: string) {
        this.isEditingEmail = !this.isEditingEmail;
        this.editEmail = currentEmail;
        this.emailError = '';
        if (this.isEditingEmail) {
            this.isEditingUsername = false;
            this.usernameError = '';
        }
    }

    saveUsername() {
        const username = this.editUsername.trim();
        if (!username || username.length > USERNAME_MAX_LENGTH) {
            this.usernameError = this.translate.instant('profile_page.error_username_length');
            return;
        }
        this.authService.updateAccountMongoDB({ username }).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
                this.isEditingUsername = false;
                this.usernameError = '';
            },
            error: () => {
                this.usernameError = this.translate.instant('profile_page.error_username_taken');
            },
        });
    }

    saveEmail() {
        const email = this.editEmail.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!email || !emailRegex.test(email)) {
            this.emailError = this.translate.instant('profile_page.error_email_invalid');
            return;
        }
        this.authService.updateAccountMongoDB({ email }).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
                this.isEditingEmail = false;
                this.emailError = '';
            },
            error: (err) => {
                if (err?.status === HttpStatusCode.BadRequest) {
                    this.emailError = this.translate.instant('profile_page.error_email_invalid');
                } else {
                    this.emailError = this.translate.instant('profile_page.error_email_taken');
                }
            },
        });
    }

    selectBackground(bgId: string): void {
        this.cosmeticsService.setBackground(bgId);
    }

    selectMusic(musicId: string): void {
        this.cosmeticsService.setMusic(musicId);
    }

    getBackgroundPreview(background: Background): string {
        return this.cosmeticsService.getBackgroundStyle(background.id);
    }

    getAvatarIcon(avatar: FeaturedAvatar): string {
        return avatar.icon;
    }

    toggleEditAvatar(currentAvatar: string) {
        this.isEditingAvatar = !this.isEditingAvatar;
        if (this.isEditingAvatar) {
            if (currentAvatar.startsWith('data:')) {
                this.uploadedAvatar = currentAvatar;
                this.selectedAvatar = currentAvatar;
            } else {
                this.selectedAvatar = this.getAvatarPath(currentAvatar);
            }
            this.isEditingUsername = false;
            this.usernameError = '';
            this.isEditingEmail = false;
            this.emailError = '';
        } else {
            this.uploadedAvatar = '';
            this.selectedAvatar = '';
        }
    }

    getAvatarPath(avatarName: string): string {
        if (avatarName.includes('/')) {
            return avatarName;
        }
        return `assets/account_avatar/${avatarName}.png`;
    }

    saveAvatar() {
        const avatarToSave = this.selectedAvatar.startsWith('data:')
            ? this.selectedAvatar
            : this.selectedAvatar.split('/').pop()?.replace('.png', '') || 'avatar-1';

        this.authService.updateAccountMongoDB({ avatar: avatarToSave }).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
                this.isEditingAvatar = false;
            },
        });
    }

    async deleteAccount() {
        const confirmed = await this.alertService.confirm('popup.delete_account_title', 'popup.delete_account_message');
        if (!confirmed) return;

        this.authService.deleteAccount().subscribe({
            next: async () => {
                await this.authService.clearSessionAndSignOut();
                void this.router.navigate([Routes.Login]);
            },
            error: async () => {
                await this.authService.handleLogout();
                void this.router.navigate([Routes.Login]);
            },
        });
    }

    selectUploadedAvatar(): void {
        if (this.uploadedAvatar) {
            this.selectedAvatar = this.uploadedAvatar;
        }
    }

    onFileSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                this.uploadedAvatar = result;
                this.selectedAvatar = result;
            };
            reader.readAsDataURL(file);
        }
    }
}
