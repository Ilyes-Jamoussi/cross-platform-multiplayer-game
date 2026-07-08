import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MainPageComponent } from './main-page.component';
import { provideRouter, Router, RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

describe('MainPageComponent', () => {
    let component: MainPageComponent;
    let fixture: ComponentFixture<MainPageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MainPageComponent, TranslateModule.forRoot()],
            providers: [provideRouter([]), provideHttpClient()],
        }).compileComponents();

        fixture = TestBed.createComponent(MainPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have three buttons with correct routes', () => {
        const buttons = fixture.debugElement.queryAll(By.css('button.mainPageButton'));
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(buttons.length).toBe(3);

        const router = TestBed.inject(Router);
        const routeOf = (button: (typeof buttons)[number]) => router.serializeUrl(button.injector.get(RouterLink).urlTree!);

        expect(routeOf(buttons[0])).toBe('/join');
        expect(routeOf(buttons[1])).toBe('/game-creation');
        expect(routeOf(buttons[2])).toBe('/admin');
    });
});
