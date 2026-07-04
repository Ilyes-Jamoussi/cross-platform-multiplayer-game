import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HeaderComponent } from '@app/components/header/header.component';
import { PlayerService } from '@app/services/player/player.service';
import { TranslateModule } from '@ngx-translate/core';

describe('HeaderComponent', () => {
    let component: HeaderComponent;
    let fixture: ComponentFixture<HeaderComponent>;
    let routerSpy: jasmine.SpyObj<Router>;
    let playerServiceSpy: jasmine.SpyObj<PlayerService>;

    beforeEach(async () => {
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        playerServiceSpy = jasmine.createSpyObj('PlayerService', ['quitGame']);
        routerSpy.navigate.and.returnValue(Promise.resolve(true));

        await TestBed.configureTestingModule({
            imports: [HeaderComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: Router, useValue: routerSpy },
                { provide: PlayerService, useValue: playerServiceSpy },
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(HeaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
