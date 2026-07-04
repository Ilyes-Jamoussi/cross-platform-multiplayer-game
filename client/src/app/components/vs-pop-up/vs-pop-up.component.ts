/* eslint-disable max-lines */
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CombatChoiceComponent } from '@app/components/combat-choice/combat-choice.component';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { CombatService } from '@app/services/combat/combat.service';
import { PlayerService } from '@app/services/player/player.service';
import { AVATARS } from '@common/avatar';
import { BASE_STAT, ICE_DEBUFF, MAX_ESCAPE_ATTEMPTS, MS_IN_SECOND, SNACKBAR_TIME, TARGET_SELECTION_SECONDS } from '@common/constants';
import { CombatResults, TileTypes } from '@common/enums';
import { BoardCell, CombatUpdate, Player, Stats } from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-vs-pop-up',
    standalone: true,
    imports: [CommonModule, CombatChoiceComponent, TranslateModule],
    templateUrl: './vs-pop-up.component.html',
    styleUrl: './vs-pop-up.component.scss',
})
export class VsPopUpComponent implements OnInit, OnDestroy {
    private readonly _fireBackgroundPath: string = './assets/fire-background.gif';
    private readonly _iceDebuff: string = './assets/ice-debuff.gif';
    private _isVisible: boolean = false;
    private _combatInitiator?: Player;
    private _attacker?: Player;
    private _attackedPlayer?: Player;
    private _attackedDiceRoll: number | string = '-';
    private _initiatorDiceRoll: number | string = '-';
    private escapeAttemptsSubscription?: Subscription;
    private diceRollSubscription?: Subscription;
    private gridSubscription?: Subscription;
    private winnerIdSubscription?: Subscription;
    private board: BoardCell[][];
    private _winnerId: string;
    private _isInitiatorAttacker: boolean;
    private _isAttacking: boolean = false;
    private _attackAnimationTimeout?: number;
    private _teamA: Player[] = [];
    private _teamB: Player[] = [];
    private _selectingTarget = false;
    private _availableTargets: Player[] = [];
    private targetSelectionSubscription?: Subscription;
    private _targetTimeLeft: number = 0;
    private _targetTimerInterval?: number;
    private _displayedAttackerId: string | undefined;
    private _displayedDefenderId: string | undefined;
    private _diceAttackPlayerId: string | undefined;
    private _diceDefensePlayerId: string | undefined;
    private _waitingForActionChoice = false;
    private _choicePlayerId: string | undefined;
    private _lastSeenAttackerId: string | undefined;

    constructor(
        private readonly combatService: CombatService,
        private readonly playerService: PlayerService,
        private readonly activeGridService: ActiveGridService,
        private readonly translate: TranslateService,
    ) {}

    get attackedDiceRoll(): number | string {
        return this._attackedDiceRoll;
    }
    get isInitiatorAttacker(): boolean {
        return this._isInitiatorAttacker;
    }
    get iceDebuff(): string {
        return this._iceDebuff;
    }
    get initiatorDiceRoll(): number | string {
        return this._initiatorDiceRoll;
    }
    get backgroundPath(): string {
        return this._fireBackgroundPath;
    }
    get isVisible(): boolean {
        return this._isVisible;
    }
    get combatInitiator(): Player | undefined {
        return this._combatInitiator;
    }
    get attacker(): Player | undefined {
        return this._attacker;
    }
    get attackedPlayer(): Player | undefined {
        return this._attackedPlayer;
    }
    get isAttacking(): boolean {
        return this._isAttacking;
    }
    get teamA(): Player[] {
        return this._teamA;
    }
    get teamB(): Player[] {
        return this._teamB;
    }
    get selectingTarget(): boolean {
        return this._selectingTarget;
    }
    get availableTargets(): Player[] {
        return this._availableTargets;
    }
    get targetTimeLeft(): number {
        return this._targetTimeLeft;
    }

    get isTeamCombat(): boolean {
        return !!this.combatService.teamCombatState;
    }

    get currentAttackerId(): string | undefined {
        return this._displayedAttackerId;
    }

    get currentDefenderId(): string | undefined {
        return this._displayedDefenderId;
    }

    get attackArrowDirection(): string {
        const attackerInA = this._teamA.some((player) => player.id === this.currentAttackerId);
        return attackerInA ? '⟶' : '⟵';
    }
    get shouldShowChoosingLabel(): boolean {
        return this._waitingForActionChoice && this._choicePlayerId !== this.playerService.player.id;
    }

    ngOnInit(): void {
        this.gridSubscription = this.activeGridService.grid$.subscribe((grid) => {
            if (grid) this.board = grid.board;
        });

        this.escapeAttemptsSubscription = this.combatService.escapeAttemptsUpdated.subscribe(({ playerId }) => {
            this.updateEscapeAttempts(playerId);
        });

        this.diceRollSubscription = this.combatService.diceRoll.subscribe((data) => {
            if (data.message === CombatResults.CombatStarted) {
                this._isInitiatorAttacker = this._combatInitiator?.id === data.gameState?.combat?.attacker;
                return;
            }
            if (data.message === CombatResults.TargetSelected) {
                this._displayedAttackerId = data.gameState?.combat?.attacker;
                this._displayedDefenderId = data.gameState?.combat?.defender;
                // Only show "choosing" label if there is no pending action
                // (i.e. we're waiting for the OTHER player to pick action first).
                if (!this.combatService.pendingTeamAction) {
                    this._choicePlayerId = data.gameState?.combat?.attacker;
                    this._waitingForActionChoice = true;
                }
                return;
            }
            void this.handleDiceRoll(data);
        });

        this.winnerIdSubscription = this.combatService.getCombatWinner().subscribe((winner) => {
            if (winner) this._winnerId = winner;
        });

        this.targetSelectionSubscription = this.combatService.showTargetSelection.subscribe(() => {
            if (this.combatService.availableTargets.length > 0) {
                this._selectingTarget = true;
                this._availableTargets = [...this.combatService.availableTargets];
                this.startTargetSelectionTimer();
            }
        });
    }

    ngOnDestroy(): void {
        if (this._attackAnimationTimeout) clearTimeout(this._attackAnimationTimeout);
        this.stopTargetSelectionTimer();
        this.gridSubscription?.unsubscribe();
        this.escapeAttemptsSubscription?.unsubscribe();
        this.diceRollSubscription?.unsubscribe();
        this.winnerIdSubscription?.unsubscribe();
        this.targetSelectionSubscription?.unsubscribe();
    }

    initiateFight(): void {
        this._combatInitiator = this.combatService.combatInitiator;
        this._attackedPlayer = this.combatService.attackedPlayer;
        const teamCombat = this.combatService.teamCombatState;

        if (teamCombat && this.combatService.combatUpdateData?.gameState?.players) {
            const allPlayers = this.combatService.combatUpdateData.gameState.players as Player[];
            this._teamA = allPlayers.filter((player) => teamCombat.teamA.includes(player.id));
            this._teamB = allPlayers.filter((player) => teamCombat.teamB.includes(player.id));
        }

        this._displayedAttackerId = this.combatService.combatUpdateData?.gameState?.combat?.attacker;
        this._displayedDefenderId = this.combatService.combatUpdateData?.gameState?.combat?.defender;

        if (this._combatInitiator) this._combatInitiator.isIceApplied = this.isPlayerOnIceTile(this._combatInitiator);
        if (this._attackedPlayer) this._attackedPlayer.isIceApplied = this.isPlayerOnIceTile(this._attackedPlayer);
        this._isVisible = true;
    }

    endFight(): void {
        if (this._combatInitiator && this._attackedPlayer && this._combatInitiator.stats && this._attackedPlayer.stats) {
            if (this._combatInitiator.id === this._winnerId) {
                this._attackedPlayer.stats.life = 0;
            } else {
                this._combatInitiator.stats.life = 0;
            }
        }
        setTimeout(() => {
            this._combatInitiator = undefined;
            this._attackedPlayer = undefined;
            this._attackedDiceRoll = '-';
            this._initiatorDiceRoll = '-';
            this._isVisible = false;
        }, MS_IN_SECOND);
    }

    selectTarget(target: Player): void {
        if (!this._selectingTarget) return;
        this.stopTargetSelectionTimer();
        this._selectingTarget = false;
        this._availableTargets = [];
        this.combatService.sendTargetSelection(this.playerService.roomId, this.playerService.player, target.id);
    }

    rolePlayer(player: Player | undefined): string {
        if (!player) return '';
        return this.currentAttackerId === player.id
            ? this.translate.instant('combat.attacker') + ' :'
            : this.translate.instant('combat.defender') + ' :';
    }

    isCurrentTarget(player: Player): boolean {
        return player.id === this.currentDefenderId;
    }

    isCurrentAttacker(player: Player): boolean {
        return player.id === this.currentAttackerId;
    }
    isDiceAttackPlayer(player: Player): boolean {
        return player.id === this._diceAttackPlayerId;
    }
    isDiceDefensePlayer(player: Player): boolean {
        return player.id === this._diceDefensePlayerId;
    }
    getPlayerDiceRoll(player: Player): number | string {
        if (this.isDiceAttackPlayer(player)) return this._initiatorDiceRoll;
        if (this.isDiceDefensePlayer(player)) return this._attackedDiceRoll;
        return '-';
    }

    getAvatarIdleAnimation(avatarName: string | undefined): string {
        if (avatarName) {
            const avatar = AVATARS.find((avt) => avt.name === avatarName);
            if (avatar) return avatar.combatIdle as string;
        }
        return 'assets/avatar_combat/avatar_idle/archer.gif';
    }

    getAvatarAttackAnimation(avatarName: string | undefined): string {
        if (avatarName) {
            const avatar = AVATARS.find((avt) => avt.name === avatarName);
            if (avatar) return avatar.attack as string;
        }
        return 'assets/avatar_combat/avatar_attack/archer.gif';
    }

    private startTargetSelectionTimer(): void {
        this.stopTargetSelectionTimer();
        this._targetTimeLeft = TARGET_SELECTION_SECONDS;
        this._targetTimerInterval = window.setInterval(() => {
            this._targetTimeLeft--;
            if (this._targetTimeLeft <= 0) {
                this.stopTargetSelectionTimer();
                if (this._availableTargets.length > 0) {
                    const random = Math.floor(Math.random() * this._availableTargets.length);
                    this.selectTarget(this._availableTargets[random]);
                }
            }
        }, MS_IN_SECOND);
    }

    private stopTargetSelectionTimer(): void {
        if (this._targetTimerInterval) {
            clearInterval(this._targetTimerInterval);
            this._targetTimerInterval = undefined;
        }
    }

    private isPlayerOnIceTile(player: Player): boolean {
        if (!player.position || !this.board) return false;
        const playerStats = player.stats as Stats;
        const tile = this.board[player.position.x]?.[player.position.y];
        if (tile?.tile === TileTypes.Ice) {
            playerStats.attack = ICE_DEBUFF;
            playerStats.defense = ICE_DEBUFF;
        } else {
            playerStats.attack = BASE_STAT;
            playerStats.defense = BASE_STAT;
        }
        return tile?.tile === TileTypes.Ice;
    }

    private updateEscapeAttempts(playerId: string): void {
        if (this._combatInitiator?.id === playerId && this._attackedPlayer) {
            this._attackedPlayer.escapeAttempts = (this._attackedPlayer.escapeAttempts ?? MAX_ESCAPE_ATTEMPTS) - 1;
        } else if (this._attackedPlayer?.id === playerId && this._combatInitiator) {
            this._combatInitiator.escapeAttempts = (this._combatInitiator.escapeAttempts ?? MAX_ESCAPE_ATTEMPTS) - 1;
        }
    }

    // eslint-disable-next-line complexity
    private async handleDiceRoll(data: CombatUpdate): Promise<void> {
        const currentCombat = data.gameState?.combat;
        const currentAttackerId = currentCombat?.attacker;
        const currentDefenderId = currentCombat?.defender;
        const previousDisplayedAttackerId = this._displayedAttackerId;
        const previousDisplayedDefenderId = this._displayedDefenderId;

        if (currentAttackerId && this._lastSeenAttackerId && this._lastSeenAttackerId !== currentAttackerId) {
            this._choicePlayerId = currentAttackerId;
            this._waitingForActionChoice = true;
        }
        if (currentAttackerId) {
            this._lastSeenAttackerId = currentAttackerId;
        }

        if (
            data.message === CombatResults.AttackNotDefeated ||
            data.message === CombatResults.AttackDefeated ||
            data.message === CombatResults.EscapeFailed ||
            data.message === CombatResults.EscapeSucceeded
        ) {
            const actorId = data.lastAttackerId ?? previousDisplayedAttackerId ?? currentAttackerId;
            if (actorId && actorId === this._choicePlayerId) {
                this._waitingForActionChoice = false;
                this._choicePlayerId = undefined;
            }
        }

        if (this._combatInitiator?.stats && this._attackedPlayer?.stats) {
            const initiator = data.gameState?.players.find((player) => player.id === this._combatInitiator?.id) as Player;
            const attacked = data.gameState?.players.find((player) => player.id === this._attackedPlayer?.id) as Player;
            if (initiator?.stats && attacked?.stats) {
                this._combatInitiator.stats.life = initiator.stats.life;
                this._attackedPlayer.stats.life = attacked.stats.life;
            }

            if (data.message === CombatResults.AttackNotDefeated) {
                const lastAttackerId = data.lastAttackerId ?? data.gameState?.combat?.defender;
                const initiatorAttacked = this._combatInitiator?.id === lastAttackerId;

                if (initiatorAttacked) {
                    this._initiatorDiceRoll = data.diceDefense as number;
                    this._attackedDiceRoll = data.diceAttack as number;
                    this._attackedPlayer.stats.attack = data.attack as number;
                    this._combatInitiator.stats.defense = data.defense as number;
                } else {
                    this._attackedDiceRoll = data.diceDefense as number;
                    this._initiatorDiceRoll = data.diceAttack as number;
                    this._combatInitiator.stats.attack = data.attack as number;
                    this._attackedPlayer.stats.defense = data.defense as number;
                }
            }

            if (data.message === CombatResults.AttackDefeated && data.finalDice) {
                const actingAttackerId = data.lastAttackerId ?? this._displayedAttackerId ?? data.gameState?.combat?.attacker;
                const defendingPlayerId = data.defeatedPlayerId ?? this._displayedDefenderId ?? data.gameState?.combat?.defender;

                this._diceAttackPlayerId = actingAttackerId;
                this._diceDefensePlayerId = defendingPlayerId;
                this._initiatorDiceRoll = data.finalDice.attack;
                this._attackedDiceRoll = data.finalDice.defense;
            }

            this._isInitiatorAttacker = this._combatInitiator?.id === data.gameState?.combat?.attacker;
        }

        if (data.message === CombatResults.AttackNotDefeated) {
            const animatorId = data.lastAttackerId ?? data.gameState?.combat?.defender;
            const attackerPlayer = data.gameState?.players.find((player) => player.id === animatorId);
            if (attackerPlayer) {
                await this.startAttackAnimation(attackerPlayer);
            }
            this.combatService.notifyAnimationComplete();

            this._diceAttackPlayerId = data.lastAttackerId ?? data.gameState?.combat?.defender;
            this._diceDefensePlayerId = previousDisplayedDefenderId ?? currentDefenderId;
        }

        if (data.message === CombatResults.EscapeFailed) {
            this._displayedAttackerId = data.gameState?.combat?.attacker;
            this._displayedDefenderId = data.gameState?.combat?.defender;
        }

        if (data.message === CombatResults.EscapeSucceeded && data.teamCombatContinues) {
            this._displayedAttackerId = data.gameState?.combat?.attacker;
            this._displayedDefenderId = data.gameState?.combat?.defender;
        }

        if (data.gameState?.combat?.teamCombat) {
            this._displayedAttackerId = currentAttackerId;
            if (currentDefenderId) {
                this._displayedDefenderId = currentDefenderId;
            }
        }

        const teamCombat = data.gameState?.combat?.teamCombat;
        if (teamCombat && data.gameState?.players) {
            const allPlayers = data.gameState.players as Player[];
            this._teamA = allPlayers.filter((player) => teamCombat.teamA.includes(player.id));
            this._teamB = allPlayers.filter((player) => teamCombat.teamB.includes(player.id));
        }
    }

    private async startAttackAnimation(attacker: Player): Promise<void> {
        return new Promise((resolve) => {
            this._isAttacking = true;
            this._attacker = attacker;
            const avatarData = AVATARS.find((avt) => avt.name === attacker.avatar);
            const duration = avatarData?.attackDuration || SNACKBAR_TIME;

            if (this._attackAnimationTimeout) clearTimeout(this._attackAnimationTimeout);

            this._attackAnimationTimeout = window.setTimeout(() => {
                this._isAttacking = false;
                this._attacker = undefined;
                resolve();
            }, duration);
        });
    }
}
