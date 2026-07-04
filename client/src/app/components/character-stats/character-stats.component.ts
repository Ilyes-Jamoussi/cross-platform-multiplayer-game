import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { PlayerService } from '@app/services/player/player.service';
import { BASE_STAT, BOOST, MAX_STAT, STAT_PAIRS } from '@common/constants';
import { StatsType } from '@common/enums';
import { Stats } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-character-stats',
    imports: [CommonModule, MatTooltip, MatTooltipModule, TranslateModule],
    templateUrl: './character-stats.component.html',
    styleUrls: ['./character-stats.component.scss'],
    standalone: true,
})
export class CharacterStatsComponent {
    @Output() isValidChange = new EventEmitter<boolean>();

    protected readonly statsType = StatsType;
    private _stats: Stats = { life: BASE_STAT, speed: BASE_STAT, attack: BASE_STAT, defense: BASE_STAT, maxSpeed: BASE_STAT };
    private readonly max: number = MAX_STAT;
    private isValid: boolean = false;

    constructor(private readonly playerService: PlayerService) {
        this.playerService.player.stats = this.stats;
    }
    get stats(): Stats {
        return this._stats;
    }
    set stats(stats: Stats) {
        this._stats = { ...stats, maxSpeed: stats.speed };
    }
    canValidate(): boolean {
        return this.isLifeOrSpeedMax() && this.isAttackOrDefenseMax();
    }

    toggleStat(statType: StatsType.Life | StatsType.Speed | StatsType.Attack | StatsType.Defense) {
        const oppositeStat = STAT_PAIRS[statType];
        this.boostStat(this.stats[statType], oppositeStat, statType);
        this.updateValidationAndPlayerService();
    }

    isLifeOrSpeedMax(): boolean {
        return [this.stats.life, this.stats.speed].includes(this.max);
    }

    isAttackOrDefenseMax(): boolean {
        return [this.stats.attack, this.stats.defense].includes(this.max);
    }

    private boostStat(currentStat: number, oppositeStat: keyof Stats, statType: keyof Stats) {
        if (currentStat < MAX_STAT) {
            this.stats[statType] = Math.min(MAX_STAT, currentStat + BOOST);

            if (statType === StatsType.Speed) {
                this.stats.maxSpeed = this.stats.speed;
            }

            if (this.stats[statType] === MAX_STAT) {
                this.stats[oppositeStat] = BASE_STAT;
            }
        }
    }

    private updateValidationAndPlayerService() {
        this.isValid = this.canValidate();
        this.isValidChange.emit(this.isValid);
        this.playerService.player.stats = this.stats;
    }
}
