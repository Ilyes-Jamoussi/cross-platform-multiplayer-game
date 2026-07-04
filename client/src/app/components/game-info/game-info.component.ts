import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { DebugComponent } from '@app/components/debug/debug.component';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { GameModes, LobbyGameMode } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { GameDisconnect, Grid } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-game-info',
    imports: [CommonModule, DebugComponent, TranslateModule],
    templateUrl: './game-info.component.html',
    styleUrls: ['./game-info.component.scss'],
    standalone: true,
})
export class GameInfoComponent implements OnInit, OnDestroy {
    private static readonly gameModeKeys: Record<string, string> = {
        [`${GameModes.Classic}_${LobbyGameMode.Classic}`]: 'game_page.game_infos.mode_classic_standard',
        [`${GameModes.Classic}_${LobbyGameMode.Teams}`]: 'game_page.game_infos.mode_classic_teams',
        [`${GameModes.Classic}_${LobbyGameMode.FastElimination}`]: 'game_page.game_infos.mode_classic_fast_elimination',
        [`${GameModes.CTF}_${LobbyGameMode.Classic}`]: 'game_page.game_infos.mode_ctf_standard',
        [`${GameModes.CTF}_${LobbyGameMode.Teams}`]: 'game_page.game_infos.mode_ctf_teams',
        [`${GameModes.CTF}_${LobbyGameMode.FastElimination}`]: 'game_page.game_infos.mode_ctf_fast_elimination',
    };

    private _playerNameTurn: string | undefined;
    private _grid: Grid;
    private _numberOfPlayers: number = 0;
    private readonly _destroy$ = new Subject<void>();

    constructor(
        private readonly turnService: TurnService,
        private readonly activeGridService: ActiveGridService,
        private readonly playerService: PlayerService,
        private readonly socketService: SocketService,
        private readonly gameModeService: GameModeService,
    ) {}

    get playerNameTurn() {
        return this._playerNameTurn;
    }

    get numberOfPlayers() {
        return this._numberOfPlayers;
    }

    get grid() {
        return this._grid;
    }

    get gameModeTranslationKey(): string {
        const key = `${this.gameModeService.gameMode}_${this.gameModeService.lobbyGameMode}`;
        return GameInfoComponent.gameModeKeys[key] ?? '';
    }

    ngOnInit(): void {
        this.activeGridService.gridSubject.pipe(takeUntil(this._destroy$)).subscribe((grid) => {
            if (grid) {
                this._grid = grid;
            }
        });
        this.playerService
            .getPlayers()
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: (players) => {
                    this._numberOfPlayers = players.length;
                },
            });

        this.socketService.on<GameDisconnect>(ActiveGameEvents.PlayerDisconnect, () => {
            this._numberOfPlayers--;
        });

        this.turnService
            .getCurrentTurn()
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: (playerWithTurn) => {
                    if (playerWithTurn) {
                        this._playerNameTurn = playerWithTurn.name;
                    }
                },
            });
    }

    ngOnDestroy() {
        this.socketService.off(ActiveGameEvents.PlayerDisconnect);
        this._destroy$.next();
        this._destroy$.complete();
    }
}
