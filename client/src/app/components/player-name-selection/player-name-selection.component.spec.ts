import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService } from '@app/services/player/player.service';
import { TranslateModule } from '@ngx-translate/core';
import { PlayerNameSelectionComponent } from './player-name-selection.component';

describe('PlayerNameSelectionComponent', () => {
    let component: PlayerNameSelectionComponent;
    let fixture: ComponentFixture<PlayerNameSelectionComponent>;
    let playerServiceMock: jasmine.SpyObj<PlayerService>;
    let routerMock: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        playerServiceMock = jasmine.createSpyObj('PlayerService', ['validateRoomId', 'selectAvatar', 'validatePlayerAndJoin'], {
            player: { name: '', avatar: '' },
            roomId: '1234',
        });
        routerMock = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [FormsModule, PlayerNameSelectionComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: PlayerService, useValue: playerServiceMock },
                { provide: Router, useValue: routerMock },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PlayerNameSelectionComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should validate username correctly', () => {
        component.username = '  ';
        expect(component.validateUsername()).toBeFalse();

        component.username = 'John';
        expect(component.validateUsername()).toBeTrue();
    });

    it('should handle xButtonClick', () => {
        spyOn(component.isVisibleChange, 'emit');
        component.xButtonClick();
        expect(component.isVisible).toBeFalse();
        expect(component.isVisibleChange.emit).toHaveBeenCalledWith(false);
    });

    it('should handle validateButtonClick when room is valid', fakeAsync(() => {
        component.username = 'John';
        playerServiceMock.validateRoomId.and.resolveTo('1234');
        playerServiceMock.selectAvatar.and.resolveTo();
        routerMock.navigate.and.resolveTo(true);

        component.validateButtonClick();
        tick();

        expect(component.isVisible).toBeFalse();
        expect(playerServiceMock.validatePlayerAndJoin).toHaveBeenCalledWith('John');
    }));

    it('should prevent Enter key submission when validateUsername is false', () => {
        spyOn(component, 'validateUsername').and.returnValue(false);
        const event = new KeyboardEvent('keydown', { key: 'Enter' });

        spyOn(event, 'preventDefault');

        component.preventEnter(event);

        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should change player avatar if name is Knuckles', fakeAsync(() => {
        component.username = 'Knuckles';
        playerServiceMock.validateRoomId.and.resolveTo(undefined);
        component.validateButtonClick();
        tick();
        expect(playerServiceMock.validatePlayerAndJoin).toHaveBeenCalledWith('Knuckles');
    }));

    it('should allow Enter key submission when validateUsername is true', () => {
        spyOn(component, 'validateUsername').and.returnValue(true);
        const event = new KeyboardEvent('keydown', { key: 'Enter' });

        spyOn(event, 'preventDefault');

        component.preventEnter(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});
