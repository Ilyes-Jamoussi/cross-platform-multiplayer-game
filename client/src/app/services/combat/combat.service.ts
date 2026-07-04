import { EventEmitter, Injectable, Injector, OnDestroy } from '@angular/core';
import { ActionService } from '@app/services/action/action.service';
import { AlertService } from '@app/services/alert/alert.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { Actions, CombatResults } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { Combat, CombatAction, CombatUpdate, GameDisconnect, Player, PlayerAction, TeamCombatState } from '@common/interfaces';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Observable, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CombatService implements OnDestroy {
    choicePopUp = new EventEmitter<void>();
    showTargetSelection = new EventEmitter<void>();
    cancelEscapes = new EventEmitter<void>();
    escapeAttemptsUpdated = new EventEmitter<{ playerId: string }>();
    diceRoll = new EventEmitter<CombatUpdate>();
    private _pendingTeamAction: Actions.Attack | Actions.Escape | null = null;
    private _combatInitiator: Player | undefined = undefined;
    private _attackedPlayer: Player | undefined = undefined;
    private readonly _combatWinner = new BehaviorSubject<string | undefined>(undefined);
    private _combatUpdateData: CombatUpdate | undefined;
    private _teamCombatState: TeamCombatState | undefined;
    private _availableTargets: Player[] = [];
    private _gameRoomPlayers: Player[] | undefined;
    private _isInCombat = false;
    private _isWaitingForCombatEnd = false;
    private readonly _animationComplete = new Subject<void>();
    private readonly _isSpectatingCombat = new BehaviorSubject<boolean>(false);

    constructor(
        private readonly playerService: PlayerService,
        private readonly socketService: SocketService,
        private readonly turnService: TurnService,
        private readonly alertService: AlertService,
        private readonly injector: Injector,
        private readonly translate: TranslateService,
    ) {
        this.init();
    }

    get combatInitiator() {
        return this._combatInitiator;
    }
    get attackedPlayer() {
        return this._attackedPlayer;
    }
    get combatUpdateData() {
        return this._combatUpdateData;
    }
    get teamCombatState() {
        return this._teamCombatState;
    }
    get availableTargets() {
        return this._availableTargets;
    }
    get animationComplete$(): Observable<void> {
        return this._animationComplete.asObservable();
    }
    get isInCombat(): boolean {
        return this._isInCombat;
    }
    get isWaitingForCombatEnd(): boolean {
        return this._isWaitingForCombatEnd;
    }
    get isSpectatingCombat$(): Observable<boolean> {
        return this._isSpectatingCombat.asObservable();
    }
    get pendingTeamAction(): Actions.Attack | Actions.Escape | null {
        return this._pendingTeamAction;
    }
    private get actionService(): ActionService {
        return this.injector.get(ActionService);
    }

    set combatInitiator(combatInitiator: Player | undefined) {
        this._combatInitiator = combatInitiator;
    }

    set attackedPlayer(attackedPlayer: Player | undefined) {
        this._attackedPlayer = attackedPlayer;
    }

    notifyAnimationComplete(): void {
        this._animationComplete.next();
    }

    updateEscapeAttempts(playerId: string | undefined) {
        if (playerId) {
            this.escapeAttemptsUpdated.emit({ playerId });
        }
    }

    getCombatWinner() {
        return this._combatWinner.asObservable();
    }

    setPendingTeamAction(action: Actions.Attack | Actions.Escape): void {
        this._pendingTeamAction = action;
        if (action === Actions.Attack) {
            this.showTargetSelection.emit();
        } else {
            // Flee: auto-select first enemy and send target selection
            const target = this._availableTargets[0];
            if (target) {
                this.sendTargetSelection(this.playerService.roomId, this.playerService.player, target.id);
            }
        }
    }

    sendCombatAction(roomId: string, player: Player, action: Actions.Attack | Actions.Escape) {
        this.socketService.sendMessage(ActiveGameEvents.CombatAction, { playerId: player.id, action, roomId } as CombatAction);
    }

    sendCombatInit(roomId: string, player: Player, action: Actions) {
        const defender = this._attackedPlayer;
        this.socketService.sendMessage(ActiveGameEvents.CombatStarted, { playerId: player.id, action, roomId, target: defender } as PlayerAction);
    }

    sendTargetSelection(roomId: string, player: Player, targetId: string) {
        this.socketService.sendMessage(ActiveGameEvents.SelectCombatTarget, {
            roomId,
            playerId: player.id,
            targetId,
        });
    }

    onCombatUpdate() {
        // eslint-disable-next-line complexity
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatUpdate, async (data) => {
            this.diceRoll.emit(data);
            const startingPlayer = data.gameState?.combat?.turn;
            this._combatUpdateData = data;

            if (data.message === CombatResults.TargetSelected) {
                if (data.gameState?.combat?.teamCombat) {
                    this._teamCombatState = data.gameState.combat.teamCombat;
                }
                // If we have a pending action (attack/flee chosen before target),
                // auto-send it now that the target is locked.
                if (this._pendingTeamAction && data.gameState?.combat?.attacker === this.playerService.player.id) {
                    const action = this._pendingTeamAction;
                    this._pendingTeamAction = null;
                    this.sendCombatAction(this.playerService.roomId, this.playerService.player, action);
                }
                return;
            }

            if (data.gameState?.combat?.teamCombat) {
                this._teamCombatState = data.gameState.combat.teamCombat;
                this.refreshAvailableTargets(data.gameState.combat, data.gameState.players as Player[]);
            }

            if (data.message === CombatResults.AttackNotDefeated) {
                await firstValueFrom(this.animationComplete$);
            }

            if (data.teamCombatContinues && (data.defeatedPlayerId ?? data.escapedPlayerId)) {
                const eliminatedId = data.defeatedPlayerId ?? data.escapedPlayerId;

                if (eliminatedId === this.playerService.player.id) {
                    this._isWaitingForCombatEnd = true;
                    this.combatEndReset();
                    this.actionService.onCombatEnded.emit();
                    return;
                }

                if (data.gameState?.combat?.teamCombat) {
                    this._teamCombatState = data.gameState.combat.teamCombat;
                    this.refreshAvailableTargets(data.gameState.combat, data.gameState.players as Player[]);
                }
                if (data.gameState?.combat?.attacker === this.playerService.player.id) {
                    this.choicePopUp.emit();
                }

                return;
            }

            if (data.message === CombatResults.EscapeFailed) {
                this.updateEscapeAttempts(startingPlayer);
                if (startingPlayer === this.playerService.player.id) {
                    this.choicePopUp.emit();
                }
            } else if (startingPlayer === this.playerService.player.id) {
                this.choicePopUp.emit();
            }

            const playerHasMaxEscapeAttempts = data.gameState?.players?.some(
                (player) => player.id === this.playerService.player.id && player.escapeAttempts === 0,
            );

            // Updates the player's local state (eliminated / spectator) as soon as the combat status is received.
            const localPlayer = data.gameState?.players?.find((player) => player.id === this.playerService.player.id);
            if (localPlayer) {
                this.playerService.player = {
                    ...this.playerService.player,
                    ...localPlayer,
                };
            }

            if (playerHasMaxEscapeAttempts) {
                this.cancelEscapes.emit();
            }
            if ((data.message === CombatResults.AttackDefeated || data.message === CombatResults.EscapeSucceeded) && !data.teamCombatContinues) {
                await this.combatEnded(data);
            }
        });
    }

    onCombatStarted() {
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatInitiated, (data) => {
            this._isInCombat = true;
            this._combatUpdateData = data;
            const startingPlayer = data.gameState?.combat?.turn;
            const players = data.gameState?.players as Player[];
            const combatInitiator = data.gameState?.combat?.attacker;
            this._combatInitiator = players.find((player) => player.id === combatInitiator);
            const attackedPlayer = data.gameState?.combat?.defender;
            this._attackedPlayer = players.find((player) => player.id === attackedPlayer);
            if (players && this.playerService.player.id) {
                if (data.gameState?.combat?.teamCombat) {
                    this._teamCombatState = data.gameState.combat.teamCombat;
                }

                const isPlayerInGame = players.some((player) => player.id === this.playerService.player.id);

                if (isPlayerInGame) {
                    if (data.gameState?.combat?.teamCombat) {
                        this.refreshAvailableTargets(data.gameState.combat, data.gameState.players as Player[]);
                    }
                    this.actionService.onCombatStart.emit();
                    this.diceRoll.emit(data);
                    if (data.gameState?.combat?.teamCombat) {
                        this.refreshAvailableTargets(data.gameState.combat, data.gameState.players as Player[]);
                    }
                } else {
                    this._isSpectatingCombat.next(true);
                }

                if (startingPlayer === this.playerService.player.id) {
                    setTimeout(() => {
                        this.choicePopUp.emit();
                    }, 0);
                }
            }
        });
    }

    onPlayerDisconnect() {
        this.socketService.on<GameDisconnect>(ActiveGameEvents.PlayerDisconnect, (data) => {
            if (!this._isInCombat) return;
            if (this._teamCombatState) return;

            const combatData = this._combatUpdateData as CombatUpdate;
            void this.fetchPlayers(this.playerService.getPlayers())
                .then(() => {
                    const disconnectedPlayerId = data.playerId;
                    const players = combatData.gameState?.players as Player[];
                    const isPlayerInGame = players.some((player) => player.id === disconnectedPlayerId);
                    const combatWinner = players.find((player) => player.id !== disconnectedPlayerId) as Player;
                    const roomPlayers = this._gameRoomPlayers as Player[];

                    if (isPlayerInGame && roomPlayers.length >= 2) {
                        this.handleCombatWinnerDisconnect(combatWinner);
                    }
                    this.endCombat();
                })
                .catch(() => {
                    return;
                });
        });
    }

    combatEnded(data: CombatUpdate) {
        const wasWaiting = this._isWaitingForCombatEnd;
        this._isWaitingForCombatEnd = false;
        this.combatEndReset();
        const players = data.gameState?.players as Player[];
        const isPlayerInGame = players.some((player) => player.id === this.playerService.player.id);

        if (data.message === CombatResults.AttackDefeated) {
            this.actionService.onCombatEnded.emit();
            if (!wasWaiting) {
                this.turnService.unfreezeTurn(false);
            }
            if (isPlayerInGame) {
                if (data.winningPlayerIds && data.winningPlayerIds.length > 0) {
                    const iWon = data.winningPlayerIds.includes(this.playerService.player.id);
                    if (iWon) {
                        this.alertService.announceWinner(this.translate.instant('combat.your_team_won'));
                    } else {
                        this.alertService.announceWinner(this.translate.instant('combat.enemy_team_won'));
                    }
                    if (!wasWaiting && this.turnService.isMyTurn()) {
                        if (this.actionService.hasActionLeftSubject.getValue() > 0) {
                            this.actionService.consumeAction();
                        }
                    }
                } else {
                    this.handleCombatWinner(data.gameState?.players[0] as Player);
                }
            }
        } else if (data.message === CombatResults.EscapeSucceeded) {
            this.escapeSucceedScenario();
        }
    }

    async fetchPlayers(playerObservable: Observable<Player[]>) {
        this._gameRoomPlayers = await firstValueFrom(playerObservable);
    }

    setupCombatWinnerListener() {
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatUpdate, (data) => {
            if (data.message === CombatResults.AttackDefeated && !data.teamCombatContinues) {
                if (data.winningPlayerIds && data.winningPlayerIds.length > 0) {
                    data.winningPlayerIds.forEach((id) => this._combatWinner.next(id));
                } else {
                    const winnerId = data.gameState?.players[0].id;
                    this._combatWinner.next(winnerId);
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.turnOffListeners();
    }
    private init() {
        this.setupCombatWinnerListener();
        this.onCombatStarted();
        this.onCombatUpdate();
        this.onPlayerDisconnect();
    }

    private turnOffListeners() {
        this.socketService.off(ActiveGameEvents.CombatInitiated);
        this.socketService.off(ActiveGameEvents.CombatUpdate);
        this.socketService.off(ActiveGameEvents.PlayerDisconnect);
    }

    private handleCombatWinnerDisconnect(combatWinner: Player) {
        if (this.playerService.player.id === combatWinner.id) {
            this.actionService.onCombatEnded.emit();
            this.alertService.announceWinner(this.translate.instant('combat.you_won'));
        } else {
            this.alertService.announceWinner(this.translate.instant('combat.winner', { name: combatWinner.name }));
        }
        this._combatWinner.next(combatWinner.id);
    }

    private endCombat() {
        this.turnService.unfreezeTurn(false);
        this._combatUpdateData = undefined;
        this._gameRoomPlayers = undefined;
        this._isSpectatingCombat.next(false);
        if (this.actionService.hasActionLeftSubject.getValue() > 0) {
            this.actionService.consumeAction();
        }
    }

    private handleCombatWinner(winner: Player) {
        if ((winner.victories as number) <= 2) {
            if (this.playerService.player.id === winner.id) {
                this.alertService.announceWinner(this.translate.instant('combat.you_won'));
            } else {
                this.alertService.announceWinner(this.translate.instant('combat.winner', { name: winner.name }));
            }
            if (this.turnService.isMyTurn() && this.actionService.hasActionLeftSubject.getValue() > 0) {
                this.actionService.consumeAction();
            }
        }
    }
    private combatEndReset() {
        this._combatInitiator = undefined;
        this._attackedPlayer = undefined;
        this._combatUpdateData = undefined;
        this._isInCombat = false;
        this._teamCombatState = undefined;
        this._availableTargets = [];
        this._pendingTeamAction = null;
        this._isSpectatingCombat.next(false);
    }

    private escapeSucceedScenario() {
        this.actionService.onCombatEnded.emit();
        this.turnService.unfreezeTurn(false);
        if (this.actionService.hasActionLeftSubject.getValue() > 0) {
            this.actionService.consumeAction();
        }
    }

    private refreshAvailableTargets(combat: Combat, allPlayers: Player[]) {
        if (!combat?.teamCombat) {
            this._availableTargets = [];
            return;
        }
        const teamCombat = combat.teamCombat as TeamCombatState;
        const myId = this.playerService.player.id;
        if (combat.attacker !== myId || !teamCombat.needsTargetSelection) {
            this._availableTargets = [];
            return;
        }
        const myInA = teamCombat.teamA.includes(myId);
        const enemyIds = myInA ? teamCombat.teamB : teamCombat.teamA;
        this._availableTargets = allPlayers.filter((player) => enemyIds.includes(player.id));
    }
}
