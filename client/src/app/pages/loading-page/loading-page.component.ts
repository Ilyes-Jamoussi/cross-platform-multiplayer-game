import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { GameChatComponent } from '@app/components/game-chat/game-chat.component';
import { PlayerCardComponent } from '@app/components/player-card/player-card.component';
import { Loading } from '@app/enums/loading-page-enums';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { LOADING_DOTS_INTERVAL, N_LOADING_DOTS } from '@common/constants';
import { GameModes, LobbyGameMode, Players, VirtualPlayerTypes } from '@common/enums';
import { GameRoomEvents } from '@common/gateway-events';
import {
    DropInDropOutResponse,
    FogOfWarResponse,
    FriendOnlyResponse,
    LobbyGameModeResponse,
    LockResponse,
    Player,
    RoomData,
    SocketResponse,
    Team,
} from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { interval, Subscription } from 'rxjs';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-loading-page',
    templateUrl: './loading-page.component.html',
    styleUrls: ['./loading-page.component.scss'],
    imports: [CommonModule, PlayerCardComponent, MatTooltip, GameChatComponent, TranslateModule, DragDropModule, CoinIconComponent],
    standalone: true,
})
export class LoadingPageComponent implements OnInit, OnDestroy {
    isLocked: boolean = false;
    isFriendsOnly: boolean = false;
    isFogOfWar: boolean = false;
    isLoading: boolean = true;
    loadingDots: string = '';
    players: Player[] = [];
    teams: Team[] = [];
    minPlayers: number;
    maxPlayers: number;
    entryFee: number = 0;
    isVirtualPlayerTypeVisible: boolean;
    lobbyGameMode: LobbyGameMode = LobbyGameMode.Classic;
    dropdownOpen = false;
    private readonly maxPlayersPerTeam = 2;
    private readonly maxTeamsLarge = 3;
    private loadingDotsSubscription: Subscription;
    private readonly translate = inject(TranslateService);
    constructor(
        private readonly socketService: SocketService,
        private readonly playerService: PlayerService,
        readonly gameModeService: GameModeService,
        private readonly router: Router,
        private readonly alertService: AlertService,
    ) {}

    get isSmallGame(): boolean {
        return this.maxPlayers === Players.SmallMap;
    }

    get isMediumGame(): boolean {
        return this.maxPlayers === Players.MediumMap;
    }

    get gridColumns(): number {
        if (this.isSmallGame) return 2;
        if (this.isMediumGame) return 2;
        return this.maxTeamsLarge;
    }

    get teamCount(): number {
        if (this.isMediumGame) return 2;
        return this.maxTeamsLarge;
    }

    get visibleTeams(): Team[] {
        return this.teams.slice(0, this.teamCount);
    }

    get emptySlots(): number[] {
        const filledCount = this.players.length;
        const remaining = this.maxPlayers - filledCount;
        return remaining > 0 ? Array(remaining).fill(0) : [];
    }

    get teamEmptySlotsMap(): Map<string, number[]> {
        const map = new Map<string, number[]>();
        for (const team of this.visibleTeams) {
            const remaining = this.maxPlayersPerTeam - team.players.length;
            map.set(team.id, remaining > 0 ? Array(remaining).fill(0) : []);
        }
        return map;
    }

    get classicModeTranslationKey(): string {
        return this.gameModeService.gameMode === GameModes.CTF ? 'loading_page.modes.ctf_standard' : 'loading_page.modes.classic_standard';
    }

    get unassignedPlayers(): Player[] {
        if (this.lobbyGameMode !== LobbyGameMode.Teams) return [];
        const assignedIds = new Set(this.teams.flatMap((team) => team.players.map((player) => player.id)));
        return this.players.filter((player) => !assignedIds.has(player.id));
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const clickedInsideDropdown = target.closest('.type-prompt') || target.closest('.add-player');
        if (!clickedInsideDropdown) {
            this.isVirtualPlayerTypeVisible = false;
        }
        if (!target.closest('.custom-select')) {
            this.dropdownOpen = false;
        }
    }

    ngOnInit() {
        if (this.playerService.player.avatar === 'Knuckles') {
            void new Audio('/assets/audio/easter-egg.mp3').play();
        }
        if (this.playerService.roomId === '') {
            void this.router.navigate([Routes.Home]).then(() => this.alertService.showInfo('popup.left_game_title', 'popup.left_game_message'));
        }
        this.playerService.updateRoom();
        this.setupRoomUpdateListener();
        this.loadingDotsSubscription = interval(LOADING_DOTS_INTERVAL).subscribe(() => {
            this.loadingDots = this.loadingDots.length < N_LOADING_DOTS ? this.loadingDots + '.' : '';
        });
    }
    ngOnDestroy() {
        this.socketService.off<SocketResponse>(GameRoomEvents.RoomUpdate);
        this.socketService.off<SocketResponse>(GameRoomEvents.ToggleLock);
        this.socketService.off(GameRoomEvents.StartGame);
        this.socketService.off(GameRoomEvents.UpdateTeams);
        this.socketService.off(GameRoomEvents.ToggleFriendOnly);
        this.socketService.off(GameRoomEvents.SetLobbyGameMode);
        this.socketService.off(GameRoomEvents.ToggleFogOfWar);
        this.socketService.off(GameRoomEvents.ToggleDropInDropOut);
        if (this.loadingDotsSubscription) {
            this.loadingDotsSubscription.unsubscribe();
        }
    }

    canStartGame() {
        if (!this.isLocked) return false;
        if (this.lobbyGameMode === LobbyGameMode.Classic || this.lobbyGameMode === LobbyGameMode.FastElimination) {
            return this.players.length >= this.minPlayers;
        }
        if (this.lobbyGameMode === LobbyGameMode.Teams) {
            const activeTeams = this.teams.filter((team) => team.players.length > 0);
            const totalAssignedPlayers = this.teams.reduce((sum, team) => sum + team.players.length, 0);
            const hasEnoughTeams = activeTeams.length >= 2;
            const eachTeamIsFull = activeTeams.every((team) => team.players.length === 2);
            const everyoneIsAssigned = totalAssignedPlayers === this.players.length;

            return hasEnoughTeams && eachTeamIsFull && everyoneIsAssigned;
        }
        return false;
    }

    checkLoadingState() {
        this.isLoading = this.players.length < this.maxPlayers && !this.isLocked;
        this.isVirtualPlayerTypeVisible = this.isLoading ? this.isVirtualPlayerTypeVisible : false;
    }

    addVirtualPlayer(event?: MouseEvent): void {
        if (event) event.stopPropagation();
        if (this.players.length >= this.maxPlayers) return;
        this.isVirtualPlayerTypeVisible = !this.isVirtualPlayerTypeVisible;
    }

    onChooseVirtualPlayerType(type: string): void {
        if (this.players.length < this.maxPlayers) {
            this.playerService.addVirtualPlayer(type as VirtualPlayerTypes);
            this.checkLoadingState();
        }
        this.isVirtualPlayerTypeVisible = false;
    }

    startGame(): void {
        this.playerService.startGame();
    }

    leaveGame(): void {
        this.playerService.quitGame();
    }

    async onKick(player: Player): Promise<void> {
        const confirmed = await this.alertService.confirm('popup.kick_player_title', 'popup.kick_player_message', undefined, undefined, {
            name: player.name || '',
        });
        if (!confirmed) return;
        const playerToKickIndex = this.players.findIndex((plr: Player) => plr.id === player.id);
        if (playerToKickIndex !== -1) {
            this.playerService.kickPlayer(this.players[playerToKickIndex].id);
        }
    }

    isHost() {
        return this.playerService.player.isHost;
    }

    getRoomId() {
        return this.playerService.roomId;
    }

    onFriendOnly() {
        this.playerService.toggleFriendOnly();
    }

    onLock() {
        this.playerService.toggleLock();
    }

    onToggleDropInDropOut() {
        this.playerService.toggleDropInDropOut();
    }

    onToggleFogOfWar() {
        this.playerService.toggleFogOfWar();
    }

    selectMode(mode: string): void {
        this.dropdownOpen = false;
        if (mode === this.lobbyGameMode) return;
        this.socketService.sendMessage(GameRoomEvents.SetLobbyGameMode, {
            roomId: this.playerService.roomId,
            mode,
        });
    }

    getModeLabel(mode: string): string {
        const key =
            mode === 'classic'
                ? this.classicModeTranslationKey
                : mode === 'teams'
                ? 'loading_page.modes.teams'
                : 'loading_page.modes.fast_elimination';
        return this.translate.instant(key);
    }

    getVirtualPlayerText(): string {
        return Loading.VirtualPlayer;
    }
    getStartText(): string[] {
        if (this.canStartGame()) return [];
        const conditions: string[] = [];
        if (!this.isLocked && !this.isSmallGame) {
            conditions.push('loading_page.start_tooltip.locked');
        }
        if (this.lobbyGameMode === LobbyGameMode.Classic || this.lobbyGameMode === LobbyGameMode.FastElimination) {
            if (this.players.length < this.minPlayers) {
                conditions.push('loading_page.start_tooltip.min_players');
            }
        }
        if (this.lobbyGameMode === LobbyGameMode.Teams) {
            const activeTeams = this.teams.filter((team) => team.players.length > 0);
            const totalAssignedPlayers = this.teams.reduce((sum, team) => sum + team.players.length, 0);
            if (activeTeams.length < 2) {
                conditions.push('loading_page.start_tooltip.min_teams');
            }
            if (activeTeams.some((team) => team.players.length !== 2)) {
                conditions.push('loading_page.start_tooltip.team_size');
            }
            if (totalAssignedPlayers < this.players.length) {
                conditions.push('loading_page.start_tooltip.unassigned');
            }
        }
        return conditions;
    }

    isTeamFull(team: Team): boolean {
        return team.players.length >= this.maxPlayersPerTeam;
    }

    selectTeam(teamId: string): void {
        const team = this.visibleTeams.find((visibleTeam) => visibleTeam.id === teamId);
        if (team && this.isTeamFull(team)) return;
        this.playerService.selectTeam(teamId);
    }

    leaveTeam(): void {
        this.playerService.leaveTeam();
    }

    drop(event: CdkDragDrop<Player[]>, targetTeamId: string): void {
        if (!this.isHost()) return;
        if (event.previousContainer === event.container) return;

        const player: Player = event.item.data;
        if (!this.isVirtualPlayer(player)) return;

        const targetTeam = this.visibleTeams.find((visibleTeam) => visibleTeam.id === targetTeamId);
        if (targetTeam && this.isTeamFull(targetTeam)) return;

        this.playerService.changeVirtualPlayerTeam(player, targetTeamId);
    }

    isVirtualPlayer(player: Player): boolean {
        return player.id.startsWith('virtual-');
    }

    getConnectedDropLists(currentTeamId: string): string[] {
        return this.visibleTeams.filter((team) => team.id !== currentTeamId).map((team) => 'team-' + team.id);
    }

    getTranslatedStartText(): string {
        const keys = this.getStartText();
        if (keys.length === 0) return '';
        return keys.map((key) => '\u2022 ' + this.translate.instant(key, { count: this.minPlayers })).join('\n');
    }
    private setupRoomUpdateListener() {
        this.socketService.on<RoomData>(GameRoomEvents.RoomUpdate, (data) => {
            if (data && Array.isArray(data.players)) {
                this.players = data.players;
                this.maxPlayers = data.playerMax;
                this.minPlayers = data.playerMin;
                this.isLocked = data.isLocked;
                this.lobbyGameMode = data.lobbyGameMode ?? LobbyGameMode.Classic;
                if (data.teams) {
                    this.teams = data.teams.map((team) => ({
                        ...team,
                        isOwnTeam: team.players.some((player) => player.id === this.playerService.player.id),
                    }));
                } else {
                    this.teams = [];
                }
                this.entryFee = data.entryFee || 0;
                this.gameModeService.isDropInDropOut = data.dropInDropOutEnabled ?? false;
                this.checkLoadingState();
            }
        });
        this.socketService.on<FriendOnlyResponse>(GameRoomEvents.ToggleFriendOnly, (data) => {
            if (data) {
                this.isFriendsOnly = data.isFriendsOnly;
            }
        });
        this.socketService.on<LockResponse>(GameRoomEvents.ToggleLock, (data) => {
            if (data) {
                this.isLocked = data.isLocked;
                this.checkLoadingState();
            }
        });
        this.socketService.on<DropInDropOutResponse>(GameRoomEvents.ToggleDropInDropOut, (data) => {
            if (data) {
                this.gameModeService.isDropInDropOut = data.dropInDropOutEnabled;
            }
        });
        this.socketService.on<FogOfWarResponse>(GameRoomEvents.ToggleFogOfWar, (data) => {
            if (data) {
                this.isFogOfWar = data.isFogOfWar;
            }
        });
        this.socketService.on<LobbyGameModeResponse>(GameRoomEvents.SetLobbyGameMode, (data) => {
            if (data) {
                this.lobbyGameMode = data.lobbyGameMode;
                if (data.lobbyGameMode !== LobbyGameMode.Teams) {
                    this.teams = [];
                }
            }
        });
        this.socketService.on<GameRoomEvents.StartGame>(GameRoomEvents.StartGame, () => {
            void this.router.navigate([Routes.Game]);
        });
        this.socketService.on<{ teams: Team[] }>(GameRoomEvents.UpdateTeams, (data) => {
            if (data && data.teams) {
                this.teams = data.teams.map((team) => ({
                    ...team,
                    isOwnTeam: team.players.some((player) => player.id === this.playerService.player.id),
                }));
            }
        });
    }
}
