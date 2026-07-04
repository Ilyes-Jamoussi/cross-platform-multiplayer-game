import { EventEmitter, Injectable, OnDestroy } from '@angular/core';
import { AlertService } from '@app/services/alert/alert.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TimeService } from '@app/services/time/time.service';
import { TURN_DELAY, TURN_TIME } from '@common/constants';
import { PlayerState } from '@common/enums';
import { ActiveGameEvents, TimerEvents } from '@common/gateway-events';
import { GameDisconnect, Player, PlayerNextPosition, TimerEndPayload, TurnUpdate } from '@common/interfaces';
import { Position } from '@common/types';
import { BehaviorSubject, filter, Observable, Subscription, take } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class TurnService implements OnDestroy {
    onNewTurn = new EventEmitter<void>();
    private readonly _isPlayerMoving = new BehaviorSubject<boolean>(false);
    private readonly _quittingPlayerId$ = new BehaviorSubject<string | undefined>(undefined);
    private readonly _currentTurn$ = new BehaviorSubject<Player | undefined>(undefined);
    private readonly _blockPlaying$ = new BehaviorSubject<boolean>(false);
    private _currentTimerSubscription: Subscription;
    private _isTurn: boolean = false;
    private _playerLastPosition: Position;
    constructor(
        private readonly socketService: SocketService,
        private readonly playerService: PlayerService,
        private readonly alertService: AlertService,
        private readonly timeService: TimeService,
        private readonly gameModeService: GameModeService,
    ) {}

    get isBlocking() {
        return this._blockPlaying$.getValue();
    }
    get blockPlaying(): Observable<boolean> {
        return this._blockPlaying$.asObservable();
    }

    get playerLastPosition() {
        return this._playerLastPosition;
    }

    get playerId() {
        return this.playerService.player.id;
    }

    get timeLeft(): number {
        let timeLeft = 0;
        this.timeService
            .getTimeObservable()
            .pipe(take(1))
            .subscribe((time) => {
                if (typeof time === 'number') {
                    timeLeft = time;
                }
            });
        return timeLeft;
    }

    init() {
        this.setupTurnListener();
        this.setupTimerListener();
        this.setupPlayerMovingListener();
        this.timeService.init();
    }

    ngOnDestroy() {
        if (this._currentTimerSubscription) {
            this._currentTimerSubscription.unsubscribe();
        }
        this.removeListeners();
    }

    isPartOfOwnTeam(player: Player): boolean {
        return this.gameModeService.isPartOfOwnTeam(player.id);
    }

    getQuittingPlayerId(): Observable<string | undefined> {
        return this._quittingPlayerId$.asObservable();
    }

    getCurrentTurn(): Observable<Player | undefined> {
        return this._currentTurn$.asObservable();
    }

    getPlayer() {
        return { ...this.playerService.player, avatar: this.playerService.avatar };
    }

    isMyTurn(): boolean {
        return this._currentTurn$.value?.id === this.playerService.player.id;
    }

    freezeTurn() {
        this.timeService.stopTimer();
    }

    unfreezeTurn(isCombat: boolean) {
        let startValue = this.timeLeft;
        if (startValue === 0) {
            startValue = 1;
        }
        this.timeService.startTimer(startValue, isCombat, true);
    }

    alert(message: string) {
        this.alertService.showInfo('popup.error_title', message);
    }

    nextTurn() {
        const roomId = this.playerService.roomId;
        if (roomId && this.isMyTurn() && !this.isObserver(this.playerService.player)) {
            if (this._isPlayerMoving.value) {
                this._isPlayerMoving
                    .pipe(
                        filter((isMoving) => !isMoving),
                        take(1),
                    )
                    .subscribe(() => {
                        this.socketService.sendMessage(ActiveGameEvents.NextTurn, { roomId });
                    });
                return;
            } else {
                this.socketService.sendMessage(ActiveGameEvents.NextTurn, { roomId });
            }
        }
    }

    removeListeners() {
        this._currentTurn$.next(undefined);
        this.socketService.off(TimerEvents.TimerEnd);
        this.socketService.off(ActiveGameEvents.PlayerDisconnect);
        this.socketService.off(ActiveGameEvents.TurnUpdate);
    }

    private setupTurnListener() {
        this.socketService.on<TurnUpdate>(ActiveGameEvents.TurnUpdate, (data) => {
            if (this._currentTurn$.value?.id !== data.player.id) {
                this._currentTurn$.next(undefined);
                this._blockPlaying$.next(true);
                this.alertService.notify(`game_page.turn_notification|{"name":"${data.player.name}"}`);
                this.timeService.resetTimer(TURN_DELAY);
                this._isTurn = false;

                this._currentTimerSubscription = this.timeService.getTimeObservable().subscribe((timeLeft) => {
                    this.onNewTurn.emit();
                    if (timeLeft === 0 && this._isTurn) {
                        if (this._currentTimerSubscription) {
                            this._currentTimerSubscription.unsubscribe();
                        }
                        this._currentTurn$.next(data.player);
                        this._blockPlaying$.next(false);
                        this.timeService.resetTimer(TURN_TIME);
                    }
                    this._isTurn = true;
                });
            }
        });

        this.socketService.on<GameDisconnect>(ActiveGameEvents.PlayerDisconnect, (data) => {
            this._quittingPlayerId$.next(data.playerId);
            if (data.remainingPlayers && data.disconnectedPlayers) {
                this.playerService.updatePlayersState(data.remainingPlayers, data.disconnectedPlayers);
            }
        });
    }

    private setupPlayerMovingListener() {
        this.socketService.on<PlayerNextPosition>(ActiveGameEvents.PlayerStartedMoving, () => {
            this._isPlayerMoving.next(true);
        });

        this.socketService.on<PlayerNextPosition>(ActiveGameEvents.PlayerNextPosition, (data) => {
            this._playerLastPosition = data.nextPosition;
        });

        this.socketService.on<PlayerNextPosition>(ActiveGameEvents.PlayerStoppedMoving, () => {
            this._isPlayerMoving.next(false);
        });
    }

    private setupTimerListener() {
        this.socketService.on<TimerEndPayload>(TimerEvents.TimerEnd, (data) => {
            if (this.isMyTurn() && data.turnEnd) {
                this.nextTurn();
            }
        });
    }

    private isObserver(player?: Player): boolean {
        return !!player && (player.state === PlayerState.ELIMINATED || !!player.isSpectator);
    }
}
