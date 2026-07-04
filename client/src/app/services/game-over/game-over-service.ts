import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Routes } from '@app/enums/routes-enums';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { SNACKBAR_TIME, WINNING_CONDITION } from '@common/constants';
import { CombatResults, GameModes } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { CombatUpdate, GameStats, GlobalStats, NoMorePlayerPayload, Player } from '@common/interfaces';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class GameOverService {
    gameStats: GameStats;
    private _isVictory: boolean = false;
    private _statsRequested: boolean = false;
    private readonly _gameOverSubject = new BehaviorSubject<ActiveGameEvents | undefined>(undefined);
    private readonly _winnerSubject = new BehaviorSubject<Player | undefined>(undefined);
    private _destroy$ = new Subject<void>();
    private readonly alertService = inject(AlertService);
    private readonly authService = inject(AuthService);

    constructor(
        private readonly socketService: SocketService,
        private readonly router: Router,
        private readonly turnService: TurnService,
        private readonly activeGridService: ActiveGridService,
        private readonly gameModeService: GameModeService,
        private readonly translate: TranslateService,
    ) {}

    init() {
        this._destroy$ = new Subject<void>();
        this.listenForNoMorePlayers();
        this.listenForWinner();
        this.listenForGameEnded();
    }

    cleanup() {
        this.turnOffListeners();
        this.resetGameOverState();
        this._isVictory = false;
        this._statsRequested = false;
    }

    getGameOverStatus() {
        return this._gameOverSubject.asObservable();
    }

    getWinner() {
        return this._winnerSubject.asObservable();
    }

    handleGameOver(isGameOver: ActiveGameEvents | undefined, winner: Player | undefined, currentPlayer: Player) {
        if (isGameOver === ActiveGameEvents.NoMorePlayers) {
            this.noMorePlayers();
            return;
        }

        if (isGameOver === ActiveGameEvents.CombatUpdate && winner) {
            this.gameOver(winner, currentPlayer);
            return;
        }
    }

    turnOffListeners() {
        this.socketService.off(ActiveGameEvents.CombatUpdate);
        this.socketService.off(ActiveGameEvents.NoMorePlayers);
        this.socketService.off(ActiveGameEvents.GameEnded);
        this._destroy$.next();
        this._destroy$.complete();
    }

    private resetGameOverState() {
        this._gameOverSubject.next(undefined);
        this._winnerSubject.next(undefined);
    }

    private listenForNoMorePlayers() {
        this.socketService.on<NoMorePlayerPayload>(ActiveGameEvents.NoMorePlayers, () => {
            this._gameOverSubject.next(ActiveGameEvents.NoMorePlayers);
        });
    }

    private listenForWinner() {
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatUpdate, (data) => {
            if (this.gameModeService.gameMode !== GameModes.Classic) return;
            if (data.message !== CombatResults.AttackDefeated) return;
            if (data.teamCombatContinues) return;

            const players = data.gameState?.players as Player[] | undefined;
            if (!players) return;

            let winner: Player | undefined;

            if (data.winningPlayerIds && data.winningPlayerIds.length > 0) {
                winner = players.find((player) => data.winningPlayerIds?.includes(player.id) && (player.victories ?? 0) >= WINNING_CONDITION);
            } else {
                winner = players[0];
            }

            if (winner) {
                this._winnerSubject.next(winner);
                this._gameOverSubject.next(ActiveGameEvents.CombatUpdate);
            }
        });

        this.gameModeService.winningTeamSubject.pipe(takeUntil(this._destroy$)).subscribe((team) => {
            if (this.gameModeService.gameMode === GameModes.CTF && team && team.length !== 0) {
                if (team.some((player) => player.id === this.turnService.playerId)) {
                    this.alertService.announceWinner(this.translate.instant('game_over.you_won'));
                } else {
                    const winners = team.map((player) => player.name).join(', ');
                    this.alertService.announceWinner(
                        team.length === 1
                            ? this.translate.instant('game_over.winner_singular', { name: winners })
                            : this.translate.instant('game_over.winners_plural', { names: winners }),
                    );
                }
                this.handleGameEnd();
            }
        });
    }

    private gameOver(winner: Player, currentPlayer: Player) {
        if (winner?.victories && winner.victories >= WINNING_CONDITION) {
            this._isVictory = true;
            if (currentPlayer.id === winner.id) {
                this.alertService.announceWinner(this.translate.instant('game_over.you_won'));
            } else {
                this.alertService.announceWinner(this.translate.instant('game_over.winner_singular', { name: winner.name }));
            }
            this.handleGameEnd();
        }
    }

    private noMorePlayers() {
        if (this._isVictory) return;
        this.resetGameOverState();
        this.socketService.disconnect();
        this.router.navigate([Routes.Home]).then(() => {
            this.alertService.showInfo('popup.disconnected_title', 'common.disconnected_last_player');
        });
        return;
    }

    private listenForGameEnded() {
        this.socketService.on<GameStats>(ActiveGameEvents.GameEnded, (data) => {
            this.gameStats = {
                players: data.players || [],
                globalStats: this.sanitizeGlobalStats(data.globalStats),
                rewards: data.rewards || [],
                gameMode: data.gameMode,
            };
            this.authService.loadUserProfile();
            setTimeout(() => {
                localStorage.setItem('gameStats', JSON.stringify(this.gameStats));
                void this.router.navigate([Routes.End]);
            }, SNACKBAR_TIME);
        });
    }

    private handleGameEnd() {
        if (this._statsRequested) return;
        this._statsRequested = true;
        this.socketService.sendMessage(ActiveGameEvents.FetchStats, {
            roomId: this.activeGridService.roomId,
            grid: this.activeGridService.gridSubject.getValue(),
        });
        this.turnService.removeListeners();
        this.activeGridService.deselectPlayer();
        this.turnService.freezeTurn();
    }

    private sanitizeGlobalStats(globalStats?: Partial<GlobalStats>): GlobalStats {
        return {
            duration: globalStats?.duration || 0,
            totalTurns: globalStats?.totalTurns || 0,
            doorsUsed: globalStats?.doorsUsed || [],
            doorsUsedPercent: globalStats?.doorsUsedPercent || 0,
            tilesVisited: globalStats?.tilesVisited || [],
            tilesVisitedPercentage: globalStats?.tilesVisitedPercentage || 0,
            flagHolders: globalStats?.flagHolders || [],
        };
    }
}
