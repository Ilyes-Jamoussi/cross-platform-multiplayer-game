import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { AppTheme, CustomizationService } from '@app/services/customization-service/customization.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-login-page',
    imports: [FormsModule, TranslateModule],
    templateUrl: './login-page.component.html',
    styleUrl: './login-page.component.scss',
    standalone: true,
})
export class LoginPageComponent {
    private static readonly maxUsernameLength = 10;
    protected avatars: string[] = [
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
    protected username: string = '';
    protected email: string = '';
    protected password: string = '';
    protected loading: boolean = false;
    protected isRegistering: boolean = false;
    protected selectedAvatar: string = this.avatars[0];
    protected uploadedAvatar: string = '';
    protected errorMessage: string = '';

    constructor(
        private readonly authService: AuthService,
        private readonly router: Router,
        private readonly customizationService: CustomizationService,
    ) {
        this.customizationService.setTheme('blue-theme');
    }

    protected setIsRegistering(isRegistering: boolean): void {
        this.isRegistering = isRegistering;
        this.errorMessage = '';
    }

    protected async handleLoginButton(): Promise<void> {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorMessage = '';

        const avatarToSave = this.selectedAvatar.startsWith('data:')
            ? this.selectedAvatar
            : this.selectedAvatar.split('/').pop()?.replace('.png', '') || 'avatar-1';
        const trimmedUsername = this.username.trim();

        const result = this.isRegistering
            ? await this.authService.register(trimmedUsername, this.password, this.email, avatarToSave)
            : await this.authService.handleLogin(this.email, this.password);

        this.loading = false;

        if (result.error) {
            this.errorMessage = result.error;
        } else if (result.user) {
            if (this.authService.currentUserProfile) {
                this.customizationService.setTheme((this.authService.currentUserProfile.theme as AppTheme) || 'blue-theme');
                this.customizationService.setLanguage(this.authService.currentUserProfile.language || 'fr');
            }
            void this.router.navigate(['/home']);
        }
    }

    protected setSelectedAvatar(avatar: string): void {
        this.selectedAvatar = avatar;
    }

    protected onUsernameInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value;

        if (value.startsWith(' ')) {
            value = value.trimStart();
        }

        value = value.replace(/\s{2,}/g, ' ').replace(/\./g, '');

        if (value.length > LoginPageComponent.maxUsernameLength) {
            value = value.substring(0, LoginPageComponent.maxUsernameLength);
        }

        this.username = value;
        input.value = value;
    }

    protected onUsernameKeydown(event: KeyboardEvent): void {
        const input = event.target as HTMLInputElement;

        if (event.key === ' ' && (input.value.endsWith(' ') || input.value.length === 0)) {
            event.preventDefault();
        }
    }

    protected onFileSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        const maxSize = 1024;

        if (file) {
            if (file.size > maxSize * maxSize) {
                this.errorMessage = 'login_page.image_too_large';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                this.uploadedAvatar = reader.result as string;
                this.selectedAvatar = this.uploadedAvatar;
                this.errorMessage = '';
            };
            reader.readAsDataURL(file);
        }
    }

    protected selectUploadedAvatar(): void {
        if (this.uploadedAvatar) {
            this.selectedAvatar = this.uploadedAvatar;
        }
    }
}
