/* eslint-disable max-lines */
import { EventEmitter, Injectable, Injector, OnDestroy } from '@angular/core';
import { ActionService } from '@app/services/action/action.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { GROUPED_ITEMS } from '@common/constants';
import { CombatResults, GameModes, GameSizes, ItemCategory, ItemCounts, ItemId, ItemTypes } from '@common/enums';
import { ActiveGameEvents, CTFEvents, TimerEvents } from '@common/gateway-events';
import {
    CombatUpdate,
    GameDisconnect,
    Grid,
    Item,
    ItemsDropped,
    ItemUpdate,
    Player,
    Section,
    TradeAcceptData,
    TradeCompleteData,
    TradePopupData,
    TradeStartedData,
} from '@common/interfaces';
import { createItem, findAvailableTerrainForItem } from '@common/shared-utils';
import { Position } from '@common/types';

@Injectable({
    providedIn: 'root',
})
export class ItemService implements OnDestroy {
    private _mode: string;
    private _mapSize: number;
    private currentTradeData?: TradePopupData;
    private readonly _inventoryPopUp = new EventEmitter<void>();
    private readonly _tradePopUp = new EventEmitter<TradePopupData>();
    private readonly _tradeClosed = new EventEmitter<void>();

    constructor(
        private readonly playerService: PlayerService,
        private readonly injector: Injector,
        private readonly socketService: SocketService,
        private readonly gameModeService: GameModeService,
    ) {}

    get mapSize(): number {
        return this._mapSize;
    }
    get mode(): string {
        return this._mode;
    }
    get inventoryPopUp(): EventEmitter<void> {
        return this._inventoryPopUp;
    }
    get tradePopUp(): EventEmitter<TradePopupData> {
        return this._tradePopUp;
    }
    get tradeClosed(): EventEmitter<void> {
        return this._tradeClosed;
    }
    set mapSize(size: number) {
        this._mapSize = size;
    }
    set mode(mode: string) {
        this._mode = mode;
    }

    setUpListeners(grid: Grid) {
        this.onItemPickedUp(grid);
        this.onSwappedItem(grid);
        this.onTradeRequested();
        this.onTradeUpdated();
        this.onTradeAccepted();
        this.onTradeCanceled();
        this.onTradeCompleted();
        this.onTimerEnd();
        this.onCombatEnded(grid);
        this.onPlayerDisconnect(grid);
        this.placeItems(grid);
    }

    ngOnDestroy() {
        this.socketService.off(ActiveGameEvents.ItemUpdate);
        this.socketService.off(ActiveGameEvents.ItemPickedUp);
        this.socketService.off(ActiveGameEvents.PlayerDisconnect);
        this.socketService.off(ActiveGameEvents.CombatUpdate);
        this.socketService.off(TimerEvents.TimerEnd);
    }

    pickUpItem(position: Position, grid: Grid): void {
        if (!position) return;
        const tile = grid.board[position.x][position.y];
        if (tile.item.name && !tile.item.name.includes(ItemTypes.StartingPoint) && !tile.item.name.includes(ItemTypes.UnusedStartingPoint)) {
            const itemId = this.getItemId(tile.item.name) as ItemId;
            const item = createItem(itemId, tile.item.description);
            if (!this.playerService.canAddToInventory()) {
                this._inventoryPopUp.emit();
            }
            this.playerService.addItemToInventory(item);
            tile.item.name = '';
            tile.item.description = '';
            if (itemId.includes(ItemTypes.Flag)) {
                this.socketService.sendMessage(CTFEvents.FlagTaken, {
                    roomId: this.playerService.roomId,
                    flagHolderId: this.playerService.player.id,
                });
            }
        }
    }

    itemSwapped(item: Item, playerInventory: Item[]) {
        this.socketService.sendMessage<ItemUpdate>(ActiveGameEvents.ItemSwapped, {
            roomId: this.playerService.roomId,
            playerId: this.playerService.player.id,
            item,
            inventory: playerInventory,
        });
        if (item && item.id.includes(ItemTypes.Flag)) {
            this.socketService.sendMessage(CTFEvents.FlagDropped, { roomId: this.playerService.roomId });
        }
    }

    resetInventory(playerId: string) {
        this.socketService.sendMessage<ItemUpdate>(ActiveGameEvents.ResetInventory, {
            roomId: this.playerService.roomId,
            playerId,
        });
    }

    onSwappedItem(grid: Grid): void {
        this.socketService.on<ItemUpdate>(ActiveGameEvents.ItemUpdate, (data) => {
            for (const row of grid.board) {
                for (const cell of row) {
                    if (data.item && cell.player && cell.player?.id === data.playerId) {
                        cell.item.name = data.item.id;
                        cell.item.description = data.item.tooltip;
                        return;
                    }
                }
            }
        });
    }

    onTradeRequested() {
        this.socketService.on<TradeStartedData>(ActiveGameEvents.TradeStarted, (data) => {
            if (data.playerId !== this.playerService.player.id && data.teammateId !== this.playerService.player.id) {
                return;
            }
            const isLocalPlayerA = data.playerId === this.playerService.player.id;
            const perspectiveData: TradePopupData = {
                playerId: this.playerService.player.id,
                teammateId: isLocalPlayerA ? data.teammateId : data.playerId,
                playerInventory: isLocalPlayerA ? data.playerInventory : data.teammateInventory,
                teammateInventory: isLocalPlayerA ? data.teammateInventory : data.playerInventory,
                playerSelected: undefined,
                teammateItemOffered: undefined,
                playerAccepted: false,
                teammateAccepted: false,
            };
            this.currentTradeData = perspectiveData;
            this._tradePopUp.emit(perspectiveData);
        });
    }

    updateTrade(itemId: string, teammateId: string) {
        this.socketService.sendMessage(ActiveGameEvents.TradeUpdate, {
            roomId: this.playerService.roomId,
            playerId: this.playerService.player.id,
            teammateId,
            itemId,
        });
    }

    onTradeUpdated() {
        this.socketService.on<TradePopupData>(ActiveGameEvents.TradeUpdate, (data) => {
            if (data.playerId !== this.playerService.player.id && data.teammateId !== this.playerService.player.id) {
                return;
            }

            const isLocalPlayerA = data.playerId === this.playerService.player.id;

            const perspectiveData: TradePopupData = {
                playerId: isLocalPlayerA ? data.playerId : data.teammateId,
                teammateId: isLocalPlayerA ? data.teammateId : data.playerId,
                playerInventory: isLocalPlayerA ? data.playerInventory : data.teammateInventory,
                teammateInventory: isLocalPlayerA ? data.teammateInventory : data.playerInventory,
                playerSelected: isLocalPlayerA ? data.playerSelected : data.teammateItemOffered,
                teammateItemOffered: isLocalPlayerA ? data.teammateItemOffered : data.playerSelected,
                playerAccepted: this.currentTradeData?.playerAccepted ?? false,
                teammateAccepted: this.currentTradeData?.teammateAccepted ?? false,
            };
            this.currentTradeData = perspectiveData;
            this._tradePopUp.emit(perspectiveData);
        });
    }

    acceptTrade(teammateId: string) {
        this.socketService.sendMessage(ActiveGameEvents.TradeAccept, {
            roomId: this.playerService.roomId,
            playerId: this.playerService.player.id,
            teammateId,
        });
    }

    onTradeAccepted() {
        this.socketService.on<TradeAcceptData>(ActiveGameEvents.TradeAccept, (data) => {
            if (!this.currentTradeData) return;

            if (data.playerAId !== this.playerService.player.id && data.playerBId !== this.playerService.player.id) {
                return;
            }

            const isLocalPlayerA = this.playerService.player.id === data.playerAId;

            this.currentTradeData.playerAccepted = isLocalPlayerA ? data.playerAAccepted : data.playerBAccepted;
            this.currentTradeData.teammateAccepted = isLocalPlayerA ? data.playerBAccepted : data.playerAAccepted;

            this._tradePopUp.emit({ ...this.currentTradeData });
        });
    }

    cancelTrade(teammateId: string) {
        this.socketService.sendMessage(ActiveGameEvents.TradeCancel, {
            roomId: this.playerService.roomId,
            playerId: this.playerService.player.id,
            teammateId,
        });
    }

    onTimerEnd() {
        this.socketService.on(TimerEvents.TimerEnd, (data: { isCombat: boolean }) => {
            if (data.isCombat) return;
            if (this.currentTradeData) {
                this.cancelTrade(this.currentTradeData.teammateId);
            }
        });
    }

    onTradeCanceled() {
        this.socketService.on(ActiveGameEvents.TradeCancel, () => {
            this._tradeClosed.emit();
        });
    }

    onTradeCompleted() {
        this.socketService.on<TradeCompleteData>(ActiveGameEvents.TradeComplete, (data) => {
            if (this.playerService.player.id === data.playerAId) {
                this.playerService.player.inventory = data.playerAInventory;
            }

            if (this.playerService.player.id === data.playerBId) {
                this.playerService.player.inventory = data.playerBInventory;
            }

            this.injector.get(ActionService).consumeAction();

            this._tradeClosed.emit();
        });
    }

    onItemPickedUp(grid: Grid) {
        this.socketService.on<ItemUpdate>(ActiveGameEvents.ItemPickedUp, (data) => {
            const itemPosition = data.itemPosition;
            if (itemPosition) {
                if (this.playerService.player.id === data.playerId) {
                    this.pickUpItem({ x: itemPosition.x, y: itemPosition.y }, grid);
                }
                grid.board[itemPosition.x][itemPosition.y].item.name = '';
                grid.board[itemPosition.x][itemPosition.y].item.description = '';
            }
        });
    }

    onCombatEnded(grid: Grid) {
        this.socketService.on<CombatUpdate>(ActiveGameEvents.CombatUpdate, (data) => {
            if (data.message !== CombatResults.AttackDefeated) return;

            const myId = this.playerService.player.id;

            if (data.teamCombatContinues && data.defeatedPlayerId) {
                if (data.defeatedPlayerId === myId) {
                    if (this.gameModeService.flagHolder?.id === myId) {
                        this.socketService.sendMessage(CTFEvents.FlagDropped, { roomId: this.playerService.roomId });
                    }
                    this.playerService.updateInventory([]);
                    this.playerService.player.inventory = [];
                    this.resetInventory(myId);
                }
                return;
            }

            if (data.losingPlayerIds && data.losingPlayerIds.length > 0) {
                if (data.losingPlayerIds.includes(myId)) {
                    if (this.gameModeService.flagHolder?.id === myId) {
                        this.socketService.sendMessage(CTFEvents.FlagDropped, { roomId: this.playerService.roomId });
                    }
                    this.playerService.updateInventory([]);
                    this.playerService.player.inventory = [];
                    this.resetInventory(myId);
                }
                return;
            }

            const loser = data.gameState?.players[1] as Player;
            const loserPosition = loser.position as Position;
            const inventory = loser.inventory as Item[];
            if (loser.id === myId) {
                if (loser.inventory && loser.inventory?.length !== 0) {
                    const availablePositions = findAvailableTerrainForItem(loserPosition, grid.board);
                    this.socketService.sendMessage<ItemsDropped>(ActiveGameEvents.ItemsDropped, {
                        roomId: this.playerService.roomId,
                        inventory,
                        positions: availablePositions,
                    });
                }

                if (this.gameModeService.flagHolder?.id === myId)
                    this.socketService.sendMessage(CTFEvents.FlagDropped, { roomId: this.playerService.roomId });
                this.playerService.updateInventory([]);
                this.playerService.player.inventory = [];
                this.resetInventory(loser.id);
            }
        });
    }

    onPlayerDisconnect(grid: Grid) {
        this.socketService.on<GameDisconnect>(ActiveGameEvents.PlayerDisconnect, (data) => {
            const disconnectedPlayerId = data.playerId;
            const inventory = data.itemInformation?.inventory as Item[];
            if (inventory?.length > 0) {
                const availablePositions = findAvailableTerrainForItem(data.itemInformation?.position as Position, grid.board);
                this.socketService.sendMessage<ItemsDropped>(ActiveGameEvents.ItemsDropped, {
                    roomId: data.roomId,
                    inventory,
                    positions: availablePositions,
                });
            }
            if (disconnectedPlayerId === this.playerService.player.id) {
                if (this.gameModeService.flagHolder?.id === this.playerService.player.id)
                    this.socketService.sendMessage(CTFEvents.FlagDropped, { roomId: this.playerService.roomId });
                this.playerService.updateInventory([]);
                this.playerService.player.inventory = [];
            }
        });
    }

    placeItems(grid: Grid) {
        this.socketService.on<ItemsDropped>(ActiveGameEvents.ItemsDropped, (data) => {
            this.dropItemsOnGrid(data.positions, data.inventory, grid);
        });
    }

    filterItemsByMapSize(items: Item[][]): Item[][] {
        let itemCount: number;
        if (items[0][0].id.includes(ItemTypes.StartingPoint)) {
            switch (this._mapSize) {
                case GameSizes.Small:
                    itemCount = ItemCounts.SmallItem;
                    break;
                case GameSizes.Medium:
                    itemCount = ItemCounts.MediumItem;
                    break;
                case GameSizes.Big:
                    itemCount = ItemCounts.BigItem;
                    break;
                default:
                    itemCount = ItemCounts.SmallItem;
            }
        } else {
            return items;
        }
        return items.slice(0, Math.ceil(itemCount / 2)).map((row) => row.slice(0, 2));
    }
    filterSectionsByMode(sections: Section[]): Section[] {
        if (this._mode === GameModes.Classic) {
            return sections.filter((section) => section.label !== ItemCategory.Flag);
        }
        return sections;
    }
    getItemId(id: string): string {
        for (const itemId of Object.values(ItemId)) {
            if (id.includes(itemId)) {
                return itemId;
            }
        }
        return id;
    }
    updateItemStyles(makeUndraggable: boolean): void {
        GROUPED_ITEMS[0].sections.forEach((section) => {
            section.items.forEach((row) => {
                row.forEach((item) => {
                    if (/\d/.test(item.id)) {
                        const element = document.getElementById(item.id);
                        if (element) {
                            if (makeUndraggable) {
                                if (!(element.style.opacity === '0.4')) {
                                    element.style.opacity = '0.39';
                                    element.setAttribute('draggable', 'false');
                                    element.style.cursor = 'default';
                                }
                            } else if (!(element.style.opacity === '0.4')) {
                                element.style.opacity = '1';
                                element.setAttribute('draggable', 'true');
                                element.style.cursor = 'grab';
                            }
                        }
                    }
                });
            });
        });
    }

    private dropItemsOnGrid(positions: Position[], inventory: Item[], grid: Grid): void {
        const maxItemsToDrop = Math.min(positions.length, inventory.length, 2);
        for (let x = 0; x < maxItemsToDrop; x++) {
            const position = positions[x];
            if (position && grid.board[position.x] && grid.board[position.x][position.y]) {
                grid.board[position.x][position.y].item = {
                    name: inventory[x].id,
                    description: inventory[x].tooltip,
                };
                if (inventory[x].id.includes(ItemTypes.Flag)) {
                    this.socketService.sendMessage(CTFEvents.FlagDropped, { roomId: this.playerService.roomId });
                }
            }
        }
    }
}
