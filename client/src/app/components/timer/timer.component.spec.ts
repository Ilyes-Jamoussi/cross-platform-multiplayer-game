import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeService } from '@app/services/time/time.service';
import { TURN_TIME } from '@common/constants';
import { TIME_BELOW_THRESHOLD, TIME_ABOVE_THRESHOLD } from '@common/constants.spec';
import { of, Subscription } from 'rxjs';
import { TimerComponent } from './timer.component';

describe('TimerComponent', () => {
    let component: TimerComponent;
    let fixture: ComponentFixture<TimerComponent>;
    let mockTimeService: jasmine.SpyObj<TimeService>;

    beforeEach(async () => {
        mockTimeService = jasmine.createSpyObj('TimeService', ['reset', 'getTimeObservable', 'startTimer', 'stopTimer']);
        mockTimeService.getTimeObservable.and.returnValue(of(TURN_TIME));

        await TestBed.configureTestingModule({
            imports: [TimerComponent],
            providers: [{ provide: TimeService, useValue: mockTimeService }],
        }).compileComponents();

        fixture = TestBed.createComponent(TimerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should subscribe to TimeService and update time', () => {
        expect(component.time).toBe(TURN_TIME);
    });

    it('should return true for isLowTime() if time <= 5', () => {
        component.time = TIME_BELOW_THRESHOLD;
        expect(component.isLowTime()).toBeTrue();
    });

    it('should return false for isLowTime() if time > 5', () => {
        component.time = TIME_ABOVE_THRESHOLD;
        expect(component.isLowTime()).toBeFalse();
    });

    it('should unsubscribe from TimeService on destroy', () => {
        component['timerSubscription'] = jasmine.createSpyObj<Subscription>('Subscription', ['unsubscribe']); // ✅ Typage propre

        component.ngOnDestroy();

        expect(component['timerSubscription'].unsubscribe).toHaveBeenCalled();
    });
});
