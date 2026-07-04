import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CombatService } from '@app/services/combat/combat.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { AVATARS } from '@common/avatar';
import { TEAM_CONFIG } from '@common/constants';
import { CombatResults } from '@common/enums';
import { CombatUpdate, Player } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-combat-spectator-card',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './combat-spectator-card.component.html',
    styleUrl: './combat-spectator-card.component.scss',
})
export class CombatSpectatorCardComponent implements OnInit, OnDestroy {
    private _isVisible = false;
    private _attacker: Player | undefined;
    private _defender: Player | undefined;
    private _isTeamCombat = false;
    private _teamAId = '';
    private _teamAColor = '';
    private _teamAIcon = '';
    private _teamBId = '';
    private _teamBColor = '';
    private _teamBIcon = '';
    private _teamAPlayers: Player[] = [];
    private _teamBPlayers: Player[] = [];
    private _spectatingSubscription: Subscription;
    private _diceRollSubscription: Subscription;

    constructor(
        private readonly combatService: CombatService,
        private readonly gameModeService: GameModeService,
    ) {}

    get isVisible(): boolean {
        return this._isVisible;
    }
    get attacker(): Player | undefined {
        return this._attacker;
    }
    get defender(): Player | undefined {
        return this._defender;
    }
    get isTeamCombat(): boolean {
        return this._isTeamCombat;
    }
    get teamAId(): string {
        return this._teamAId;
    }
    get teamAColor(): string {
        return this._teamAColor;
    }
    get teamAIcon(): string {
        return this._teamAIcon;
    }
    get teamBId(): string {
        return this._teamBId;
    }
    get teamBColor(): string {
        return this._teamBColor;
    }
    get teamBIcon(): string {
        return this._teamBIcon;
    }
    get teamAPlayers(): Player[] {
        return this._teamAPlayers;
    }
    get teamBPlayers(): Player[] {
        return this._teamBPlayers;
    }

    ngOnInit(): void {
        this._spectatingSubscription = this.combatService.isSpectatingCombat$.subscribe((spectating) => {
            if (spectating) {
                this.showCard();
            } else {
                this.hideCard();
            }
        });

        this._diceRollSubscription = this.combatService.diceRoll.subscribe((data: CombatUpdate) => {
            if (!this._isVisible) return;
            if (data.message === CombatResults.TargetSelected || data.message === CombatResults.CombatStarted) {
                this.updateFighters(data);
            }
            if (data.gameState?.combat?.teamCombat) {
                if (!this._isTeamCombat) {
                    this._isTeamCombat = true;
                    this.resolveTeamInfo();
                }
                this.resolveTeamPlayers(data);
            }
        });
    }

    ngOnDestroy(): void {
        this._spectatingSubscription?.unsubscribe();
        this._diceRollSubscription?.unsubscribe();
    }

    getAvatarIdle(avatarName: string | undefined): string {
        if (avatarName) {
            const avatar = AVATARS.find((avt) => avt.name === avatarName);
            if (avatar?.combatIdle) return avatar.combatIdle;
        }
        return 'assets/avatar_combat/avatar_idle/archer.gif';
    }

    private showCard(): void {
        this._attacker = this.combatService.combatInitiator;
        this._defender = this.combatService.attackedPlayer;
        const combatData = this.combatService.combatUpdateData;
        this._isTeamCombat = !!(this.combatService.teamCombatState ?? combatData?.gameState?.combat?.teamCombat);

        if (this._isTeamCombat) {
            this.resolveTeamInfo();
            this.resolveTeamPlayers(combatData);
        }

        this._isVisible = true;
    }

    private hideCard(): void {
        this._isVisible = false;
        this._attacker = undefined;
        this._defender = undefined;
        this._isTeamCombat = false;
        this._teamAPlayers = [];
        this._teamBPlayers = [];
    }

    private updateFighters(data: CombatUpdate): void {
        const players = data.gameState?.players as Player[];
        if (!players) return;
        const attackerId = data.gameState?.combat?.attacker;
        const defenderId = data.gameState?.combat?.defender;
        if (attackerId) this._attacker = players.find((player) => player.id === attackerId);
        if (defenderId) this._defender = players.find((player) => player.id === defenderId);
    }

    private resolveTeamPlayers(data: CombatUpdate | undefined): void {
        const teamCombat = data?.gameState?.combat?.teamCombat ?? this.combatService.teamCombatState;
        const players = data?.gameState?.players as Player[] | undefined;
        if (!teamCombat || !players?.length) return;

        this._teamAPlayers = players.filter((player) => teamCombat.teamA.includes(player.id));
        this._teamBPlayers = players.filter((player) => teamCombat.teamB.includes(player.id));
    }

    private resolveTeamInfo(): void {
        const teamCombat = this.combatService.teamCombatState ?? this.combatService.combatUpdateData?.gameState?.combat?.teamCombat;
        if (!teamCombat) return;

        const teamAPlayerId = (teamCombat.initialTeamA ?? teamCombat.teamA)[0];
        const teamBPlayerId = (teamCombat.initialTeamB ?? teamCombat.teamB)[0];

        if (teamAPlayerId) {
            this._teamAId = this.gameModeService.getTeamId(teamAPlayerId);
            const configA = TEAM_CONFIG.find((team) => team.id === this._teamAId);
            this._teamAColor = configA?.color ?? '#ffffff';
            this._teamAIcon = configA?.icon ?? '';
        }

        if (teamBPlayerId) {
            this._teamBId = this.gameModeService.getTeamId(teamBPlayerId);
            const configB = TEAM_CONFIG.find((team) => team.id === this._teamBId);
            this._teamBColor = configB?.color ?? '#ffffff';
            this._teamBIcon = configB?.icon ?? '';
        }
    }
}
