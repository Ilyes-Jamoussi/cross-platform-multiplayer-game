import { Injectable } from '@angular/core';
import { BACKGROUND_DEFAULT_ID, MUSIC_DEFAULT_ID, MUSIC_OFF_ID } from '@app/constants/cosmetics.constants';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { CustomizationService } from '@app/services/customization-service/customization.service';
import { BehaviorSubject, Observable, combineLatest, distinctUntilChanged, map } from 'rxjs';

export interface Background {
    id: string;
    name: string;
    type: 'image';
    blueValue: string;
    redValue: string;
    price: number;
}

export interface FeaturedAvatar {
    id: string;
    name: string;
    price: number;
    icon: string;
    animation?: string;
}

export interface Music {
    id: string;
    name: string;
    path: string;
    cover: string;
    price: number;
}

@Injectable({
    providedIn: 'root',
})
export class CosmeticsService {
    backgrounds: Background[] = [
        {
            id: BACKGROUND_DEFAULT_ID,
            name: 'shop_page.background.default',
            type: 'image',
            blueValue: 'url(assets/backgrounds/background-default.png)',
            redValue: 'url(assets/backgrounds/background-default.png)',
            price: 0,
        },
        {
            id: 'background-1',
            name: 'shop_page.background.background_1',
            type: 'image',
            blueValue: 'url(assets/backgrounds/eggcited_blue.gif)',
            redValue: 'url(assets/backgrounds/eggcited_red.gif)',
            price: 400,
        },
        {
            id: 'background-2',
            name: 'shop_page.background.background_2',
            type: 'image',
            blueValue: 'url(assets/backgrounds/zero-duck-given_blue.gif)',
            redValue: 'url(assets/backgrounds/zero-duck-given_red.gif)',
            price: 600,
        },
        {
            id: 'background-3',
            name: 'shop_page.background.background_3',
            type: 'image',
            blueValue: 'url(assets/backgrounds/champions-brew_blue.gif)',
            redValue: 'url(assets/backgrounds/champions-brew_red.gif)',
            price: 800,
        },
    ];

    featuredAvatars: FeaturedAvatar[] = [
        { id: 'specter', name: 'Specter', price: 500, icon: 'assets/avatar_icon/specter_icon.png', animation: 'assets/avatar_gif/specter.gif' },
        { id: 'titan', name: 'Titan', price: 750, icon: 'assets/avatar_icon/titan_icon.png', animation: 'assets/avatar_gif/titan.gif' },
        { id: 'whiplash', name: 'Whiplash', price: 1000, icon: 'assets/avatar_icon/whiplash_icon.png', animation: 'assets/avatar_gif/whiplash.gif' },
        { id: 'yang', name: 'Yang', price: 1500, icon: 'assets/avatar_icon/yang_icon.png', animation: 'assets/avatar_gif/yang.gif' },
    ];

    musics: Music[] = [
        {
            id: MUSIC_DEFAULT_ID,
            name: 'music_name.main_theme',
            path: 'assets/audio/main-theme.mp3',
            cover: 'assets/music-covers/music-default.png',
            price: 0,
        },
        {
            id: 'music-1',
            name: 'music_name.epic',
            path: 'assets/audio/music-1.mp3',
            cover: 'assets/music-covers/music-1.png',
            price: 300,
        },
        {
            id: 'music-2',
            name: 'music_name.adventure',
            path: 'assets/audio/music-2.mp3',
            cover: 'assets/music-covers/music-2.png',
            price: 500,
        },
        {
            id: 'music-3',
            name: 'music_name.mystic',
            path: 'assets/audio/music-3.mp3',
            cover: 'assets/music-covers/music-3.png',
            price: 700,
        },
    ];

    currentBackgroundStyle$!: Observable<string>;
    private readonly selectedBackgroundSubject = new BehaviorSubject<string>(BACKGROUND_DEFAULT_ID);
    private readonly selectedMusicSubject = new BehaviorSubject<string>(MUSIC_DEFAULT_ID);

    constructor(
        private readonly authService: AuthService,
        private readonly customizationService: CustomizationService,
    ) {
        this.currentBackgroundStyle$ = combineLatest([
            this.selectedBackgroundSubject.pipe(distinctUntilChanged()),
            this.customizationService.theme$,
        ]).pipe(map(([bgId]) => this.getBackgroundStyle(bgId)));

        this.authService.userProfile$.subscribe((profile) => {
            if (profile) {
                this.selectedBackgroundSubject.next(profile.selectedBackground || BACKGROUND_DEFAULT_ID);
                this.selectedMusicSubject.next(profile.selectedMusic || MUSIC_DEFAULT_ID);
            } else {
                this.selectedMusicSubject.next(MUSIC_OFF_ID);
                this.selectedBackgroundSubject.next(BACKGROUND_DEFAULT_ID);
            }
        });
    }

    get selectedBackground$() {
        return this.selectedBackgroundSubject.pipe(distinctUntilChanged());
    }

    get selectedMusic$() {
        return this.selectedMusicSubject.pipe(distinctUntilChanged());
    }

    setBackground(bgId: string): void {
        this.authService.updateAccountMongoDB({ selectedBackground: bgId }).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
            },
        });
    }

    getBackgroundStyle(bgId: string): string {
        const background = this.backgrounds.find((item) => item.id === bgId) || this.backgrounds[0];
        return this.customizationService.currentTheme === 'red-theme' ? background.redValue : background.blueValue;
    }

    getOwnedBackgrounds(ownedIds: string[]): Background[] {
        return this.backgrounds.filter((background) => ownedIds.includes(background.id));
    }

    getShopBackgrounds(): Background[] {
        return this.backgrounds.filter((background) => background.id !== BACKGROUND_DEFAULT_ID);
    }

    getShopAvatars(): FeaturedAvatar[] {
        return this.featuredAvatars;
    }

    getOwnedAvatars(ownedNames: string[]): FeaturedAvatar[] {
        return this.featuredAvatars.filter((avatar) => ownedNames.includes(avatar.name) || ownedNames.includes(avatar.id));
    }

    setMusic(musicId: string): void {
        this.authService.updateAccountMongoDB({ selectedMusic: musicId }).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
            },
        });
    }

    getMusicPath(musicId: string): string {
        if (musicId === MUSIC_OFF_ID) return '';
        const music = this.musics.find((item) => item.id === musicId);
        return music ? music.path : this.musics[0].path;
    }

    getMusicCover(musicId: string): string {
        const music = this.musics.find((item) => item.id === musicId);
        return music ? music.cover : this.musics[0].cover;
    }

    getOwnedMusics(ownedIds: string[]): Music[] {
        return this.musics.filter((music) => ownedIds.includes(music.id));
    }

    getShopMusics(): Music[] {
        return this.musics.filter((music) => music.id !== MUSIC_DEFAULT_ID);
    }
}
