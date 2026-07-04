import {
    LOSER_BASE_REWARD,
    LOSER_POT_SHARE,
    TOTAL_POT_SHARES,
    WINNER_BASE_REWARD,
    WINNER_POT_SHARE,
} from '@app/constants/virtual-currency-constants';
import { VirtualCurrencyGateway } from '@app/gateways/virtual-currency/virtual-currency.gateway';
import { User, UserDocument } from '@app/model/database/user';
import { GameReward, RoomData } from '@common/interfaces';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class VirtualCurrencyService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @Inject(forwardRef(() => VirtualCurrencyGateway))
        private readonly virtualCurrencyGateway: VirtualCurrencyGateway,
    ) {}

    async addCurrency(firebaseUid: string, amount: number, socketId?: string): Promise<number> {
        const user = await this.userModel.findOne({ firebaseUid }).exec();
        if (!user) throw new Error('User not found');

        user.virtualCurrency += amount;
        await user.save();

        if (socketId) {
            this.virtualCurrencyGateway.notifyCurrencyChange(socketId, user.virtualCurrency, amount);
        }

        return user.virtualCurrency;
    }

    async removeCurrency(firebaseUid: string, amount: number, socketId?: string): Promise<number> {
        const user = await this.userModel.findOne({ firebaseUid }).exec();
        if (!user) throw new Error('User not found');
        if (user.virtualCurrency < amount) throw new Error('Insufficient currency');

        user.virtualCurrency -= amount;
        await user.save();

        if (socketId) {
            this.virtualCurrencyGateway.notifyCurrencyChange(socketId, user.virtualCurrency, -amount);
        }

        return user.virtualCurrency;
    }

    async getCurrency(firebaseUid: string): Promise<number> {
        const user = await this.userModel.findOne({ firebaseUid }).exec();
        if (!user) throw new Error('User not found');
        return user.virtualCurrency;
    }

    async hasSufficientCurrency(firebaseUid: string, amount: number): Promise<boolean> {
        const user = await this.userModel.findOne({ firebaseUid }).exec();
        return user ? user.virtualCurrency >= amount : false;
    }

    async distributeEndGameRewards(room: RoomData, winnerSocketIds: string[], excludedSocketIds: string[] = []): Promise<GameReward[]> {
        const winnerUids = winnerSocketIds.map((id) => room.playerUids.get(id)).filter((uid) => uid !== undefined);

        const loserUids = room.players
            .filter((p) => !winnerSocketIds.includes(p.id) && !excludedSocketIds.includes(p.id))
            .map((p) => room.playerUids.get(p.id))
            .filter((uid) => uid !== undefined);

        const totalPot = room.paidPlayers.size * room.entryFee;
        const winnerPot = Math.round((totalPot * WINNER_POT_SHARE) / TOTAL_POT_SHARES);
        const loserPot = Math.round((totalPot * LOSER_POT_SHARE) / TOTAL_POT_SHARES);

        const winnerShare = winnerUids.length > 0 ? winnerPot / winnerUids.length : 0;
        const loserShare = loserUids.length > 0 ? loserPot / loserUids.length : 0;

        const rewards: GameReward[] = [];

        for (const uid of winnerUids) {
            const amount = Math.round(WINNER_BASE_REWARD + winnerShare);
            const socketId = Array.from(room.playerUids.entries()).find(([, u]) => u === uid)?.[0];
            await this.addCurrency(uid, amount, socketId);
            const user = await this.userModel.findOne({ firebaseUid: uid }).exec();
            rewards.push({
                uid,
                username: user.username,
                amount,
                isWinner: true,
            });
        }

        for (const uid of loserUids) {
            const amount = Math.round(LOSER_BASE_REWARD + loserShare);
            const socketId = Array.from(room.playerUids.entries()).find(([, u]) => u === uid)?.[0];
            await this.addCurrency(uid, amount, socketId);
            const user = await this.userModel.findOne({ firebaseUid: uid }).exec();
            rewards.push({
                uid,
                username: user.username,
                amount,
                isWinner: false,
            });
        }

        return rewards;
    }
}
