import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ElementRef } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { GameChatComponent } from '@app/components/game-chat/game-chat.component';
import { LogService } from '@app/services/logs/log.service';
import { DOM_DELAY } from '@common/constants';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { Log } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { LogChatComponent } from './log-chat.component';

describe('LogChatComponent', () => {
    let component: LogChatComponent;
    let fixture: ComponentFixture<LogChatComponent>;
    let mockLogService: jasmine.SpyObj<LogService>;
    let logsSubject: BehaviorSubject<Log[]>;

    const mockLogs: Log[] = [
        { message: { player: MOCK_PLAYERS[0], time: '11:05:04', message: 'Test log 1' } },
        { message: { player: MOCK_PLAYERS[1], time: '11:05:06', message: 'Test log 2' } },
    ];

    beforeEach(async () => {
        logsSubject = new BehaviorSubject<Log[]>(mockLogs);

        mockLogService = jasmine.createSpyObj<LogService>('LogService', ['setupListeners', 'filterLogs', 'ngOnDestroy'], {
            logs: logsSubject.asObservable(),
        });

        await TestBed.configureTestingModule({
            imports: [CommonModule, LogChatComponent, GameChatComponent, TranslateModule.forRoot()],
            providers: [{ provide: LogService, useValue: mockLogService }, provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        fixture = TestBed.createComponent(LogChatComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should call setupListeners on LogService', () => {
            expect(mockLogService.setupListeners).toHaveBeenCalled();
        });

        it('should set up log subscription', () => {
            expect(component.logs).toEqual(mockLogs);
        });
    });

    describe('ngOnDestroy', () => {
        it('should clear logs array', () => {
            component.ngOnDestroy();
            expect(component.logs).toEqual([]);
        });

        it('should call ngOnDestroy on LogService', () => {
            component.ngOnDestroy();
            expect(mockLogService.ngOnDestroy).toHaveBeenCalled();
        });

        it('should unsubscribe from logSubscription', () => {
            const unsubscribeSpy = spyOn(component['logSubscription'], 'unsubscribe');
            component.ngOnDestroy();
            expect(unsubscribeSpy).toHaveBeenCalled();
        });
    });

    it('should scroll to the bottom if scrollDown is true and logsContainer is defined', fakeAsync(() => {
        const scrollMock = {
            scrollTop: 0,
            scrollHeight: 1000,
        };

        component.scrollDown = true;

        Object.defineProperty(component, 'logsContainer', {
            value: {
                nativeElement: scrollMock,
            } as ElementRef,
            writable: true,
        });

        component.scrollToBottom();

        tick(DOM_DELAY);

        expect(scrollMock.scrollTop).toBe(scrollMock.scrollHeight);
    }));

    describe('view switching', () => {
        it('should switch to chat view', () => {
            component.chosenWindow = 'logs';
            component.seeChat();
            expect(component.chosenWindow).toBe('chat');
        });

        it('should switch to logs view', () => {
            component.chosenWindow = 'chat';
            component.seeLogs();
            expect(component.chosenWindow).toBe('logs');
        });
    });

    describe('filterLogs', () => {
        it('should call filterLogs on LogService', () => {
            component.filterLogs();
            expect(mockLogService.filterLogs).toHaveBeenCalled();
        });

        it('should toggle areLogsFiltered flag', () => {
            const initialValue = component.areLogsFiltered;
            component.filterLogs();
            expect(component.areLogsFiltered).toBe(!initialValue);
            component.filterLogs();
            expect(component.areLogsFiltered).toBe(initialValue);
        });
    });

    describe('log subscription', () => {
        it('should update logs when LogService emits new values', () => {
            const newLogs: Log[] = [...mockLogs, { message: { player: MOCK_PLAYERS[2], time: '11:06:05', message: 'Test log 3' } }];
            logsSubject.next(newLogs);

            component['setupLogListener']();
            fixture.detectChanges();

            expect(component.logs).toEqual(newLogs);
        });

        it('should handle empty log arrays', () => {
            logsSubject.next([]);
            component['setupLogListener']();
            fixture.detectChanges();

            expect(component.logs).toEqual([]);
        });
    });
});
