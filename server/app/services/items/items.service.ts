import {
    DAGGER_LIFE_THRESHOLD,
    DICE_EFFECT_RANGE,
    POTION_DEFENSE_PENALTY,
    POTION_LIFE_BONUS,
    SHIELD_ATTACK_PENALTY,
    SHIELD_DEFENSE_BONUS,
} from '@app/constants/combat-constants';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ItemId } from '@common/enums';
import { Stats } from '@common/interfaces';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ItemService {
    constructor(private readonly gameRoomService: GameRoomService) {}

    applyAttributesBuffs(roomId: string, playerId: string, stats: Stats) {
        const room = this.gameRoomService.getRoom(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return stats;
        if (!player.inventory) {
            player.inventory = [];
        }
        const potion = player.inventory.find((i) => i.id === ItemId.Item1);
        const shield = player.inventory.find((i) => i.id === ItemId.Item3);
        if (potion) {
            player.stats.life += POTION_LIFE_BONUS;
            stats.defense -= POTION_DEFENSE_PENALTY;
        } else if (shield) {
            stats.defense += SHIELD_DEFENSE_BONUS;
            stats.attack -= SHIELD_ATTACK_PENALTY;
        }
        return stats;
    }

    applyPoison(roomId: string, playerId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return false;
        const poison = player.inventory?.find((i) => i.id === ItemId.Item4);
        return !!poison;
    }

    applyDagger(roomId: string, playerId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return false;
        const dagger = player.inventory?.find((i) => i.id === ItemId.Item2);
        if (dagger) {
            if (player.stats.life < DAGGER_LIFE_THRESHOLD) {
                return true;
            }
        }
        return false;
    }

    applyDiceEffect(roomId: string, playerId: string, numDice: number) {
        const room = this.gameRoomService.getRoom(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return null;
        const dice = player.inventory?.find((i) => i.id === ItemId.Item6);
        if (dice) {
            return Math.floor(Math.random() * DICE_EFFECT_RANGE) + (numDice - 1);
        }
        return null;
    }

    applyRevive(roomId: string, playerId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return false;
        const revive = player.inventory?.find((i) => i.id === ItemId.Item5);
        return !!revive;
    }
}
