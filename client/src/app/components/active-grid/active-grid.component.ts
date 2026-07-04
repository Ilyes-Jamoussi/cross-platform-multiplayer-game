import { CommonModule, NgStyle } from '@angular/common';
import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { PopUpData } from '@app/interfaces/popUp.interface';
import { ActionService } from '@app/services/action/action.service';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { AlertService } from '@app/services/alert/alert.service';
import { CombatService } from '@app/services/combat/combat.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { TurnService } from '@app/services/turn/turn-service';
import { AVATARS } from '@common/avatar';
import { DEBOUNCE_TIME, FOG_OF_WAR_RADIUS, ITEM_IMAGE_MAP, TEAM_CONFIG, TILE_IMAGES } from '@common/constants';
import { Actions, Directions, ItemId, ItemTypes, PlayerState, TileTypes } from '@common/enums';
import { Grid, Player } from '@common/interfaces';
import { Position } from '@common/types';
import { Subject, Subscription, takeUntil } from 'rxjs';

@Component({
    selector: 'app-active-grid',
    standalone: true,
    templateUrl: './active-grid.component.html',
    styleUrls: ['./active-grid.component.scss'],
    imports: [NgStyle, CommonModule],
})
export class ActiveGridComponent implements OnInit, OnDestroy {
    @Output() gridInitialized = new EventEmitter<Grid>();
    @Output() visibilityChange = new EventEmitter<boolean>();
    private _grid: Grid;
    private readonly _activeGrid: Subscription;
    private readonly _destroy$ = new Subject<void>();
    private hasBeenCalled = false;
    private readonly alertService = inject(AlertService);
    private _localPlayerPosition: Position | undefined;

    // eslint-disable-next-line max-params
    constructor(
        private readonly activeGridService: ActiveGridService,
        private readonly playerService: PlayerService,
        private readonly actionService: ActionService,
        private readonly combatService: CombatService,
        private readonly turnService: TurnService,
        private readonly gameModeService: GameModeService,
    ) {}

    get grid() {
        return this._grid;
    }

    get isActionClicked() {
        return this.actionService.isActionClicked;
    }

    isTeamMember(rowIndex: number, colIndex: number): boolean {
        const player = this.grid?.board[rowIndex][colIndex]?.player;
        if (player && this.gameModeService.isTeamGameMode()) {
            return this.gameModeService.isPartOfOwnTeam(player.id);
        }
        return false;
    }

    getTeamColor(rowIndex: number, colIndex: number): string {
        const player = this.grid?.board[rowIndex][colIndex]?.player;
        if (!player) return 'transparent';

        const teamId = this.gameModeService.getTeamId(player.id).toString();
        const config = TEAM_CONFIG.find((team) => team.id === teamId);

        return config ? config.color : 'transparent';
    }

    isTeamGame(): boolean {
        return this.gameModeService.isTeamGameMode();
    }

    ngOnInit() {
        this.actionService.toggleDoorListener(this.activeGridService.gridSubject);
        this.activeGridService.loadGrid(this.playerService.roomId);
        this.activeGridService.grid$.subscribe((grid) => {
            if (grid) {
                this._grid = grid;
                this.gameModeService.onInit();
                this.updateLocalPlayerPosition();
            }
        });
        this.activeGridService.init();
        this.actionService.hasActionLeftSubject.pipe(takeUntil(this._destroy$)).subscribe((actionsLeft) => {
            if (actionsLeft === 0 && this.turnService.isMyTurn() && !this.combatService.isInCombat && !this.combatService.isWaitingForCombatEnd) {
                this.activeGridService.findAndSelectPlayer();
            }
            this.checkAndProcessTurnEnd(actionsLeft > 0 || this.activeGridService.canStillMove.getValue());
        });
        this.activeGridService.canStillMove.pipe(takeUntil(this._destroy$)).subscribe((canStillMove) => {
            this.checkAndProcessTurnEnd(canStillMove || (this.actionService.hasActionLeft && this.actionService.getAdjacentPlayerOrDoor()));
            if (
                this.turnService.isMyTurn() &&
                !this.activeGridService.isMoving &&
                !this.combatService.isInCombat &&
                !this.combatService.isWaitingForCombatEnd
            ) {
                this.activeGridService.deselectPlayer();
                this.activeGridService.findAndSelectPlayer();
            }
        });
    }

    ngOnDestroy() {
        if (this._activeGrid) {
            this._activeGrid.unsubscribe();
        }
        this._destroy$.next();
        this._destroy$.complete();
        this.activeGridService.ngOnDestroy();
        this.gameModeService.onReset();
    }

    tileClick(event: MouseEvent, position: Position) {
        if (this.isSpectatorMode()) {
            return;
        }
        return this.activeGridService.handleClick({ event, position, grid: this._grid });
    }

    onRightClick(event: MouseEvent, position: Position) {
        event.preventDefault();
        if (!this.isTileVisible(position.x, position.y)) return;
        const data = this.tileClick(event, position);
        if (data) {
            this.openInfo(data as PopUpData, event);
        }
    }

    onTileDoubleClick(event: Position) {
        if (this.isSpectatorMode()) {
            this.activeGridService.deselectPlayer();
            return;
        }

        const { x, y } = event;
        const cell = this._grid.board[x][y];

        if (!this.actionService.isActionClicked || this.activeGridService.isMoving || !this.hasActionsLeft() || !this.isMyTurn()) {
            this.activeGridService.deselectPlayer();
            return;
        }

        const currentPlayerPosition = this.actionService.getPlayerPosition(this._grid) as Position;
        if (!this.actionService.isAdjacent(currentPlayerPosition, { x, y })) return;

        const clickedPlayer = cell.player;

        if (this.isDoor(x, y) && !clickedPlayer) {
            const newState = cell.tile === TileTypes.Door ? TileTypes.OpenedDoor : TileTypes.Door;
            this.actionService.sendToggledDoor({ x, y }, this.playerService.roomId, newState);
        } else if (clickedPlayer && this.canTrade(x, y)) {
            this.actionService.startTrade(clickedPlayer);
        } else if (clickedPlayer && this.activeGridService.isOpposingPlayer(event)) {
            this.actionService.isCombat = !!cell.canCombat;
            this.startCombat();
        }

        this.actionService.isActionClicked = false;
    }

    startCombat() {
        if (this.isSpectatorMode()) {
            return;
        }
        if (this.turnService.timeLeft <= 0) return;
        this.turnService.freezeTurn();
        this.actionService.sendCombatInit(this.playerService.roomId, this.playerService.player, Actions.StartCombat);
    }

    getAdjacentPlayers(rowIndex: number, colIndex: number) {
        const position: Position = { x: rowIndex, y: colIndex };
        return this.actionService.isSpecificPlayerAdjacent(position, this.playerService.player.id, this._grid);
    }

    isDefined() {
        return !!this._grid;
    }

    isDoor(rowIndex: number, colIndex: number) {
        const tile = this._grid.board[rowIndex][colIndex].tile;
        return (
            !this.isSpectatorMode() &&
            (tile === TileTypes.Door || tile === TileTypes.OpenedDoor) &&
            this.isMyTurn() &&
            !this.grid.board[rowIndex][colIndex].player &&
            !this.grid.board[rowIndex][colIndex].item?.name &&
            this.getIsAction() &&
            this.getAdjacentPlayers(rowIndex, colIndex) &&
            this.hasActionsLeft()
        );
    }

    getTileImage(rowIndex: number, colIndex: number) {
        return TILE_IMAGES.get(this._grid.board[rowIndex][colIndex].tile) as string;
    }

    getItemImage(itemName: string): string {
        if (itemName.includes(ItemTypes.StartingPoint)) {
            return ITEM_IMAGE_MAP[ItemId.ItemStartingPoint];
        }
        let newName = itemName;
        if (itemName.endsWith('A') || itemName.endsWith('B')) {
            newName = itemName.slice(0, -1);
        }
        return ITEM_IMAGE_MAP[newName as ItemId];
    }

    getPlayerAvatar(rowIndex: number, colIndex: number): string {
        const player = this._grid?.board[rowIndex][colIndex]?.player;
        return player?.avatar ? AVATARS.find((avatar) => avatar.name === player.avatar)?.idle ?? AVATARS[0].idle : AVATARS[0].idle;
    }

    getTileSize() {
        return `calc(80vmin / ${this._grid?.gridSize})`;
    }

    onTileHovered(position: Position) {
        this.activeGridService.handleHovered(position);
    }

    onTileUnhovered() {
        this.activeGridService.handleUnhovered();
    }

    getReachableTile(position: Position) {
        return this.activeGridService.getReachableTile(position);
    }

    getHighlightedTile(position: Position) {
        return this.activeGridService.getHighlightedTile(position);
    }

    isCurrentUserPlayer(rowIndex: number, colIndex: number): boolean {
        const player = this.grid?.board[rowIndex][colIndex]?.player;
        return player?.id === this.playerService.player.id;
    }

    isMyTurn() {
        return this.turnService.isMyTurn() && !this.combatService.isWaitingForCombatEnd && !this.combatService.isInCombat;
    }

    getIsAction() {
        return this.actionService.isActionClicked;
    }

    getPlayerLastDirection(rowIndex: number, colIndex: number): string {
        return this.grid?.board?.[rowIndex]?.[colIndex]?.player?.lastDirection || Directions.Right;
    }

    hasActionsLeft() {
        return this.actionService.hasActionLeft;
    }

    canCombat(rowIndex: number, colIndex: number) {
        return (
            !this.isSpectatorMode() &&
            this.grid.board[rowIndex][colIndex].canCombat &&
            this.grid.board[rowIndex][colIndex].player &&
            this.isMyTurn() &&
            this.getIsAction() &&
            this.getAdjacentPlayers(rowIndex, colIndex) &&
            this.hasActionsLeft()
        );
    }

    canTrade(row: number, col: number): boolean {
        if (!this.turnService.isMyTurn()) return false;
        if (this.isSpectatorMode()) return false;
        if (!this.isTeamGame()) return false;
        if (!this.isActionClicked) return false;

        const tile = this.grid.board[row][col];
        if (!tile.player) return false;

        const clickedPlayer = tile.player;

        if (clickedPlayer.id === this.turnService.playerId) return false;

        if (!this.turnService.isPartOfOwnTeam(clickedPlayer)) return false;

        const currentPlayer = this.turnService.getPlayer();

        const currentHasItem = (currentPlayer.inventory?.length ?? 0) > 0;
        const otherHasItem = (clickedPlayer.inventory?.length ?? 0) > 0;

        return currentHasItem || otherHasItem;
    }

    makeStartingPointGlow(rowIndex: number, colIndex: number) {
        return this.gameModeService.makeStartingPointGlow(rowIndex, colIndex);
    }

    showFlagHolder(player: Player | undefined) {
        return this.gameModeService.showFlagHolder(player);
    }

    isFogOfWar(): boolean {
        return this.gameModeService.isFogOfWar && !this.activeGridService.isDebug;
    }

    isTileVisible(rowIndex: number, colIndex: number): boolean {
        if (!this.isFogOfWar()) return true;
        if (!this._localPlayerPosition) return false;
        return (
            Math.abs(rowIndex - this._localPlayerPosition.x) <= FOG_OF_WAR_RADIUS &&
            Math.abs(colIndex - this._localPlayerPosition.y) <= FOG_OF_WAR_RADIUS
        );
    }

    private updateLocalPlayerPosition() {
        if (!this._grid) return;
        for (let row = 0; row < this._grid.board.length; row++) {
            for (let col = 0; col < this._grid.board[row].length; col++) {
                if (this._grid.board[row][col].player?.id === this.playerService.player.id) {
                    this._localPlayerPosition = { x: row, y: col };
                    return;
                }
            }
        }
    }

    private openInfo(data: PopUpData, event: MouseEvent) {
        this.alertService.tileInfo(data, event);
    }

    private checkAndProcessTurnEnd(condition: boolean) {
        if (
            !this.actionService.isCombat &&
            !this.turnService.isBlocking &&
            this.turnService.isMyTurn() &&
            !condition &&
            !this.activeGridService.getIsIceAdjacent() &&
            this.turnService.timeLeft !== 0
        ) {
            this.processTurnEnd();
        }
    }

    private processTurnEnd() {
        if (!this.hasBeenCalled) {
            this.actionService.resetActions();
            this.turnService.nextTurn();
            this.activeGridService.canStillMove.next(true);
            this.hasBeenCalled = true;
            setTimeout(() => {
                this.hasBeenCalled = false;
            }, DEBOUNCE_TIME);
        }
    }

    private isSpectatorMode(): boolean {
        const player = this.playerService.player;
        return player?.state === PlayerState.ELIMINATED || !!player?.isSpectator;
    }
}
