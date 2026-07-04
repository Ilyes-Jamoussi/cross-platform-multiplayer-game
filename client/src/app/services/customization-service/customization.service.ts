import { Injectable } from '@angular/core';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'blue-theme' | 'red-theme';

@Injectable({ providedIn: 'root' })
export class CustomizationService {
    readonly theme$;
    private readonly themeSubject = new BehaviorSubject<AppTheme>('blue-theme');

    constructor(
        private readonly authService: AuthService,
        private readonly translate: TranslateService,
    ) {
        this.theme$ = this.themeSubject.asObservable();
    }

    get currentTheme(): AppTheme {
        return this.themeSubject.value;
    }

    setTheme(theme: AppTheme) {
        const body = document.body;

        if (this.themeSubject.value) {
            body.classList.remove(this.themeSubject.value);
        }

        body.classList.add(theme);
        this.themeSubject.next(theme);

        localStorage.setItem('app-theme', theme);
    }

    loadTheme() {
        const saved = localStorage.getItem('app-theme') as AppTheme;
        this.setTheme(saved || 'blue-theme');
    }

    setLanguage(language: string) {
        this.translate.use(language);
    }

    saveTheme() {
        this.authService.updateTheme(this.currentTheme).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
            },
        });
    }

    saveLang(lang: string) {
        this.authService.updateLang(lang).subscribe({
            next: (updatedProfile) => {
                this.authService.refreshUserProfile(updatedProfile);
            },
        });
    }
}
