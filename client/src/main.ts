import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { authGuard } from '@app/guards/auth.guard';
import { authInterceptor } from '@app/interceptors/auth.interceptor';
import { ActiveGamePageComponent } from '@app/pages/active-game-page/active-game-page.component';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { ChatExternalPageComponent } from '@app/pages/chat-external/chat-external-page.component';
import { EditorCreatorPageComponent } from '@app/pages/editor-creator-page/editor-creator-page.component';
import { EditorPageComponent } from '@app/pages/editor-page/editor-page.component';
import { EndPageComponent } from '@app/pages/end-page/end-page.component';
import { GameCreationPageComponent } from '@app/pages/game-creation-page/game-creation-page.component';
import { JoinPageComponent } from '@app/pages/join-page/join-page.component';
import { LoadingPageComponent } from '@app/pages/loading-page/loading-page.component';
import { LoginPageComponent } from '@app/pages/login-page/login-page.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { ProfilePageComponent } from '@app/pages/profile-page/profile-page.component';
import { ShopPageComponent } from '@app/pages/shop-page/shop-page.component';
import { StatsPageComponent } from '@app/pages/stats-page/stats-page.component';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginPageComponent },
    { path: 'home', component: MainPageComponent, canActivate: [authGuard] },
    { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
    { path: 'shop', component: ShopPageComponent, canActivate: [authGuard] },
    { path: 'game-creation', component: GameCreationPageComponent, canActivate: [authGuard] },
    { path: 'loading/:id', component: LoadingPageComponent, canActivate: [authGuard] },
    { path: 'admin', component: AdminPageComponent, canActivate: [authGuard] },
    { path: 'settings-editor', component: EditorCreatorPageComponent, canActivate: [authGuard] },
    { path: 'map-editor', component: EditorPageComponent, canActivate: [authGuard] },
    { path: 'stats', component: StatsPageComponent, canActivate: [authGuard] },
    { path: 'join', component: JoinPageComponent, canActivate: [authGuard] },
    { path: 'game', component: ActiveGamePageComponent, canActivate: [authGuard] },
    { path: 'end', component: EndPageComponent, canActivate: [authGuard] },
    { path: 'chat-external', component: ChatExternalPageComponent },
    { path: '**', redirectTo: '/login' },
];

bootstrapApplication(AppComponent, {
    providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideRouter(routes, withHashLocation()),
        provideAnimations(),

        provideTranslateService({
            defaultLanguage: 'fr',
            useDefaultLang: true,
            loader: provideTranslateHttpLoader({
                prefix: './assets/i18n/',
                suffix: '.json',
            }),
        }),
    ],
});
