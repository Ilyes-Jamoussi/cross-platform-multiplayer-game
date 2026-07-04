import { ATTACK_BASE_TIME } from '@app/constants/virtual-player-consts';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ITEM_DROP_DELAY } from '@common/constants';
import { ActiveGameEvents } from '@common/gateway-events';
import { ItemsDropped, ItemUpdate, Player, RoomData } from '@common/interfaces';
import { TradeState } from '@common/types';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class ItemGateway implements OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer()
    server: Server;
    private readonly processedConnections = new Map<string, ItemsDropped>();
    private activeTrades = new Map<string, TradeState>();
    private readonly roomRemovedSub: Subscription;

    constructor(
        private readonly gameRoomService: GameRoomService,
        private readonly gameModeService: GameModeService,
    ) {
        this.roomRemovedSub = this.gameRoomService.roomRemoved$.subscribe((roomId) => {
            this.processedConnections.delete(roomId);
            for (const [key, trade] of this.activeTrades.entries()) {
                if (trade.roomId === roomId) {
                    this.activeTrades.delete(key);
                }
            }
        });
    }

    @SubscribeMessage(ActiveGameEvents.ItemSwapped)
    handleItemSwap(@MessageBody() data: ItemUpdate) {
        const room = this.gameRoomService.getRoom(data.roomId);
        const player = room.players.find((playerToFind) => playerToFind.id === data.playerId);
        player.inventory = data.inventory;
        this.server.to(data.roomId).emit(ActiveGameEvents.ItemUpdate, { item: data.item, itemPosition: data.itemPosition, playerId: data.playerId });
    }

    @SubscribeMessage(ActiveGameEvents.TradeInit)
    handleTradeInit(
        @MessageBody()
        data: {
            roomId: string;
            playerId: string;
            teammateId: string;
        },
    ) {
        const room = this.gameRoomService.getRoom(data.roomId);

        const player = room.players.find((p) => p.id === data.playerId);
        const teammate = room.players.find((p) => p.id === data.teammateId);

        if (!player || !teammate) return;

        const tradeKey = this.getTradeKey(data.roomId, data.playerId, data.teammateId);

        const trade: TradeState = {
            roomId: data.roomId,
            playerAId: player.id,
            playerBId: teammate.id,
            playerAAccepted: false,
            playerBAccepted: false,
        };

        this.activeTrades.set(tradeKey, trade);

        this.server.to(data.roomId).emit(ActiveGameEvents.TradeStarted, {
            playerId: player.id,
            teammateId: teammate.id,
            playerInventory: player.inventory ?? [],
            teammateInventory: teammate.inventory ?? [],
        });
        if (teammate?.type) {
            const timeout = setTimeout(() => {
                if (!this.gameRoomService.getRoom(data.roomId)) return;
                if ((teammate.inventory?.length ?? 0) > 0) {
                    this.handleTradeUpdate({
                        roomId: data.roomId,
                        playerId: data.teammateId,
                        teammateId: data.playerId,
                        itemId: teammate.inventory[0].uniqueId,
                    });
                }
                this.gameRoomService.unregisterRoomTimeout(data.roomId, timeout);
            }, ATTACK_BASE_TIME);
            this.gameRoomService.registerRoomTimeout(data.roomId, timeout);
        }
    }

    @SubscribeMessage(ActiveGameEvents.TradeUpdate)
    handleTradeUpdate(
        @MessageBody()
        data: {
            roomId: string;
            playerId: string;
            teammateId: string;
            itemId?: string;
        },
    ) {
        const tradeKey = this.getTradeKey(data.roomId, data.playerId, data.teammateId);
        const trade = this.activeTrades.get(tradeKey);

        if (!trade) return;

        const room = this.gameRoomService.getRoom(data.roomId);

        const playerA = room.players.find((p) => p.id === trade.playerAId);
        const playerB = room.players.find((p) => p.id === trade.playerBId);

        if (!playerA || !playerB) return;

        if (trade.playerAId === data.playerId) {
            trade.playerAItemId = data.itemId;
            trade.playerAAccepted = false;
            trade.playerBAccepted = false;
        }

        if (trade.playerBId === data.playerId) {
            trade.playerBItemId = data.itemId;
            trade.playerAAccepted = false;
            trade.playerBAccepted = false;
        }

        const itemA = playerA.inventory?.find((i) => i.uniqueId === trade.playerAItemId);
        const itemB = playerB.inventory?.find((i) => i.uniqueId === trade.playerBItemId);

        this.server.to(data.roomId).emit(ActiveGameEvents.TradeUpdate, {
            playerId: playerA.id,
            teammateId: playerB.id,
            playerInventory: playerA.inventory,
            teammateInventory: playerB.inventory,
            playerSelected: itemA,
            teammateItemOffered: itemB,
        });
    }

    @SubscribeMessage(ActiveGameEvents.TradeAccept)
    handleTradeAccept(
        @MessageBody()
        data: {
            roomId: string;
            playerId: string;
            teammateId: string;
        },
    ) {
        const tradeKey = this.getTradeKey(data.roomId, data.playerId, data.teammateId);
        const trade = this.activeTrades.get(tradeKey);

        if (!trade) return;

        if (trade.playerAId === data.playerId) trade.playerAAccepted = true;
        if (trade.playerBId === data.playerId) trade.playerBAccepted = true;

        const room = this.gameRoomService.getRoom(trade.roomId);
        const playerA = room.players.find((p) => p.id === trade.playerAId);
        const playerB = room.players.find((p) => p.id === trade.playerBId);

        if (trade.playerAAccepted && !trade.playerBAccepted && playerB?.type) {
            trade.playerBAccepted = true;
        }
        if (trade.playerBAccepted && !trade.playerAAccepted && playerA?.type) {
            trade.playerAAccepted = true;
        }

        this.server.to(trade.roomId).emit(ActiveGameEvents.TradeAccept, {
            playerAId: trade.playerAId,
            playerBId: trade.playerBId,
            playerAAccepted: trade.playerAAccepted,
            playerBAccepted: trade.playerBAccepted,
        });

        if (trade.playerAAccepted && trade.playerBAccepted) {
            try {
                this.executeTrade(trade);
                this.activeTrades.delete(tradeKey);
            } catch (error) {
                this.server.to(data.roomId).emit(ActiveGameEvents.TradeCancel);
            }
        }
    }

    @SubscribeMessage(ActiveGameEvents.TradeCancel)
    handleTradeCancel(
        @MessageBody()
        data: {
            roomId: string;
            playerId: string;
            teammateId: string;
        },
    ) {
        const tradeKey = this.getTradeKey(data.roomId, data.playerId, data.teammateId);

        this.activeTrades.delete(tradeKey);

        this.server.to(data.roomId).emit(ActiveGameEvents.TradeCancel);
    }

    @SubscribeMessage(ActiveGameEvents.ResetInventory)
    handleResetItems(@MessageBody() data: ItemUpdate) {
        const room = this.gameRoomService.getRoom(data.roomId);
        const player = room.players.find((p) => p.id === data.playerId);
        player.inventory = [];
    }

    @SubscribeMessage(ActiveGameEvents.ItemsDropped)
    handleDroppedItems(@MessageBody() data: ItemsDropped) {
        const roomId = data.roomId;
        if (this.processedConnections.has(roomId)) {
            const storedData = this.processedConnections.get(roomId);
            this.server.to(roomId).emit(ActiveGameEvents.ItemsDropped, storedData);
            return;
        }

        this.processedConnections.set(roomId, data);
        this.server.to(roomId).emit(ActiveGameEvents.ItemsDropped, data);
        const timeout = setTimeout(() => {
            this.processedConnections.delete(roomId);
            this.gameRoomService.unregisterRoomTimeout(roomId, timeout);
        }, ITEM_DROP_DELAY);
        this.gameRoomService.registerRoomTimeout(roomId, timeout);
    }

    handleDisconnect(client: Socket) {
        for (const [key, trade] of this.activeTrades.entries()) {
            if (trade.playerAId === client.id || trade.playerBId === client.id) {
                this.activeTrades.delete(key);
            }
        }
    }

    onModuleDestroy() {
        this.roomRemovedSub?.unsubscribe();
    }

    private getTradeKey(roomId: string, id1: string, id2: string) {
        const [a, b] = [id1, id2].sort();
        return `${roomId}-${a}-${b}`;
    }

    private executeTrade(trade: TradeState) {
        const room = this.gameRoomService.getRoom(trade.roomId);
        if (!room) return;

        const playerA = room.players.find((p) => p.id === trade.playerAId);
        const playerB = room.players.find((p) => p.id === trade.playerBId);

        if (!playerA || !playerB) return;

        this.verifyTrade(room, playerA, playerB);

        const itemA = playerA.inventory?.find((i) => i.uniqueId === trade.playerAItemId);
        const itemB = playerB.inventory?.find((i) => i.uniqueId === trade.playerBItemId);

        if (!itemA && !itemB) return;

        if (itemA) {
            playerA.inventory = playerA.inventory.filter((i) => i.uniqueId !== itemA.uniqueId);
            playerB.inventory = [...(playerB.inventory || []), itemA];
        }

        if (itemB) {
            playerB.inventory = playerB.inventory.filter((i) => i.uniqueId !== itemB.uniqueId);
            playerA.inventory = [...(playerA.inventory || []), itemB];
        }

        this.server.to(trade.roomId).emit(ActiveGameEvents.TradeComplete, {
            playerAId: playerA.id,
            playerBId: playerB.id,
            playerAInventory: [...playerA.inventory],
            playerBInventory: [...playerB.inventory],
        });
    }

    private verifyTrade(room: RoomData, player: Player, teammate: Player) {
        if (!this.gameModeService.isPartOfTeam(player, teammate, room.teams)) {
            throw new Error('Players are not teammates');
        }

        const dx = Math.abs(player.position.x - teammate.position.x);
        const dy = Math.abs(player.position.y - teammate.position.y);

        const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
        if (!isAdjacent) {
            throw new Error('Players are no longer adjacent');
        }
    }
}
