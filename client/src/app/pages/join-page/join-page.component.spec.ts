import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { PlayerService } from '@app/services/player/player.service';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { JoinPageComponent } from './join-page.component';

describe('JoinPageComponent', () => {
    let component: JoinPageComponent;
    let fixture: ComponentFixture<JoinPageComponent>;
    let playerServiceMock: jasmine.SpyObj<PlayerService>;
    let routerMock: jasmine.SpyObj<Router>;
    let mockHttpClient: jasmine.SpyObj<HttpClient>;

    beforeEach(async () => {
        playerServiceMock = jasmine.createSpyObj('PlayerService', ['validateRoomId', 'joinGame'], { roomId: '' });
        routerMock = jasmine.createSpyObj('Router', ['navigate']);

        const mockAuthService = jasmine.createSpyObj('AuthService', [], { userProfile$: of(null) });
        const mockAlertService = jasmine.createSpyObj('AlertService', ['alert']);
        mockHttpClient = jasmine.createSpyObj('HttpClient', ['get']);

        await TestBed.configureTestingModule({
            imports: [FormsModule, JoinPageComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PlayerService, useValue: playerServiceMock },
                { provide: Router, useValue: routerMock },
                { provide: AuthService, useValue: mockAuthService },
                { provide: AlertService, useValue: mockAlertService },
                { provide: HttpClient, useValue: mockHttpClient },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(JoinPageComponent);
        component = fixture.componentInstance;
        mockHttpClient.get.and.returnValue(of([]));
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should validate room code correctly', () => {
        component.roomId = '1234';
        expect(component.isValidCode()).toBeTrue();

        component.roomId = '123';
        expect(component.isValidCode()).toBeFalse();

        component.roomId = '12345';
        expect(component.isValidCode()).toBeFalse();

        component.roomId = 'abcd';
        expect(component.isValidCode()).toBeFalse();
    });

    it('should not submit if room code is invalid', fakeAsync(() => {
        component.roomId = '123';
        component.onSubmit();
        tick();
        expect(playerServiceMock.validateRoomId).not.toHaveBeenCalled();
    }));

    it('should submit and navigate if room code is valid and validated', fakeAsync(() => {
        component.roomId = '1234';
        playerServiceMock.validateRoomId.and.returnValue(Promise.resolve('1234'));
        mockHttpClient.get.and.returnValue(of({ entryFee: 0 }));

        component.onSubmit();
        tick();

        expect(playerServiceMock.validateRoomId).toHaveBeenCalledWith('1234');
        expect(playerServiceMock.joinGame).toHaveBeenCalledWith('1234', false);
    }));

    it('should not navigate if room validation fails', fakeAsync(() => {
        component.roomId = '1234';
        playerServiceMock.validateRoomId.and.returnValue(Promise.resolve(''));
        mockHttpClient.get.and.returnValue(of([]));

        component.onSubmit();
        tick();

        expect(playerServiceMock.validateRoomId).toHaveBeenCalledWith('1234');
        expect(playerServiceMock.joinGame).not.toHaveBeenCalled();
        expect(routerMock.navigate).not.toHaveBeenCalled();
        expect(playerServiceMock.roomId).not.toBe('1234');
    }));
});
