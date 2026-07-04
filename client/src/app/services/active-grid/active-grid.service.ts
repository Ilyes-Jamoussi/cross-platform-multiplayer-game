import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Injector, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Routes } from '@app/enums/routes-enums';
import { ActiveClick } from '@app/interfaces/active-grid-interfaces';
import { ActionService } from '@app/services/action/action.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { ItemService } from '@app/services/item/item.service';
import { PlayerMovementService } from '@app/services/player-mouvement/player-movement.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { ItemTypes } from '@common/enums';
import { ActiveGameEvents, DebugEvents } from '@common/gateway-events';
import { DebugResponse, GameData, Grid, Path, Player, PlayerNextPosition } from '@common/interfaces';
import { Position } from '@common/types';
import { BehaviorSubject, Subject, take, takeUntil } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class ActiveGridService implements OnDestroy {
    private _roomId: string;
    private readonly _destroy$ = new Subject<void>();
    private readonly _gridSubject = new BehaviorSubject<Grid | undefined>(undefined);
    private readonly _grid$ = this._gridSubject.asObservable();
    private _hoveredPosition: Position | undefined;
    private _selectedPosition: Position | undefined;
    private _selectedPlayer: Player | undefined;
    private _isMoving: boolean;
    private isFirstMove = true;
    private _isDebug = false;
    private readonly _canStillMove = new BehaviorSubject<boolean>(true);
    private readonly router = inject(Router);
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.serverUrl + Routes.StartGame;

    private readonly playerService = inject(PlayerService);
    private readonly injector = inject(Injector);

    constructor(
        private readonly socketService: SocketService,
        private readonly playerMovementService: PlayerMovementService,
        private readonly turnService: TurnService,
        private readonly gameModeService: GameModeService,
        private readonly itemService: ItemService,
    ) {}

    get roomId() {
        return this._roomId;
    }

    get isMoving() {
        return this._isMoving;
    }

    get selectedPlayer() {
        return this._selectedPlayer;
    }

    get grid$() {
        return this._grid$;
    }

    get gridSubject() {
        return this._gridSubject;
    }

    get isDebug() {
        return this._isDebug;
    }

    get canStillMove() {
        return this._canStillMove;
    }

    set isDebug(isDebug: boolean) {
        this._isDebug = isDebug;
    }

    isCTF() {
        return this.gameModeService.isCtf();
    }

    ngOnDestroy() {
        this.removeListeners();
        this.reset();
    }

    init() {
        this.turnService.init();
    }

    reset() {
        this.deselectPlayer();
        this._gridSubject.next(undefined);
        const currentNavigation = this.router.getCurrentNavigation();
        if (currentNavigation) {
            const targetUrl = currentNavigation.finalUrl?.toString();
            if (targetUrl && targetUrl.includes(`${Routes.Loading}/`)) {
                this.socketService.disconnect();
            }
        }
        this.turnService.ngOnDestroy();
    }

    loadGrid(roomId: string): void {
        if (roomId === '') {
            void this.router.navigate([Routes.Home]).then(() => this.turnService.alert('common.left_game'));
            return;
        }
        this.playerMovementService.reachableTiles = [];
        this._roomId = roomId;
        this.http
            .post<GameData>(this.apiUrl, { roomId })
            .pipe(take(1))
            .subscribe({
                next: (gameData) => {
                    this._gridSubject.next(gameData.map);
                    if (gameData.teams) {
                        this.gameModeService.setTeams(gameData.teams);
                    }
                    this.gameModeService.setGameMode(gameData.gameMode, gameData.lobbyGameMode, gameData.isFogOfWar, gameData.isDropInDropOut);
                    this.setUpMovementListeners();
                    this.setLogicListeners();
                    this.itemService.setUpListeners(this.gridSubject.getValue() as Grid);
                },
                error: (error) => {
                    this.socketService.disconnect();
                    this.reset();
                    const errorMessage = error.error?.error || 'server_msg.generic_error';
                    void this.router.navigate([Routes.Home]).then(() => this.turnService.alert(errorMessage));
                },
            });
    }

    handleClick(activeClick: ActiveClick) {
        if (!activeClick.grid) return;

        const cell = activeClick.grid.board[activeClick.position.x][activeClick.position.y];
        const isRightClick = activeClick.event.button === 2;

        if (activeClick.event.button === 0 && this._selectedPlayer) {
            const path = this.playerMovementService.getShortestPath(this._gridSubject, this._selectedPlayer, activeClick.position);
            this.moveSelectedPlayer(path);
        } else if (isRightClick) {
            if (this.isTeleportable(activeClick)) {
                this.moveSelectedPlayer({ positions: [activeClick.position], cost: 0, turns: 0 }, true);
            } else if (cell) {
                return { player: cell.player, item: cell.item, tile: cell.tile };
            }
        }
        return;
    }

    handleHovered(position: Position) {
        this._hoveredPosition = position;
        if (!this.selectedPlayer || this.isMoving) return;
        this.playerMovementService.highlightedPath = this.playerMovementService.getShortestPath(this.gridSubject, this.selectedPlayer, position);
    }

    handleUnhovered() {
        this._hoveredPosition = undefined;
        if (!this.playerMovementService.highlightedPath || this.playerMovementService.highlightedPath.positions.length === 0) return;

        if (!this.isMoving) {
            this.playerMovementService.highlightedPath = { positions: [], cost: 0, turns: 0 };
        }
    }

    getReachableTile(position: Position) {
        return this.playerMovementService.reachableTiles.find((tile) => tile.x === position.x && tile.y === position.y);
    }

    getHighlightedTile(position: Position) {
        return this.playerMovementService.highlightedPath.positions.find((tile) => tile.x === position.x && tile.y === position.y);
    }

    getIsIceAdjacent() {
        return this.playerMovementService.getIsIceAdjacent(this.gridSubject, this.turnService.playerLastPosition);
    }

    deselectPlayer() {
        this._selectedPlayer = undefined;
        this._selectedPosition = undefined;
        this.playerMovementService.reachableTiles = [];
        this.playerMovementService.highlightedPath = { positions: [], cost: 0, turns: 0 };
    }

    isOpposingPlayer(position: Position) {
        const grid = this._gridSubject.value;
        if (!grid) return false;
        const player = grid.board[position.x][position.y].player;
        return player && player.id !== this.turnService.playerId;
    }

    findAndSelectPlayer() {
        const grid = this._gridSubject.getValue();
        if (!grid) return;
        let playerPosition: Position | undefined;
        for (let row = 0; row < grid.board.length; row++) {
            for (let col = 0; col < grid.board[row].length; col++) {
                if (grid.board[row][col].player?.id === this.turnService.playerId) {
                    playerPosition = { x: row, y: col };
                    break;
                }
            }
            if (playerPosition) break;
        }
        if (playerPosition) {
            this.selectPlayer(playerPosition);
        }
    }

    getPlayerPosition() {
        const grid = this._gridSubject.getValue();
        if (!grid) return { x: -1, y: -1 };

        let playerPosition = { x: -1, y: -1 };
        for (let row = 0; row < grid.board.length; row++) {
            for (let col = 0; col < grid.board[row].length; col++) {
                const cell = grid.board[row][col];
                if (cell.player?.id === this.turnService.playerId) {
                    playerPosition = { x: row, y: col };
                    break;
                }
            }
            if (playerPosition.x !== -1) break;
        }
        return playerPosition;
    }

    moveSelectedPlayer(path: Path, isRightClick?: boolean): void {
        if (!this._selectedPlayer || !this._selectedPosition) return;

        const grid = this._gridSubject.value;
        if (!grid) return;

        this.playerMovementService.reachableTiles = [];
        this._selectedPosition = undefined;

        this.socketService.sendMessage(ActiveGameEvents.MovePlayer, {
            roomId: this._roomId,
            grid,
            player: this._selectedPlayer,
            path,
            isRightClick,
        });
    }

    private isTeleportable(activeClick: ActiveClick) {
        return this._isDebug && this._selectedPlayer && this.playerMovementService.isValidMove(this._gridSubject, activeClick.position);
    }

    private selectPlayer(position: Position): void {
        const grid = this._gridSubject.value;
        if (!grid) return;

        const cell = grid.board[position.x][position.y];
        if (cell.player && !this._selectedPosition && cell.player.stats) {
            if (!cell.player.stats.maxSpeed) cell.player.stats.maxSpeed = cell.player.stats.speed;
            if (this.isFirstMove && cell.player.stats && cell.player.stats.maxSpeed) {
                cell.player.stats.speed = cell.player.stats.maxSpeed;
                this.isFirstMove = false;
            }
            this._selectedPlayer = cell.player;
            this._selectedPosition = position;
            this.playerMovementService.getReachableTiles(this._gridSubject, this._selectedPlayer);
        }
    }

    private setLogicListeners() {
        this.sendMapListener();
        this.dropInListener();
        this.turnService.blockPlaying.pipe(takeUntil(this._destroy$)).subscribe((isBlocking) => {
            if (!isBlocking && this.turnService.isMyTurn()) {
                this.isFirstMove = true;
                this.findAndSelectPlayer();
                if (this._hoveredPosition) this.handleHovered(this._hoveredPosition);
            }
            if (isBlocking && !this.isMoving) this.deselectPlayer();
        });
        this.socketService.on<DebugResponse>(DebugEvents.ToggleDebug, (response) => {
            this._isDebug = response.isDebug;
        });
        this.turnService
            .getQuittingPlayerId()
            .pipe(takeUntil(this._destroy$))
            .subscribe((playerId) => {
                if (playerId) this.removeStartingPoint(playerId);
            });
        this.injector
            .get(ActionService)
            .onActionConsumed.pipe(takeUntil(this._destroy$))
            .subscribe(() => {
                if (this.turnService.isMyTurn()) {
                    this.findAndSelectPlayer();
                    if (this._hoveredPosition) this.handleHovered(this._hoveredPosition);
                }
            });
    }

    private removeStartingPoint(playerId: string) {
        if (!playerId) return;
        const grid = this._gridSubject.value;
        if (!grid) return;

        let gridUpdated = false;
        for (const row of grid.board) {
            for (const cell of row) {
                if (cell.player?.id !== playerId) continue;
                const startingPoint = cell.player.startingPoint;
                if (startingPoint) {
                    const { x, y } = startingPoint;
                    const onGrid = x >= 0 && x < grid.board.length && y >= 0 && y < grid.board[x].length;
                    if (onGrid) {
                        grid.board[x][y].item.name = ItemTypes.UnusedStartingPoint;
                        grid.board[x][y].item.description = '';
                    }
                }
                cell.player = undefined;
                gridUpdated = true;
            }
        }
        if (gridUpdated) {
            this._gridSubject.next(grid);
            this.gameModeService.sendMap(grid.board);
        }
    }

    private setUpMovementListeners() {
        this.socketService.on<PlayerNextPosition>(ActiveGameEvents.PlayerStartedMoving, () => {
            this._isMoving = true;
        });

        this.socketService.on<PlayerNextPosition>(ActiveGameEvents.PlayerNextPosition, (data) => {
            this.playerMovementService.movePlayer(this._gridSubject, data.player, data.nextPosition);
            if (data.player.stats && data.player.id === this.turnService.playerId) {
                this._canStillMove.next(
                    data.player.stats?.speed !== 0 ||
                        ((this.playerMovementService.reachableTiles?.length ?? 0) !== 0 &&
                            this.playerMovementService.reachableTiles?.length === 1 &&
                            this.playerMovementService.reachableTiles[0] !== this.getPlayerPosition()),
                );
            }
            this._canStillMove.next(this._canStillMove.value);
        });

        this.socketService.on<PlayerNextPosition>(ActiveGameEvents.PlayerStoppedMoving, () => {
            this._isMoving = false;
            this.deselectPlayer();
            if (this.turnService.isMyTurn()) {
                this.findAndSelectPlayer();
                if (this._hoveredPosition) this.handleHovered(this._hoveredPosition);
            }
        });
    }

    private removeListeners() {
        this.socketService.off(ActiveGameEvents.PlayerStartedMoving);
        this.socketService.off(ActiveGameEvents.CombatUpdate);
        this.socketService.off(ActiveGameEvents.PlayerNextPosition);
        this.socketService.off(ActiveGameEvents.PlayerStoppedMoving);
        this.socketService.off(ActiveGameEvents.ItemUpdate);
        this.socketService.off(DebugEvents.ToggleDebug);
        this.socketService.off(ActiveGameEvents.MapRequest);
        this.socketService.off(ActiveGameEvents.PlayerDisconnect);
        this._destroy$.next();
        this._destroy$.complete();
    }

    private sendMapListener() {
        this.socketService.on(ActiveGameEvents.MapRequest, () => {
            const grid = this._gridSubject.value;
            if (grid) {
                this.gameModeService.sendMap(grid.board);
            }
        });
    }

    private dropInListener() {
        this.socketService.on(ActiveGameEvents.SpawnPlayer, (data: { player: Player; players?: Player[]; disconnectedPlayers?: Player[] }) => {
            if (!data.player.startingPoint) return;
            const grid = this._gridSubject.value;
            this.playerService.fetchPlayersOnDropIn(data.players, data.disconnectedPlayers);
            if (grid) {
                grid.board[data.player.startingPoint.x][data.player.startingPoint.y].player = data.player;
                grid.board[data.player.startingPoint.x][data.player.startingPoint.y].item.name = ItemTypes.StartingPoint;

                this.gameModeService.sendMap(grid.board);
            }
        });
    }
}
