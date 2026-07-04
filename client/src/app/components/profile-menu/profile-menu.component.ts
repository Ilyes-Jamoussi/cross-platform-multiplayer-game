import { AsyncPipe } from '@angular/common';
import { Component, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FriendsMenuComponent } from '@app/components/friends-menu/friends-menu.component';
import { Routes } from '@app/enums/routes-enums';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { AppTheme, CustomizationService } from '@app/services/customization-service/customization.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-profile-menu',
    imports: [AsyncPipe, TranslateModule, FriendsMenuComponent],
    templateUrl: './profile-menu.component.html',
    styleUrl: './profile-menu.component.scss',
})
export class ProfileMenuComponent {
    @ViewChild('friendsMenuRef') friendsMenuRef!: FriendsMenuComponent;

    showMenu = false;
    currentUser$ = this.authService.currentUser$;
    userProfile$ = this.authService.userProfile$;
    protected isLightTheme = true;
    protected isFr = true;

    constructor(
        private readonly authService: AuthService,
        private readonly router: Router,
        private readonly customizationService: CustomizationService,
        private readonly translate: TranslateService,
    ) {}

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const clickedInside = target.closest('app-profile-menu');
        if (!clickedInside && this.showMenu) {
            this.showMenu = false;
        }
    }

    getAvatarPath(avatarName: string): string {
        if (avatarName.includes('/')) {
            return avatarName;
        }
        return `assets/account_avatar/${avatarName}.png`;
    }

    toggleMenu() {
        this.isLightTheme = this.authService.currentUserProfile?.theme === 'blue-theme';
        this.isFr = this.authService.currentUserProfile?.language === 'fr';
        this.showMenu = !this.showMenu;
    }

    openFriends() {
        this.showMenu = false;
        this.friendsMenuRef.toggleMenu();
    }

    setTheme(light: boolean) {
        if (this.isLightTheme === light) return;
        const theme: AppTheme = light ? 'blue-theme' : 'red-theme';
        this.customizationService.setTheme(theme);
        this.isLightTheme = light;
        this.customizationService.saveTheme();
    }

    setLanguage(isFrench: boolean) {
        if (this.isFr === isFrench) return;
        this.isFr = isFrench;
        this.translate.use(isFrench ? 'fr' : 'en');
        this.customizationService.saveLang(isFrench ? 'fr' : 'en');
    }

    goToProfile() {
        this.showMenu = false;
        void this.router.navigate(['/profile']);
    }

    async logout() {
        this.showMenu = false;
        if (!this.isFr) {
            this.isFr = true;
            this.translate.use('fr');
        }
        await this.authService.handleLogout();
        void this.router.navigate([Routes.Login]);
    }
}
