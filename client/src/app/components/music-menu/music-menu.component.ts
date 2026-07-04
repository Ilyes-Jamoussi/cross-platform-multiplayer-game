import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DEFAULT_OWNED_MUSICS, MUSIC_DEFAULT_ID, MUSIC_OFF_ID } from '@app/constants/cosmetics.constants';
import { Routes } from '@app/enums/routes-enums';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { CosmeticsService, Music } from '@app/services/cosmetics/cosmetics.service';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-music-menu',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './music-menu.component.html',
    styleUrl: './music-menu.component.scss',
})
export class MusicMenuComponent implements OnInit, OnDestroy {
    readonly musicOffId = MUSIC_OFF_ID;
    isOpen = false;
    isVisible = true;
    ownedMusics: Music[] = [];
    selectedMusicId = MUSIC_DEFAULT_ID;

    private routerSub?: Subscription;
    private profileSub?: Subscription;
    private musicSub?: Subscription;
    private readonly excludedRoutes: string[] = [Routes.Login];

    constructor(
        private readonly cosmeticsService: CosmeticsService,
        private readonly authService: AuthService,
        private readonly router: Router,
        private readonly elementRef: ElementRef,
    ) {}

    get isOff(): boolean {
        return this.selectedMusicId === MUSIC_OFF_ID;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
            this.isOpen = false;
        }
    }

    ngOnInit(): void {
        this.updateVisibility();

        this.routerSub = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
            this.updateVisibility();
            if (!this.isVisible) this.isOpen = false;
        });

        this.profileSub = this.authService.userProfile$.subscribe((profile) => {
            if (profile) {
                this.ownedMusics = this.cosmeticsService.getOwnedMusics(profile.ownedMusics || DEFAULT_OWNED_MUSICS);
            }
        });

        this.musicSub = this.cosmeticsService.selectedMusic$.subscribe((musicId) => {
            this.selectedMusicId = musicId;
        });
    }

    ngOnDestroy(): void {
        this.routerSub?.unsubscribe();
        this.profileSub?.unsubscribe();
        this.musicSub?.unsubscribe();
    }

    toggleDropdown(): void {
        this.isOpen = !this.isOpen;
    }

    selectMusic(musicId: string): void {
        this.cosmeticsService.setMusic(musicId);
        this.isOpen = false;
    }

    private updateVisibility(): void {
        this.isVisible = !this.excludedRoutes.includes(this.router.url);
    }
}
