/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable, OnDestroy } from '@angular/core';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { WINNING_CONDITION } from '@common/constants';
import { CombatResults, ItemId } from '@common/enums';
import { ActiveGameEvents, CTFEvents, DebugEvents } from '@common/gateway-events';
import { CombatUpdate, DebugResponse, FlagHolderPayload, GameDisconnect, ItemUpdate, Log, Player, ToggleDoor, TurnUpdate } from '@common/interfaces';
import { newDate } from '@common/shared-utils';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, take } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class LogService implements OnDestroy {
    private readonly _logs = new BehaviorSubject<Log[]>([]);
    private readonly _remainingPlayers = new BehaviorSubject<Player[]>([]);
    private readonly _allLogs: Log[] = [];
    private _areLogsFiltered: boolean = false;
    private _activeAttackerId?: string;
    private _activeDefenderId?: string;

    constructor(
        private readonly socketService: SocketService,
        private readonly playerService: PlayerService,
        private readonly gameModeService: GameModeService,
        private readonly translate: TranslateService,
    ) {
        this.playerService
            .getPlayers()
            .pipe(take(1))
            .subscribe((players) => {
                this._remainingPlayers.next(players);
            });
    }

    get logs(): Observable<Log[]> {
        return this._logs.asObservable();
    }

    ngOnDestroy(): void {
        this.socketService.off(ActiveGameEvents.ItemPickedUp);
        this.socketService.off(ActiveGameEvents.CombatUpdate);
        this.socketService.off(ActiveGameEvents.NextTurn);
        this.socketService.off(ActiveGameEvents.PlayerDisconnect);
        this.socketService.off(ActiveGameEvents.CombatInitiated);
        this.socketService.off(ActiveGameEvents.DoorUpdate);
        this.socketService.off(CTFEvents.FlagTaken);
        this.socketService.off(CTFEvents.FlagCaptured);
    }

    filterLogs() {
        if (this._areLogsFiltered) {
            this._logs.next(this._allLogs);
            this._areLogsFiltered = false;
            return;
        }

        const playerId = this.playerService?.player?.id;

        this._logs.next(this._allLogs.filter((log) => log?.defendingPlayer?.id === playerId || log?.message?.player?.id === playerId));

        this._areLogsFiltered = true;
    }

    setupListeners() {
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatInitiated, (data) => {
            this._activeAttackerId = data.gameState?.combat?.attacker;
            this._activeDefenderId = data.gameState?.combat?.defender;

            const attackerName = data.gameState?.players?.find((player) => player.id === this._activeAttackerId)?.name ?? 'Player 1';
            const defenderName = data.gameState?.players?.find((player) => player.id === this._activeDefenderId)?.name ?? 'Player 2';

            this.addLog(
                this.createNewLog(
                    this.translate.instant('log.combat_initiated', {
                        player1: attackerName,
                        player2: defenderName,
                    }),
                ),
            );
        });
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatUpdate, (data) => {
            this.handleCombatUpdate(data);
        });

        this.socketService.on<ItemUpdate>(ActiveGameEvents.ItemPickedUp, (data) => {
            if (data.item?.id === ItemId.ItemFlag) return;
            const player = this._remainingPlayers.value.find((playerToFind) => playerToFind.id === data.playerId);
            this.addLog(this.createNewLog(this.translate.instant('log.item_picked_up', { name: player?.name }), player));
        });

        this.socketService.on<TurnUpdate>(ActiveGameEvents.TurnUpdate, (data) => {
            this.addLog(this.createNewLog(this.translate.instant('log.turn_update', { name: data.player.name }), data.player));
        });

        this.socketService.on<GameDisconnect>(ActiveGameEvents.PlayerDisconnect, (data) => {
            const quittingPlayer = this._remainingPlayers.value.find((player) => player.id === data.playerId);
            this._remainingPlayers.next(data.remainingPlayers as Player[]);
            this.addLog(this.createNewLog(this.translate.instant('log.player_disconnected', { name: quittingPlayer?.name }), quittingPlayer));
        });

        this.socketService.on<ToggleDoor>(ActiveGameEvents.DoorUpdate, (data) => {
            const key = data.isOpened ? 'log.door_opened' : 'log.door_closed';
            this.addLog(this.createNewLog(this.translate.instant(key, { name: data.player?.name }), data.player));
        });

        this.socketService.on<DebugResponse>(DebugEvents.ToggleDebug, (response) => {
            const key = response.isDebug ? 'log.debug_enabled' : 'log.debug_disabled';
            this.addLog(this.createNewLog(this.translate.instant(key)));
        });

        this.socketService.on<FlagHolderPayload>(CTFEvents.FlagTaken, (data) => {
            this.addLog(this.createNewLog(this.translate.instant('log.flag_taken', { name: data.flagHolder.name })));
        });
        this.socketService.on(CTFEvents.FlagCaptured, () => {
            this.endGameLog();
        });
    }

    private addLog(log: Log) {
        this._allLogs.push(log);
        if (!this._areLogsFiltered) {
            this._logs.next([...this._logs.value, log]);
        }
    }

    private handleCombatUpdate(combat: CombatUpdate): void {
        const players = combat.gameState?.players;
        if (!players) return;

        const isTeam = !!combat.gameState?.combat?.teamCombat || !!combat.winningPlayerIds;

        if (isTeam) {
            this.handleTeamCombatUpdate(combat, players as Player[]);
        } else {
            this.handle1v1CombatUpdate(combat, players as Player[]);
        }
    }

    private handle1v1CombatUpdate(combat: CombatUpdate, players: Player[]): void {
        // 1. Grab players using our TRACKERS, not the new flipped game state
        const attacker = players.find((player) => player.id === this._activeAttackerId);
        const defender = players.find((player) => player.id === this._activeDefenderId);

        const loser = players.find((player) => player.id === combat.defeatedPlayerId) ?? defender;
        const winner = players.find((player) => player.id !== combat.defeatedPlayerId) ?? attacker;

        switch (combat.message) {
            case CombatResults.AttackDefeated:
                this.attackType(attacker ?? winner!, defender ?? loser!, combat);
                this.fightEnded(winner!, loser!);
                break;
            case CombatResults.AttackNotDefeated:
                this.attackType(attacker!, defender!, combat);
                break;
            case CombatResults.EscapeSucceeded:
                this.escapeSucceeded(winner!, loser!);
                break;
            case CombatResults.EscapeFailed:
                this.escapeFailed(attacker!, defender!);
                break;
        }

        this._activeAttackerId = combat.gameState?.combat?.attacker;
        this._activeDefenderId = combat.gameState?.combat?.defender;
    }

    // eslint-disable-next-line complexity
    private handleTeamCombatUpdate(combat: CombatUpdate, players: Player[]): void {
        if (combat.message === (CombatResults.TargetSelected as CombatResults)) {
            this._activeAttackerId = combat.gameState?.combat?.attacker;
            this._activeDefenderId = combat.gameState?.combat?.defender;
            return;
        }

        const attacker = players.find((player) => player.id === this._activeAttackerId);
        const defender = players.find((player) => player.id === this._activeDefenderId);

        switch (combat.message) {
            case CombatResults.AttackNotDefeated: {
                if (!attacker || !defender) break;

                this.addLog(
                    this.createNewLog(
                        this.translate.instant('log.attacked', { attacker: attacker.name, defender: defender.name }),
                        attacker,
                        defender,
                    ),
                );
                this.addLog(
                    this.createNewLog(
                        this.translate.instant('log.dice_roll', {
                            attacker: attacker.name,
                            attackRoll: combat.diceAttack,
                            defender: defender.name,
                            defenseRoll: combat.diceDefense,
                        }),
                        attacker,
                        defender,
                    ),
                );
                break;
            }

            case CombatResults.AttackDefeated: {
                const defeated = players.find((player) => player.id === combat.defeatedPlayerId) ?? defender;
                const killer = attacker;

                if (defeated && killer && defeated.id !== killer.id) {
                    this.addLog(
                        this.createNewLog(
                            this.translate.instant('log.dice_roll', {
                                attacker: killer.name,
                                attackRoll: combat.finalDice?.attack,
                                defender: defeated.name,
                                defenseRoll: combat.finalDice?.defense,
                            }),
                            killer,
                            defeated,
                        ),
                    );
                    this.addLog(this.createNewLog(this.translate.instant('log.team_eliminated', { name: defeated.name }), defeated));
                }

                if (!combat.teamCombatContinues) {
                    this.teamFightEnded(combat, players);
                }
                break;
            }

            case CombatResults.EscapeSucceeded: {
                if (combat.teamCombatContinues) {
                    const escaper = players.find((player) => player.id === combat.escapedPlayerId) ?? attacker;
                    if (!escaper) break;
                    this.addLog(this.createNewLog(this.translate.instant('log.team_escape', { name: escaper.name }), escaper));
                } else {
                    const aTeamFled = (combat.losingPlayerIds?.length || 0) > 0 || (combat.winningPlayerIds?.length || 0) > 0;
                    if (aTeamFled) {
                        this.addLog(this.createNewLog(this.translate.instant('log.team_fled')));
                    }
                }
                break;
            }

            case CombatResults.EscapeFailed: {
                if (!attacker || !defender) break;

                this.addLog(
                    this.createNewLog(
                        this.translate.instant('log.escape_attempt', { attacker: attacker.name, defender: defender.name }),
                        attacker,
                        defender,
                    ),
                );
                this.addLog(
                    this.createNewLog(
                        this.translate.instant('log.escape_failed', { attacker: attacker.name, defender: defender.name }),
                        attacker,
                        defender,
                    ),
                );
                break;
            }
        }

        this._activeAttackerId = combat.gameState?.combat?.attacker;
        this._activeDefenderId = combat.gameState?.combat?.defender;
    }

    private teamFightEnded(combat: CombatUpdate, players: Player[]): void {
        const winnerNames = (combat.winningPlayerIds ?? []).map((id) => players.find((player) => player.id === id)?.name ?? id).join(', ');
        const loserNames = (combat.losingPlayerIds ?? []).map((id) => players.find((player) => player.id === id)?.name ?? id).join(', ');
        this.addLog(this.createNewLog(this.translate.instant('log.team_fight_ended', { winners: winnerNames, losers: loserNames })));

        if (!this.gameModeService.isCtf()) {
            const myId = this.playerService.player.id;
            const iWon = combat.winningPlayerIds?.includes(myId);
            const iLost = combat.losingPlayerIds?.includes(myId);
            if (iWon || iLost) {
                const winner = players.find((player) => combat.winningPlayerIds?.includes(player.id));
                if (winner && (winner.victories as number) >= WINNING_CONDITION) {
                    this.endGameLog();
                }
            }
        }
    }

    private fightEnded(winner: Player, loser: Player) {
        this.addLog(this.createNewLog(this.translate.instant('log.fight_ended', { winner: winner.name, loser: loser.name }), winner, loser));
        if ((winner.victories as number) >= WINNING_CONDITION && !this.gameModeService.isCtf()) {
            this.endGameLog();
        }
    }

    private escapeSucceeded(winner: Player, loser: Player) {
        this.addLog(this.createNewLog(this.translate.instant('log.escape_attempt', { attacker: winner.name, defender: loser.name }), winner, loser));
        this.addLog(this.createNewLog(this.translate.instant('log.escaped', { attacker: winner.name, defender: loser.name }), winner, loser));
    }

    private escapeFailed(attacker: Player, defender: Player) {
        this.addLog(
            this.createNewLog(this.translate.instant('log.escape_attempt', { attacker: attacker.name, defender: defender.name }), attacker, defender),
        );
        this.addLog(
            this.createNewLog(this.translate.instant('log.escape_failed', { attacker: attacker.name, defender: defender.name }), attacker, defender),
        );
    }

    private attackType(attacker: Player, defender: Player, combat: CombatUpdate) {
        this.addLog(
            this.createNewLog(this.translate.instant('log.attacked', { attacker: attacker.name, defender: defender.name }), attacker, defender),
        );

        this.addLog(
            this.createNewLog(
                this.translate.instant('log.dice_roll', {
                    attacker: attacker.name,
                    attackRoll: combat.finalDice ? combat.finalDice.attack : combat.diceAttack,
                    defender: defender.name,
                    defenseRoll: combat.finalDice ? combat.finalDice.defense : combat.diceDefense,
                }),
                attacker,
                defender,
            ),
        );
    }

    private endGameLog() {
        const names = this._remainingPlayers.value.map((player) => player.name).join(', ');
        this.addLog(this.createNewLog(this.translate.instant('log.end_game', { names })));
    }

    private createNewLog(message: string, player1?: Player, player2?: Player): Log {
        return {
            message: {
                player: player1 as Player,
                time: newDate(),
                message,
            },
            defendingPlayer: player2,
        };
    }
}
