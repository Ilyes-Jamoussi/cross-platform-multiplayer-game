import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DEFAULT_OWNED_BACKGROUNDS, DEFAULT_OWNED_MUSICS } from '@app/constants/cosmetics.constants';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { Background, CosmeticsService, FeaturedAvatar, Music } from '@app/services/cosmetics/cosmetics.service';
import { AVATARS } from '@common/avatar';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-shop-page',
    imports: [AsyncPipe, TranslateModule, CoinIconComponent],
    templateUrl: './shop-page.component.html',
    styleUrl: './shop-page.component.scss',
})
export class ShopPageComponent implements OnInit, OnDestroy {
    private static readonly purchaseProgressCapPercent = 100;

    @ViewChild('avatarDetailCard') avatarDetailCard?: ElementRef<HTMLElement>;
    userProfile$ = this.authService.userProfile$;
    selectedCategory: 'avatars' | 'backgrounds' | 'music' = 'backgrounds';

    shopBackgrounds: Background[] = [];
    shopAvatars: FeaturedAvatar[] = [];
    shopMusics: Music[] = [];
    userOwnedBackgroundIds: string[] = [];
    userOwnedAvatarNames: string[] = [];
    userOwnedMusicIds: string[] = [];
    userCurrency = 0;
    /** Full-screen detail card for shop avatars (opened by clicking the preview, not the buy button). */
    previewAvatar: FeaturedAvatar | null = null;

    private profileSub?: Subscription;
    private avatarDetailReturnFocus: HTMLElement | null = null;

    constructor(
        private readonly authService: AuthService,
        private readonly cosmeticsService: CosmeticsService,
        private readonly alertService: AlertService,
        private readonly translate: TranslateService,
        private readonly dialog: MatDialog,
    ) {}

    @HostListener('document:keydown.escape')
    onEscapeCloseAvatarDetail(): void {
        if (!this.previewAvatar || this.dialog.openDialogs.length > 0) {
            return;
        }
        this.closeAvatarDetail();
    }

    ngOnInit(): void {
        this.shopBackgrounds = this.cosmeticsService.getShopBackgrounds();
        this.shopAvatars = this.cosmeticsService.getShopAvatars();
        this.shopMusics = this.cosmeticsService.getShopMusics();

        this.profileSub = this.authService.userProfile$.subscribe((profile) => {
            if (profile) {
                this.userOwnedBackgroundIds = profile.ownedBackgrounds || DEFAULT_OWNED_BACKGROUNDS;
                this.userOwnedAvatarNames = profile.ownedAvatars || [];
                this.userOwnedMusicIds = profile.ownedMusics || DEFAULT_OWNED_MUSICS;
                this.userCurrency = profile.virtualCurrency || 0;
            }
        });
    }

    ngOnDestroy(): void {
        this.profileSub?.unsubscribe();
    }

    selectCategory(category: 'avatars' | 'backgrounds' | 'music'): void {
        this.selectedCategory = category;
    }

    isBackgroundOwned(bgId: string): boolean {
        return this.userOwnedBackgroundIds.includes(bgId);
    }

    isAvatarOwned(avatarName: string): boolean {
        return this.userOwnedAvatarNames.includes(avatarName);
    }

    isMusicOwned(musicId: string): boolean {
        return this.userOwnedMusicIds.includes(musicId);
    }

    canAfford(price: number): boolean {
        return this.userCurrency >= price;
    }

    /** 0–100: share of the avatar price covered by the current balance (capped at 100). */
    purchaseProgressPercent(price: number): number {
        const cap = ShopPageComponent.purchaseProgressCapPercent;
        if (price <= 0) {
            return cap;
        }
        return Math.min(cap, Math.round((this.userCurrency / price) * cap));
    }

    getBackgroundPreview(background: Background): string {
        return this.cosmeticsService.getBackgroundStyle(background.id);
    }

    getAvatarIcon(avatar: FeaturedAvatar): string {
        return avatar.icon;
    }

    getAvatarAnimation(avatar: FeaturedAvatar): string {
        return avatar.animation || avatar.icon;
    }

    /** Idle loop used in-game; best preview for the detail card. */
    getAvatarDetailAnimation(avatar: FeaturedAvatar): string {
        const match = AVATARS.find((candidate) => candidate.name === avatar.name);
        return match?.idle ?? avatar.animation ?? avatar.icon;
    }

    avatarStoryKey(avatar: FeaturedAvatar): string {
        const key = `shop_page.avatar_detail.stories.${avatar.id}`;
        const translated = this.translate.instant(key);
        return translated !== key ? key : 'shop_page.avatar_detail.story_fallback';
    }

    openAvatarDetail(avatar: FeaturedAvatar): void {
        const active = document.activeElement;
        this.avatarDetailReturnFocus = active instanceof HTMLElement ? active : null;
        this.previewAvatar = avatar;
        setTimeout(() => {
            const root = this.avatarDetailCard?.nativeElement;
            const buy = root?.querySelector<HTMLButtonElement>('.avatar-detail-btn--buy');
            const closeBtn = root?.querySelector<HTMLButtonElement>('.avatar-detail-close');
            if (buy) {
                buy.focus();
            } else if (closeBtn) {
                closeBtn.focus();
            }
        }, 0);
    }

    closeAvatarDetail(): void {
        this.previewAvatar = null;
        const toRestore = this.avatarDetailReturnFocus;
        this.avatarDetailReturnFocus = null;
        setTimeout(() => toRestore?.focus(), 0);
    }

    async purchaseBackground(background: Background): Promise<void> {
        if (this.isBackgroundOwned(background.id) || !this.canAfford(background.price)) return;
        const confirmed = await this.alertService.confirm('popup.shop_confirm_title', 'popup.shop_confirm_item', undefined, undefined, {
            item: background.name,
            price: background.price,
        });
        if (!confirmed) return;

        this.authService.purchaseBackground(background.id, background.price).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
                this.alertService.showSuccess('popup.shop_success_title', 'popup.shop_success_message');
            },
        });
    }

    async purchaseAvatar(avatar: FeaturedAvatar): Promise<void> {
        if (this.isAvatarOwned(avatar.name) || !this.canAfford(avatar.price)) return;
        const confirmed = await this.alertService.confirm('popup.shop_confirm_title', 'popup.shop_confirm_item', undefined, undefined, {
            item: avatar.name,
            price: avatar.price,
        });
        if (!confirmed) return;

        this.authService.purchaseAvatar(avatar.name, avatar.price).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
                this.alertService.showSuccess('popup.shop_success_title', 'popup.shop_success_message');
                if (this.previewAvatar?.id === avatar.id) {
                    this.closeAvatarDetail();
                }
            },
        });
    }

    async purchaseMusic(music: Music): Promise<void> {
        if (this.isMusicOwned(music.id) || !this.canAfford(music.price)) return;
        const confirmed = await this.alertService.confirm('popup.shop_confirm_title', 'popup.shop_confirm_item', undefined, undefined, {
            item: music.name,
            price: music.price,
        });
        if (!confirmed) return;

        this.authService.purchaseMusic(music.id, music.price).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
                this.alertService.showSuccess('popup.shop_success_title', 'popup.shop_success_message');
            },
        });
    }
}
