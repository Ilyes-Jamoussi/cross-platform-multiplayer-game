import { Component, OnDestroy, OnInit } from '@angular/core';
import { CombatService } from '@app/services/combat/combat.service';
import { PlayerService } from '@app/services/player/player.service';
import { TimeService } from '@app/services/time/time.service';
import { COMBAT_TURN_TIME, FULL_PERCENT, REDUCED_COMBAT_TIME } from '@common/constants';
import { Actions } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-combat-choice',
    standalone: true,
    templateUrl: './combat-choice.component.html',
    styleUrl: './combat-choice.component.scss',
    imports: [TranslateModule],
})
export class CombatChoiceComponent implements OnInit, OnDestroy {
    private _isFleeDisabled: boolean = false;
    private _isVisible: boolean = false;
    private _timeLeft: number = COMBAT_TURN_TIME;
    private _totalTime: number = COMBAT_TURN_TIME;
    private _timeSubscription!: Subscription;
    private _choicePopUpSubscription!: Subscription;
    private _escapePopUpSubscription!: Subscription;

    constructor(
        private readonly timeService: TimeService,
        private readonly combatService: CombatService,
        private readonly playerService: PlayerService,
    ) {}

    get isFleeDisabled(): boolean {
        return this._isFleeDisabled;
    }
    get isVisible(): boolean {
        return this._isVisible;
    }

    get timeLeftPercentage(): number {
        return (this._timeLeft / this._totalTime) * FULL_PERCENT;
    }

    set isVisible(value: boolean) {
        this._isVisible = value;
    }

    ngOnInit(): void {
        this.listenerStartCombat();
        this.listenerEscapes();
    }

    listenerEscapes() {
        this._escapePopUpSubscription = this.combatService.cancelEscapes.subscribe(() => {
            this._isFleeDisabled = true;
        });
    }

    startCombat(): void {
        if (this._timeSubscription) {
            this._timeSubscription.unsubscribe();
        }
        this._timeSubscription = this.timeService.getCombatTimeObservable().subscribe((time) => {
            this._timeLeft = time;
            if (this._timeLeft <= 0 && this._isVisible) {
                this.attack();
            }
        });
        const turnTime: number = this._isFleeDisabled ? REDUCED_COMBAT_TIME : COMBAT_TURN_TIME;
        this._totalTime = this._isFleeDisabled ? REDUCED_COMBAT_TIME : COMBAT_TURN_TIME;
        this.timeService.startTimer(turnTime, true);
        this._isVisible = true;
    }

    attack(): void {
        this.timeService.stopTimer(true);
        if (this._timeSubscription) {
            this._timeSubscription.unsubscribe();
        }
        this.isVisible = false;

        // Team combat: choose action first, then select target
        if (this.combatService.teamCombatState?.needsTargetSelection && this.combatService.availableTargets.length > 0) {
            this.combatService.setPendingTeamAction(Actions.Attack);
            return;
        }
        this.combatService.sendCombatAction(this.playerService.roomId, this.playerService.player, Actions.Attack);
    }

    flee(): void {
        this.timeService.stopTimer(true);
        if (this._timeSubscription) {
            this._timeSubscription.unsubscribe();
        }
        this.isVisible = false;

        // Team combat: auto-select first enemy, then send escape
        if (this.combatService.teamCombatState?.needsTargetSelection && this.combatService.availableTargets.length > 0) {
            this.combatService.setPendingTeamAction(Actions.Escape);
            return;
        }
        this.combatService.sendCombatAction(this.playerService.roomId, this.playerService.player, Actions.Escape);
    }

    ngOnDestroy(): void {
        if (this._choicePopUpSubscription) {
            this._choicePopUpSubscription.unsubscribe();
        }
        if (this._timeSubscription) {
            this._timeSubscription.unsubscribe();
        }
        if (this._escapePopUpSubscription) {
            this._escapePopUpSubscription.unsubscribe();
        }
    }

    private listenerStartCombat() {
        this._choicePopUpSubscription = this.combatService.choicePopUp.subscribe(() => {
            this.startCombat();
        });
    }
}
