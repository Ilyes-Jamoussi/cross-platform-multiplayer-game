import { EventEmitter, forwardRef, Inject, Injectable, OnDestroy } from '@angular/core';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { CombatService } from '@app/services/combat/combat.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { Actions, TileTypes } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { Grid, Player, ToggleDoor } from '@common/interfaces';
import { DIRECTIONS, isInBoardBounds } from '@common/shared-utils';
import { Position } from '@common/types';
import { BehaviorSubject, Subscription } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class ActionService implements OnDestroy {
    onCombatStart = new EventEmitter<void>();
    onCombatEnded = new EventEmitter<void>();
    onTradeStart = new EventEmitter<{ from: Player; to: Player }>();
    onActionConsumed = new EventEmitter<void>();
    hasActionLeftSubject = new BehaviorSubject<number>(1);
    private _gridSubscription: Subscription | undefined = undefined;
    private _turnSubscription: Subscription;
    private _newTurnSubscription: Subscription;
    private _grid: Grid;
    private _isAction: boolean = false;
    private _isActionClicked: boolean = false;
    private _isCombat: boolean = false;
    private readonly activeGridService: ActiveGridService;
    private readonly combatService: CombatService;

    constructor(
        @Inject(forwardRef(() => ActiveGridService))
        activeGridService: unknown,
        private readonly socketService: SocketService,
        private readonly turnService: TurnService,
        private readonly playerService: PlayerService,
        // Lazy reference: combat.service.ts imports ActionService back, so a direct
        // class reference here is in the temporal dead zone when webpack happens to
        // evaluate this module first.
        @Inject(forwardRef(() => CombatService))
        combatService: unknown,
    ) {
        this.activeGridService = activeGridService as ActiveGridService;
        this.combatService = combatService as CombatService;
        this.init();
    }

    get isActionClicked() {
        return this._isActionClicked;
    }
    get hasActionLeft(): boolean {
        return this.hasActionLeftSubject.getValue() > 0;
    }

    get isCombat() {
        return this._isCombat;
    }

    set isActionClicked(isClicked: boolean) {
        this._isActionClicked = isClicked;
    }

    set isCombat(isCombat: boolean) {
        this._isCombat = isCombat;
    }

    sendToggledDoor(position: Position, roomId: string, state: TileTypes) {
        if (this.hasActionLeftSubject.getValue() > 0) {
            const isOpened = state === TileTypes.OpenedDoor;
            this.socketService.sendMessage(ActiveGameEvents.ToggledDoor, { position, roomId, isOpened } as ToggleDoor);
        }
    }

    onToggledDoor(gridSubject: BehaviorSubject<Grid | undefined>, data: ToggleDoor) {
        const grid = gridSubject.getValue() as Grid;
        grid.board[data.position.x][data.position.y].tile = data.isOpened ? TileTypes.OpenedDoor : TileTypes.Door;
        gridSubject.next(grid);
        if (this.turnService.isMyTurn()) {
            this.consumeAction();
        }
    }

    toggleDoorListener(gridSubject: BehaviorSubject<Grid | undefined>) {
        this.socketService.on<ToggleDoor>(ActiveGameEvents.DoorUpdate, (data) => {
            this.onToggledDoor(gridSubject, data);
        });
    }

    getAdjacentPlayerOrDoor(): boolean {
        this.checkAdjacentPlayersOrDoors(this._grid);
        return this._isAction;
    }

    isSpecificPlayerAdjacent(position: Position, playerId: string, grid: Grid): boolean {
        const adjacentPositions = [
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
        ];
        for (const pos of adjacentPositions) {
            if (isInBoardBounds(pos, grid.board.length)) {
                const player = grid.board[pos.x][pos.y].player;
                if (player && player.id === playerId) {
                    return true;
                }
            }
        }
        return false;
    }

    startTrade(targetPlayer: Player) {
        if (this.turnService.timeLeft <= 0) return;

        this.socketService.sendMessage(ActiveGameEvents.TradeInit, {
            roomId: this.playerService.roomId,
            playerId: this.playerService.player.id,
            teammateId: targetPlayer.id,
        });
    }

    getCurrentPlayer() {
        this._turnSubscription = this.turnService.getCurrentTurn().subscribe((player) => {
            if (player) {
                this.combatService.combatInitiator = player;
            }
        });
    }

    getCombatWinner() {
        this.combatService.getCombatWinner();
    }

    resetActions(): void {
        this.hasActionLeftSubject.next(this.getMaxActions());
    }

    consumeAction(): void {
        const current = this.hasActionLeftSubject.getValue();
        if (current > 0) {
            this.hasActionLeftSubject.next(current - 1);
            this.onActionConsumed.emit();
        }
    }

    init() {
        this.startTrackingGrid();
        this.listenForTurnChanges();
    }

    disableListeners() {
        this.stopTrackingGrid();
        this.stopTurnListener();
        this.socketService.off(ActiveGameEvents.DoorUpdate);
    }

    sendCombatAction(roomId: string, player: Player, action: Actions.Attack | Actions.Escape) {
        this.combatService.sendCombatAction(roomId, player, action);
    }
    sendCombatInit(roomId: string, player: Player, action: string) {
        this.combatService.sendCombatInit(roomId, player, action as Actions);
    }

    ngOnDestroy(): void {
        this.disableListeners();
    }

    getPlayerPosition(grid: Grid): Position | null {
        for (let row = 0; row < grid.board.length; row++) {
            for (let col = 0; col < grid.board[row].length; col++) {
                if (grid.board[row][col].player?.id === this.playerService.player?.id) {
                    return { x: row, y: col };
                }
            }
        }
        return null;
    }

    isAdjacent(pos1: Position, pos2: Position): boolean {
        return DIRECTIONS.some(([deltaX, deltaY]) => pos1.x + deltaX === pos2.x && pos1.y + deltaY === pos2.y);
    }

    canTrade(row: number, col: number): boolean {
        if (!this.turnService.isMyTurn()) return false;

        const tile = this._grid.board[row][col];
        if (!tile.player) return false;

        if (!this.turnService.isPartOfOwnTeam(tile.player)) return false;

        const currentPlayer = this.turnService.getPlayer();

        const currentHasItem = (currentPlayer.inventory?.length ?? 0) > 0;
        const otherHasItem = (tile.player.inventory?.length ?? 0) > 0;

        return currentHasItem || otherHasItem;
    }

    private getAdjacentPositions(playerPosition: Position) {
        return [
            { x: playerPosition.x - 1, y: playerPosition.y },
            { x: playerPosition.x + 1, y: playerPosition.y },
            { x: playerPosition.x, y: playerPosition.y - 1 },
            { x: playerPosition.x, y: playerPosition.y + 1 },
        ];
    }

    private resetCombatState(): void {
        this.combatService.combatInitiator = undefined;
        this.combatService.attackedPlayer = undefined;
        this._isAction = false;
        this.isActionClicked = false;
    }

    private checkAdjacentPlayersOrDoors(grid: Grid): void {
        const playerPosition = this.getPlayerPosition(grid);
        if (!playerPosition) {
            this.resetCombatState();
            return;
        }

        const adjacentPositions = this.getAdjacentPositions(playerPosition);

        this.getCurrentPlayer();
        this._isAction = false;

        adjacentPositions.forEach((pos) => {
            if (isInBoardBounds(pos, grid.board.length)) {
                const tile = grid.board[pos.x][pos.y];
                const hasPlayer = tile.player;
                const hasDoor = tile.tile === TileTypes.Door || tile.tile === TileTypes.OpenedDoor;

                if (hasPlayer && !this.turnService.isPartOfOwnTeam(hasPlayer)) {
                    this.combatService.attackedPlayer = tile.player as Player;
                    tile.canCombat = true;
                    this._isAction = true;
                }

                if (this.canTrade(pos.x, pos.y)) {
                    this._isAction = true;
                }

                if (hasDoor) {
                    this._isAction = true;
                }
            }
        });

        if (!this._isAction) {
            this._isCombat = false;
            this.combatService.attackedPlayer = undefined;
        }
    }

    private getMaxActions(): number {
        return this._grid?.nbActions ?? 1;
    }

    private listenForTurnChanges() {
        this._newTurnSubscription = this.turnService.onNewTurn.subscribe(() => {
            this.resetActions();
        });
    }

    private startTrackingGrid(): void {
        this.hasActionLeftSubject.next(this.getMaxActions());
        this._gridSubscription = this.activeGridService.grid$.subscribe((grid) => {
            if (grid) {
                this._grid = grid;
                this.checkAdjacentPlayersOrDoors(grid);
            }
        });
    }

    private stopTrackingGrid(): void {
        if (this._gridSubscription) {
            this._gridSubscription.unsubscribe();
            this._gridSubscription = undefined;
        }
        if (this._turnSubscription) {
            this._turnSubscription.unsubscribe();
        }
        if (this._newTurnSubscription) {
            this._newTurnSubscription.unsubscribe();
        }
    }

    private stopTurnListener() {
        if (this._newTurnSubscription) {
            this._newTurnSubscription.unsubscribe();
        }
    }
}
