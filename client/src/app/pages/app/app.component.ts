import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ChatMenuComponent } from '@app/components/chat-menu/chat-menu.component';
import { HeaderComponent } from '@app/components/header/header.component';
import { MusicMenuComponent } from '@app/components/music-menu/music-menu.component';
import { ProfileMenuComponent } from '@app/components/profile-menu/profile-menu.component';
import { ShopMenuComponent } from '@app/components/shop-menu/shop-menu.component';
import { BACKGROUND_DEFAULT_ID, MUSIC_OFF_ID } from '@app/constants/cosmetics.constants';
import { Routes } from '@app/enums/routes-enums';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { CosmeticsService } from '@app/services/cosmetics/cosmetics.service';
import { CustomizationService } from '@app/services/customization-service/customization.service';
import { ElectronService } from '@app/services/electron/electron.service';
import { SocketService } from '@app/services/socket/socket.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet, HeaderComponent, ChatMenuComponent, MusicMenuComponent, ProfileMenuComponent, ShopMenuComponent],
    standalone: true,
})
export class AppComponent implements OnInit, OnDestroy {
    showHeader = true;
    isMainPage = false;
    isChatExternal = window.location.hash.includes('chat-external');
    isFr = true;
    isLoginPage = false;
    isGamePage = false;
    isEditorPage = false;
    isShopPage = false;
    currentBackground = '';
    hasCustomBackground = false;
    private readonly excludedRoutes: string[] = [Routes.Home, Routes.Game, Routes.Login];
    private themeAudio: HTMLAudioElement | null = null;
    private hasUserInteracted = false;
    private readonly subscriptions: Subscription[] = [];

    constructor(
        private readonly router: Router,
        private readonly socketService: SocketService,
        private readonly authService: AuthService,
        private readonly cosmeticsService: CosmeticsService,
        private readonly themeService: CustomizationService,
        private readonly electronService: ElectronService,
    ) {
        this.subscriptions.push(
            this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
                const urlPath = this.router.url.split('?')[0].split(';')[0];
                this.showHeader = !this.excludedRoutes.includes(urlPath);
                this.isMainPage = urlPath === Routes.Home;
                this.isLoginPage = urlPath === Routes.Login;
                this.isGamePage = urlPath === Routes.Game;
                this.isEditorPage = urlPath === Routes.MapEditor;
                this.isShopPage = urlPath === Routes.Shop;
                this.isChatExternal = urlPath === Routes.ChatExternal;
            }),
        );

        this.subscriptions.push(
            this.cosmeticsService.currentBackgroundStyle$.subscribe((style) => {
                this.currentBackground = style;
            }),
        );

        this.subscriptions.push(
            this.cosmeticsService.selectedBackground$.subscribe((bgId) => {
                this.hasCustomBackground = bgId !== BACKGROUND_DEFAULT_ID;
            }),
        );

        if (!this.isChatExternal) {
            this.setupUserInteractionDetection();

            this.subscriptions.push(
                this.cosmeticsService.selectedMusic$.subscribe((musicId) => {
                    this.changeMusic(musicId);
                }),
            );
        }
    }

    get activeBackground(): string {
        return this.isLoginPage || this.isMainPage || this.isGamePage || this.isEditorPage || this.isShopPage ? '' : this.currentBackground;
    }

    ngOnInit() {
        this.socketService.connect();
        if (!this.isChatExternal) {
            this.setupLogoutOnUnload();
        }
        this.themeService.loadTheme();
    }

    toggleLanguage() {
        this.isFr = !this.isFr;
        this.themeService.setLanguage(this.isFr ? 'fr' : 'en');
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.disposeAudio();
    }

    private setupLogoutOnUnload() {
        window.addEventListener('beforeunload', () => {
            this.authService.sendLogoutBeacon();
        });
        this.electronService.onAppQuitting(() => {
            this.authService.sendLogoutBeacon();
        });
    }

    private setupUserInteractionDetection() {
        const markInteracted = () => {
            this.hasUserInteracted = true;
            window.removeEventListener('click', markInteracted);
            window.removeEventListener('keydown', markInteracted);

            if (this.themeAudio && this.themeAudio.muted) {
                this.themeAudio.muted = false;
                void this.themeAudio.play();
            }
        };
        window.addEventListener('click', markInteracted);
        window.addEventListener('keydown', markInteracted);
    }

    private disposeAudio(): void {
        if (this.themeAudio) {
            this.themeAudio.pause();
            this.themeAudio.src = '';
            this.themeAudio.load();
            this.themeAudio = null;
        }
    }

    private changeMusic(musicId: string) {
        if (musicId === MUSIC_OFF_ID) {
            this.disposeAudio();
            return;
        }

        const musicPath = this.cosmeticsService.getMusicPath(musicId);

        this.disposeAudio();

        this.themeAudio = new Audio(musicPath);
        this.themeAudio.loop = true;

        if (this.hasUserInteracted) {
            this.themeAudio.muted = false;
            void this.themeAudio.play();
        } else {
            this.themeAudio.muted = true;
            this.themeAudio.load();
        }
    }
}
