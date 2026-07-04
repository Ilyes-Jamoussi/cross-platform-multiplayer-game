import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerRoutes } from '@app/enums/player-enums';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { SocketService } from '@app/services/socket/socket.service';
import { AVATARS } from '@common/avatar';
import { GAME_ROOM_URL, HTTP_BAD_REQUEST, MAX_INVENTORY_SIZE } from '@common/constants';
import { LobbyGameMode, PlayerState, VirtualPlayerTypes } from '@common/enums';
import { ActiveGameEvents, GameRoomEvents } from '@common/gateway-events';
import {
    CreateGameResponse,
    Item,
    JoinAcceptedPayload,
    KickPayload,
    Player,
    SelectAvatarResponse,
    SocketPayload,
    SocketResponse,
    TradeCompleteData,
    VirtualPlayerPayload,
} from '@common/interfaces';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
// eslint-disable-next-line no-restricted-imports
import { AuthService } from '../auth-service/auth-service.service';

@Injectable({
    providedIn: 'root',
})
export class PlayerService implements OnDestroy {
    players$: Observable<Player[]>;
    disconnectedPlayers$: Observable<Player[]>;
    private _avatar: string;
    private _player: Player = {
        name: '',
        id: '',
        avatar: AVATARS[0].name,
        stats: undefined,
        isHost: false,
    };

    private _roomId: string = '';
    private _isInGame = false;
    private _voluntaryLeave = false;
    private destroy$ = new Subject<void>();
    private _inventory: Item[] = [];
    private playersSubject = new BehaviorSubject<Player[]>([]);
    private disconnectedPlayersSubject = new BehaviorSubject<Player[]>([]);
    private readonly _inventorySubject: BehaviorSubject<Item[]> = new BehaviorSubject<Item[]>(this._inventory);
    constructor(
        private socketService: SocketService,
        private router: Router,
        private alertService: AlertService,
        private http: HttpClient,
        private authService: AuthService,
    ) {
        this.setupListeners();
        this.players$ = this.playersSubject.asObservable();
        this.disconnectedPlayers$ = this.disconnectedPlayersSubject.asObservable();
    }

    get inventory$() {
        return this._inventorySubject.asObservable();
    }
    get avatar() {
        return this._avatar;
    }
    get player() {
        return this._player;
    }
    get roomId() {
        return this._roomId;
    }
    set player(player: Player) {
        this._player = player;
    }
    set roomId(roomId: string) {
        this._roomId = roomId;
    }

    updateInventory(newInventory: Item[]): void {
        this._inventory = newInventory;
        this._player.inventory = [...newInventory];
        this._inventorySubject.next(this._inventory);
    }

    fetchPlayersOnDropIn(eventPlayers?: Player[], eventDisconnectedPlayers?: Player[]) {
        if (eventPlayers && eventDisconnectedPlayers) {
            this.playersSubject.next(eventPlayers);
            this.disconnectedPlayersSubject.next(eventDisconnectedPlayers);
            return;
        }
        if (!this.roomId) return;
        this.http.get<{ players: Player[]; disconnectedPlayers: Player[] }>(`${GAME_ROOM_URL}/${this.roomId}${PlayerRoutes.PlayerState}`).subscribe({
            next: (data) => {
                this.playersSubject.next(data.players);
                this.disconnectedPlayersSubject.next(data.disconnectedPlayers);
            },
            error: () => {
                this.http.get<Player[]>(`${GAME_ROOM_URL}/${this.roomId}${PlayerRoutes.Players}`).subscribe((players) => {
                    this.playersSubject.next(players);
                });
            },
        });
    }

    updatePlayersState(players?: Player[], disconnectedPlayers?: Player[]) {
        if (players) this.playersSubject.next(players);
        if (disconnectedPlayers) this.disconnectedPlayersSubject.next(disconnectedPlayers);
    }

    getPlayers(): Observable<Player[]> {
        if (this.roomId) {
            return this.http.get<Player[]>(`${GAME_ROOM_URL}/${this.roomId}${PlayerRoutes.Players}`);
        } else {
            return new Observable<Player[]>((observer) => {
                observer.next([]);
                observer.complete();
            });
        }
    }

    canAddToInventory(): boolean {
        const inventory = this.player.inventory ?? [];
        return inventory.length < MAX_INVENTORY_SIZE;
    }

    addItemToInventory(item: Item): void {
        if (!this.player.inventory) {
            this.player.inventory = [];
        }
        const inventory = this.player.inventory;
        inventory.push(item);
        this.player.inventory = inventory;
        this.updateInventory(inventory);
    }

    removeItemFromInventory(item: Item): void {
        if (!this.player.inventory || !item) {
            return;
        }
        const inventory = this.player.inventory;
        this.player.inventory = inventory.filter((itemToCheck) => {
            return itemToCheck.id !== item.id;
        });
        this.updateInventory(this.player.inventory);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this._inventorySubject.next([]);
        this.socketService.off(GameRoomEvents.KickUpdate);
        this.socketService.off(GameRoomEvents.RoomUpdate);
    }
    async validateRoomId(roomId = this.roomId): Promise<string> {
        return new Promise((resolve, reject) => {
            this.http.get(`${GAME_ROOM_URL}${PlayerRoutes.Validate}/${roomId}`).subscribe({
                next: () => resolve(roomId),
                error: (error: HttpErrorResponse) => {
                    const messageKey = error.error?.message;
                    const bodyKey = typeof messageKey === 'string' && messageKey.length > 0 ? messageKey : 'server_msg.room_not_found';
                    this.alertService.showInfo('join_page.room_not_found_title', bodyKey);
                    reject(error);
                },
            });
        });
    }
    selectAvatar(): void {
        this.http
            .post<SelectAvatarResponse>(`${GAME_ROOM_URL}${PlayerRoutes.SelectAvatar}`, { roomId: this._roomId, player: this._player })
            .subscribe({
                next: (response) => {
                    this._player = response.player;
                    if (response.player.avatar) this._avatar = response.player.avatar;
                    this.updateAvatars();
                    if (response.isDropIn) {
                        if (!response.isDropInSuccess) {
                            this.alertService.showInfo('popup.error_title', 'common.no_spawn');
                            return;
                        }
                        this.dropInPlayer(response.player.id);
                        void this.router.navigate([Routes.Game]);
                        return;
                    }
                    void this.router.navigate([`${Routes.Loading}/`, this.roomId]);
                },
                error: (error: HttpErrorResponse) => {
                    const msg = typeof error.error === 'string' ? error.error : error.error?.message;
                    const isRecoverableAvatarError =
                        error.status === HTTP_BAD_REQUEST && typeof msg === 'string' && msg.includes('Avatar non disponible');
                    if (isRecoverableAvatarError) {
                        setTimeout(() => {
                            this.alertService.showInfo('popup.error_title', msg);
                        });
                        return;
                    }
                    this.quitGame();
                    setTimeout(() => {
                        this.alertService.showInfo('popup.error_title', msg);
                    });
                },
            });
    }
    async validatePlayerAndJoin(username: string): Promise<void> {
        if (!username || !username.trim()) {
            this.alertService.showInfo('popup.error_title', 'common.invalid_username');
            return;
        }

        this._player.name = username;

        if (username.toLowerCase() === 'knuckles') {
            this._player.avatar = 'Knuckles';
        }

        const roomId = await this.validateRoomId().catch(() => null);

        if (roomId) {
            this.selectAvatar();
        }
    }
    async createGame(gameId: string, entryFee: number = 0): Promise<void> {
        const token = await this.authService.getToken();

        if (!token) return;

        const headers = new HttpHeaders({
            authorization: `Bearer ${token}`,
        });

        this.http.post<CreateGameResponse>(`${GAME_ROOM_URL}${PlayerRoutes.Create}`, { gameId, entryFee }, { headers }).subscribe({
            next: (response) => {
                if (response.roomId) {
                    this._roomId = response.roomId;
                    this.joinGame(this.roomId, true);
                    void this.router.navigate([Routes.Stats]);
                }
            },
            error: (error: HttpErrorResponse) => {
                this.alertService.showInfo('popup.error_title', error.error?.message);
            },
        });
    }
    updateRoom() {
        this.socketService.sendMessage<SocketPayload>(GameRoomEvents.RoomUpdate, { roomId: this._roomId });
    }
    updateAvatars() {
        this.socketService.sendMessage<SocketPayload>(GameRoomEvents.AvatarUpdate, { roomId: this._roomId });
    }
    kickPlayer(player: string) {
        this.socketService.sendMessage<KickPayload>(GameRoomEvents.KickPlayer, { player, roomId: this._roomId });
    }
    async joinGame(roomId: string, isHost: boolean) {
        this._player.isHost = isHost;

        const token = await this.authService.getToken();
        if (!token) return;

        this.socketService.sendMessage<SocketPayload>(GameRoomEvents.JoinGame, { roomId, token });
    }
    dropInPlayer(player: string) {
        this.socketService.sendMessage<KickPayload>(ActiveGameEvents.DropIn, { player, roomId: this._roomId });
    }
    startGame() {
        this.socketService.sendMessage<SocketPayload>(GameRoomEvents.StartGame, { roomId: this._roomId });
    }
    quitGame(options?: { silent?: boolean }) {
        this._voluntaryLeave = true;
        this.socketService.sendMessage(GameRoomEvents.LeaveGame, { roomId: this._roomId });
        this.reset();
        this.router.navigate([Routes.Home]).then(() => {
            if (!options?.silent) {
                this.alertService.showInfo('popup.left_game_title', 'popup.left_game_message');
            }
        });
    }
    addVirtualPlayer(type: VirtualPlayerTypes) {
        this.socketService.sendMessage<VirtualPlayerPayload>(GameRoomEvents.AddVirtualPlayer, { roomId: this._roomId, type });
    }
    toggleFriendOnly() {
        this.socketService.sendMessage<SocketPayload>(GameRoomEvents.ToggleFriendOnly, { roomId: this._roomId });
    }
    toggleLock() {
        this.socketService.sendMessage<SocketPayload>(GameRoomEvents.ToggleLock, { roomId: this._roomId });
    }
    toggleDropInDropOut(): void {
        this.socketService.sendMessage(GameRoomEvents.ToggleDropInDropOut, { roomId: this.roomId });
    }
    toggleFogOfWar(): void {
        this.socketService.sendMessage(GameRoomEvents.ToggleFogOfWar, { roomId: this.roomId });
    }
    setLobbyGameMode(mode: LobbyGameMode) {
        this.socketService.sendMessage(GameRoomEvents.SetLobbyGameMode, {
            roomId: this.roomId,
            mode,
        });
    }
    selectTeam(teamId: string): void {
        this.socketService.sendMessage(GameRoomEvents.SelectTeam, {
            roomId: this.roomId,
            player: this._player,
            teamId,
        });
    }
    leaveTeam(): void {
        this.socketService.sendMessage(GameRoomEvents.LeaveTeam, {
            roomId: this.roomId,
            player: this._player,
        });
    }
    changeVirtualPlayerTeam(player: Player, targetTeamId: string): void {
        const uid = this.authService.getFirebaseUid();

        if (!uid) return;

        this.socketService.sendMessage(GameRoomEvents.VirtualPlayerTeamChanged, {
            roomId: this.roomId,
            playerId: player.id,
            targetTeamId,
            firebaseUid: uid,
        });
    }
    private setupListeners() {
        this.socketService
            .isConnected()
            .pipe(takeUntil(this.destroy$))
            .subscribe((isConnected) => {
                if (!isConnected) {
                    if (this._isInGame && !this._voluntaryLeave) {
                        this.reset();
                        void this.router.navigate([Routes.Home]).then(() => {
                            this.alertService.showInfo('popup.left_game_title', 'popup.left_game_message');
                        });
                    }
                } else {
                    this._voluntaryLeave = false;
                    this._player.id = this.socketService.getSocketId();
                }
            });
        this.socketService.on<SocketResponse>(GameRoomEvents.KickUpdate, (data) => {
            if (!this._isInGame) return;
            this.reset();
            if (data.message) {
                const title = this.getKickTitle(data.message);
                void this.router.navigate([Routes.Home]).then(() => this.alertService.showInfo(title, data.message));
            }
        });
        this.socketService.on<JoinAcceptedPayload>(GameRoomEvents.JoinAccepted, (data) => {
            this._roomId = data.roomId;
            this._isInGame = true;

            if (data.player) {
                this._player = { ...this._player, ...data.player };
                if (data.player.avatar) {
                    this._avatar = data.player.avatar;
                }
                this.updateInventory(data.player.inventory ?? []);
            }

            const shouldNavigateToGame = !!data.hasGameStarted || data.player?.state === PlayerState.ELIMINATED || !!data.player?.isSpectator;
            this.router.navigate([shouldNavigateToGame ? Routes.Game : Routes.Stats]);
        });
        this.socketService.on<SocketResponse>(GameRoomEvents.JoinDenied, (data) => {
            if (data.message) {
                this.alertService.showInfo('popup.error_title', data.message as string);
            }
        });
        this.socketService.on<TradeCompleteData>(ActiveGameEvents.TradeComplete, (data) => {
            const myId = this._player.id;
            let myNewInventory: Item[] | null = null;

            if (data.playerAId === myId) myNewInventory = data.playerAInventory;
            else if (data.playerBId === myId) myNewInventory = data.playerBInventory;

            if (myNewInventory) {
                this.updateInventory(myNewInventory);
            }
        });
    }
    private getKickTitle(message: string): string {
        switch (message) {
            case 'server_msg.player_kicked':
                return 'popup.kicked_title';
            case 'server_msg.host_left':
                return 'popup.host_left_title';
            case 'server_msg.last_player':
                return 'popup.game_over_title';
            default:
                return 'popup.connection_error_title';
        }
    }

    private reset() {
        const currentId = this._player.id;

        this._roomId = '';
        this._isInGame = false;
        this._player = {
            name: '',
            id: currentId,
            isHost: false,
            avatar: AVATARS[0].name,
            stats: undefined,
            inventory: [],
        };
        this._inventory = [];
        this._inventorySubject.next([]);
        this.playersSubject.next([]);
        this.disconnectedPlayersSubject.next([]);
    }
}
