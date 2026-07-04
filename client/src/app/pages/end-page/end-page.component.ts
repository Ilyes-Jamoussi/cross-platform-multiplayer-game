import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { GameChatComponent } from '@app/components/game-chat/game-chat.component';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { PlayerService } from '@app/services/player/player.service';
import { MS_IN_SECOND, PADDED_SECONDS, SECONDS_IN_MINUTE } from '@common/constants';
import { GameReward, GameStats, GlobalStats, Player, PlayerStats } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-end-page',
    templateUrl: './end-page.component.html',
    styleUrls: ['./end-page.component.scss'],
    imports: [CommonModule, GameChatComponent, AsyncPipe, TranslateModule, CoinIconComponent],
    standalone: true,
})
export class EndPageComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    globalStats: GlobalStats = this.getDefaultGlobalStats();
    rewards: GameReward[] = [];
    formattedDuration = '0m 00s';
    sortedColumn: keyof PlayerStats | 'name' | null = null;
    isAscending: boolean = false;
    isCTF: boolean = false;
    userProfile$ = this.authService.userProfile$;

    constructor(
        private readonly playerService: PlayerService,
        private readonly authService: AuthService,
    ) {}

    get myReward(): GameReward | undefined {
        const name = this.playerService.player.name;
        return this.rewards.find((reward) => reward.username === name);
    }

    get myRewardAmount(): number {
        return this.myReward?.amount ?? 0;
    }

    getPreviousBalance(currentBalance: number): number {
        return currentBalance - this.myRewardAmount;
    }

    ngOnInit() {
        const gameStats = localStorage.getItem('gameStats');
        if (gameStats) {
            this.updateStats(JSON.parse(gameStats));
        }
    }

    ngOnDestroy() {
        localStorage.removeItem('gameStats');
    }

    isCurrentUser(player: Player) {
        return player.id === this.playerService.player.id;
    }

    sortTable(column: keyof PlayerStats | 'name') {
        if (this.players.length === 0) return;

        if (this.sortedColumn === column) {
            this.isAscending = !this.isAscending;
        } else {
            this.sortedColumn = column;
            this.isAscending = true;
        }

        this.players.sort((playerA, playerB) => {
            if (column === 'name') {
                const nameA = playerA.name?.toLowerCase() || '';
                const nameB = playerB.name?.toLowerCase() || '';
                return this.isAscending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            }

            const valueA = Number(playerA.playerStats?.[column]) || 0;
            const valueB = Number(playerB.playerStats?.[column]) || 0;
            return !this.isAscending ? valueA - valueB : valueB - valueA;
        });
    }

    private updateStats(gameStats: GameStats) {
        this.players = gameStats.players;
        this.globalStats = gameStats.globalStats;
        this.rewards = gameStats.rewards || [];
        this.isCTF = gameStats.gameMode === 'CTF';
        this.formattedDuration = this.formatTime(this.globalStats.duration);
    }

    private formatTime(durationInMs: number): string {
        const totalSeconds = Math.floor(durationInMs / MS_IN_SECOND);
        const minutes = Math.floor(totalSeconds / SECONDS_IN_MINUTE);
        const seconds = totalSeconds % SECONDS_IN_MINUTE;
        const paddedSeconds = seconds < PADDED_SECONDS ? `0${seconds}` : seconds;
        return `${minutes}m ${paddedSeconds}s`;
    }

    private getDefaultGlobalStats(): GlobalStats {
        return {
            duration: 0,
            totalTurns: 0,
            doorsUsed: [],
            doorsUsedPercent: 0,
            tilesVisited: [],
            tilesVisitedPercentage: 0,
            flagHolders: [],
        };
    }
}
