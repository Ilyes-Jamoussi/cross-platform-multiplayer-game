import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatService } from '@app/services/combat/combat.service';
import { PlayerService } from '@app/services/player/player.service';
import { TimeService } from '@app/services/time/time.service';
import { COMBAT_TURN_TIME, FULL_PERCENT, REDUCED_COMBAT_TIME } from '@common/constants';
import { Actions } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { CombatChoiceComponent } from './combat-choice.component';
describe('CombatChoiceComponent', () => {
    let component: CombatChoiceComponent;
    let fixture: ComponentFixture<CombatChoiceComponent>;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;
    let mockCombatService: jasmine.SpyObj<CombatService>;
    let mockTimeService: jasmine.SpyObj<TimeService>;

    let combatTimeSubject: Subject<number>;
    let choicePopUpSubject: Subject<void>;
    let cancelEscapesSubject: Subject<void>;

    beforeEach(async () => {
        combatTimeSubject = new Subject<number>();
        choicePopUpSubject = new Subject<void>();
        cancelEscapesSubject = new Subject<void>();

        mockTimeService = jasmine.createSpyObj('TimeService', ['getCombatTimeObservable', 'startTimer', 'stopTimer']);
        mockTimeService.getCombatTimeObservable.and.returnValue(combatTimeSubject.asObservable());

        mockPlayerService = jasmine.createSpyObj('PlayerService', ['roomId', 'player']);

        mockCombatService = jasmine.createSpyObj('CombatService', ['sendCombatAction'], {
            choicePopUp: choicePopUpSubject.asObservable(),
            cancelEscapes: cancelEscapesSubject.asObservable(),
        });

        await TestBed.configureTestingModule({
            imports: [CombatChoiceComponent, TranslateModule.forRoot()],
            providers: [
                { provide: TimeService, useValue: mockTimeService },
                { provide: PlayerService, useValue: mockPlayerService },
                { provide: CombatService, useValue: mockCombatService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CombatChoiceComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize listeners on init', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'listenerStartCombat');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'listenerEscapes');

        component.ngOnInit();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).listenerStartCombat).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).listenerEscapes).toHaveBeenCalled();
    });

    describe('Combat Actions', () => {
        beforeEach(() => component.startCombat());

        it('should start combat and initialize timer', () => {
            expect(mockTimeService.startTimer).toHaveBeenCalledWith(COMBAT_TURN_TIME, true);
            expect(component.isVisible).toBeTrue();
        });

        it('should attack and stop timer', () => {
            spyOn(component['_timeSubscription'], 'unsubscribe');
            component.attack();
            expect(mockTimeService.stopTimer).toHaveBeenCalledWith(true);
            expect(mockCombatService.sendCombatAction).toHaveBeenCalledWith(mockPlayerService.roomId, mockPlayerService.player, Actions.Attack);
            expect(component.isVisible).toBeFalse();
            expect(component['_timeSubscription'].unsubscribe).toHaveBeenCalled();
        });

        it('should flee and stop timer', () => {
            component.flee();
            expect(mockTimeService.stopTimer).toHaveBeenCalledWith(true);
            expect(mockCombatService.sendCombatAction).toHaveBeenCalledWith(mockPlayerService.roomId, mockPlayerService.player, Actions.Escape);
            expect(component.isVisible).toBeFalse();
        });

        it('should handle combat time updates and trigger attack when time runs out', () => {
            spyOn(component, 'attack');
            combatTimeSubject.next(0);
            expect(component.attack).toHaveBeenCalled();
        });
    });

    describe('Timer Management', () => {
        it('should start combat with correct timer based on flee status', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (component as any)._isFleeDisabled = false;
            expect(component.isFleeDisabled).toBeFalse();
            component.startCombat();
            expect(mockTimeService.startTimer).toHaveBeenCalledWith(COMBAT_TURN_TIME, true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (component as any)._isFleeDisabled = true;
            component.startCombat();
            expect(mockTimeService.startTimer).toHaveBeenCalledWith(REDUCED_COMBAT_TIME, true);
        });

        it('should compute timeLeftPercentage correctly', () => {
            /* eslint-disable @typescript-eslint/no-magic-numbers */
            component['_timeLeft'] = 25;
            component['_totalTime'] = 50;
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.timeLeftPercentage).toBe((25 / 50) * FULL_PERCENT);
            /* enable-disable @typescript-eslint/no-magic-numbers */
        });

        it('should disable fleeing when escape is cancelled', () => {
            cancelEscapesSubject.next();
            expect(component.isFleeDisabled).toBeTrue();
        });
    });

    describe('Subscription Cleanup', () => {
        beforeEach(() => {
            component['_choicePopUpSubscription'] = new Subscription();
            component['_timeSubscription'] = new Subscription();
            component['_escapePopUpSubscription'] = new Subscription();
        });

        it('should unsubscribe all subscriptions on destroy', () => {
            spyOn(component['_choicePopUpSubscription'], 'unsubscribe');
            spyOn(component['_timeSubscription'], 'unsubscribe');
            spyOn(component['_escapePopUpSubscription'], 'unsubscribe');

            component.ngOnDestroy();

            expect(component['_choicePopUpSubscription'].unsubscribe).toHaveBeenCalled();
            expect(component['_timeSubscription'].unsubscribe).toHaveBeenCalled();
            expect(component['_escapePopUpSubscription'].unsubscribe).toHaveBeenCalled();
        });
    });

    describe('Event Listeners', () => {
        it('should react to combat choice popup', () => {
            spyOn(component, 'startCombat');
            choicePopUpSubject.next();
            expect(component.startCombat).toHaveBeenCalled();
        });
    });

    it('should unsubscribe timeSubscription when attack is called', () => {
        component['_timeSubscription'] = new Subscription();
        spyOn(component['_timeSubscription'], 'unsubscribe');
        component.attack();
        expect(component['_timeSubscription'].unsubscribe).toHaveBeenCalled();
    });
});
