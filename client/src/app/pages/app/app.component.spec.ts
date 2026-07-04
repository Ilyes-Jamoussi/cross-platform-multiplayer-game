import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Event, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { AppComponent } from '@app/pages/app/app.component';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

describe('AppComponent', () => {
    let component: AppComponent;
    let fixture: ComponentFixture<AppComponent>;
    let router: jasmine.SpyObj<Router>;
    let routerEvents: BehaviorSubject<Event>;
    let socketService: jasmine.SpyObj<SocketService>;
    let playerService: jasmine.SpyObj<PlayerService>;

    beforeEach(async () => {
        routerEvents = new BehaviorSubject<Event>(new NavigationStart(0, ''));
        router = jasmine.createSpyObj('Router', [], {
            events: routerEvents.asObservable(),
            url: '/test',
        });

        socketService = jasmine.createSpyObj('SocketService', ['connect', 'on', 'send', 'sendMessage', 'off', 'isConnected']);
        socketService.isConnected.and.returnValue(new BehaviorSubject<boolean>(false).asObservable());
        playerService = jasmine.createSpyObj('PlayerService', ['quitGame']);

        await TestBed.configureTestingModule({
            imports: [AppComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: Router, useValue: router },
                { provide: SocketService, useValue: socketService },
                { provide: PlayerService, useValue: playerService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AppComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the app', () => {
        expect(component).toBeTruthy();
    });

    it('should show header by default for non-excluded routes', () => {
        routerEvents.next(new NavigationEnd(1, '/test', '/test'));
        expect(component.showHeader).toBeTrue();
    });

    it('should hide header for excluded routes', () => {
        Object.defineProperty(router, 'url', { get: () => '/home' });
        routerEvents.next(new NavigationEnd(1, '/home', '/home'));
        expect(component.showHeader).toBeFalse();
    });

    it('should ignore non-NavigationEnd events', () => {
        const initialHeaderState = component.showHeader;
        routerEvents.next({ someOtherEvent: true } as unknown as Event);
        expect(component.showHeader).toBe(initialHeaderState);
    });

    it('should have correct excluded routes', () => {
        expect(component['excludedRoutes']).toContain('/home');
    });

    it('should call socketService.connect on ngOnInit', () => {
        component.ngOnInit();
        expect(socketService.connect).toHaveBeenCalled();
    });
});
