import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CombatService } from '@app/services/combat/combat.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { AVATARS } from '@common/avatar';
import { TEAM_CONFIG } from '@common/constants';
import { VirtualPlayerTypes, PlayerState, LobbyGameMode } from '@common/enums';
import { CTFEvents } from '@common/gateway-events';
import { FlagHolderPayload, Player } from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { combineLatest, Subscription } from 'rxjs';

@Component({
    selector: 'app-player-list',
    imports: [CommonModule, TranslateModule],
    templateUrl: './player-list.component.html',
    styleUrl: './player-list.component.scss',
    standalone: true,
})
export class PlayerListComponent implements OnDestroy, OnInit {
    readonly virtualPlayerTypes = VirtualPlayerTypes;
    private _staticPlayers: Player[] = [];
    private _disconnectedPlayerIds: Set<string> = new Set();
    private _currentTurn: Player | undefined;
    private readonly _subscription: Subscription = new Subscription();
    private _flagHolderId: string | undefined;

    constructor(
        private readonly combatService: CombatService,
        private readonly turnService: TurnService,
        private readonly playerService: PlayerService,
        private readonly gameModeService: GameModeService,
        private readonly socketService: SocketService,
        private readonly translate: TranslateService,
    ) {}

    get currentTurn() {
        return this._currentTurn;
    }
    get flagHolderId() {
        return this._flagHolderId;
    }
    get staticPlayers() {
        return this._staticPlayers;
    }
    ngOnInit() {
        this.trackPlayerChanges();
    }

    ngOnDestroy() {
        this._subscription.unsubscribe();
        this.socketService.off(CTFEvents.FlagTaken);
        this.socketService.off(CTFEvents.FlagDropped);
    }

    isPlayerDisconnected(playerId: string): boolean {
        return this._disconnectedPlayerIds.has(playerId);
    }

    isCtf() {
        return this.gameModeService.isCtf();
    }

    isTeamGameMode() {
        return this.gameModeService.isTeamGameMode();
    }

    getTeamId(playerId: string) {
        return this.gameModeService.getTeamId(playerId);
    }

    isPartOfOwnTeam(playerId: string) {
        return this.gameModeService.isPartOfOwnTeam(playerId);
    }

    virtualPlayerType(player: Player) {
        if (player.type) {
            return player.type === VirtualPlayerTypes.Defensive
                ? this.translate.instant('player_list.def')
                : this.translate.instant('player_list.agr');
        }
        return '---';
    }

    isFastElimination() {
        return this.gameModeService.lobbyGameMode === LobbyGameMode.FastElimination;
    }

    isSpectator(player: Player): boolean {
        return player.state === PlayerState.ELIMINATED || !!player.isSpectator;
    }

    getPlayerAvatar(player: Player): string | undefined {
        if (!player.avatar) return undefined;
        return AVATARS.find((avatar) => avatar.name === player.avatar)?.icon;
    }

    getTeamColor(player: Player): string {
        if (!player) return 'transparent';

        const teamId = this.gameModeService.getTeamId(player.id).toString();
        const config = TEAM_CONFIG.find((team) => team.id === teamId);

        return config ? config.color : 'transparent';
    }

    private trackCurrentTurn() {
        this._subscription.add(
            this.turnService.getCurrentTurn().subscribe({
                next: (player) => {
                    this._currentTurn = player;
                },
            }),
        );
    }

    private trackGameUpdates() {
        this._subscription.add(
            this.combatService.getCombatWinner().subscribe((winnerId) => {
                const player = this._staticPlayers.find((playerToFind) => playerToFind.id === winnerId);
                if (player) {
                    player.victories = (player.victories ?? 0) + 1;
                    this._staticPlayers = [...this._staticPlayers];
                }
            }),
        );
    }

    private trackPlayers() {
        this.playerService.fetchPlayersOnDropIn();
        this._subscription.add(
            combineLatest([this.playerService.players$, this.playerService.disconnectedPlayers$]).subscribe(
                ([activePlayers, disconnectedPlayers]) => {
                    this._disconnectedPlayerIds = new Set(disconnectedPlayers.map((player) => player.id));
                    this._staticPlayers = [...activePlayers, ...disconnectedPlayers];
                },
            ),
        );
    }

    private trackPlayerChanges(): void {
        this.socketService.on<FlagHolderPayload>(CTFEvents.FlagTaken, (data) => {
            this._flagHolderId = data.flagHolder.id;
        });
        this.socketService.on(CTFEvents.FlagDropped, () => {
            this._flagHolderId = undefined;
        });
        this.trackCurrentTurn();
        this.trackPlayers();
        this.trackGameUpdates();
    }
}
