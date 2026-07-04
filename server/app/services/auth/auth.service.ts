import {
    DEFAULT_AVATAR,
    DEFAULT_USERNAME_PREFIX,
    DEFAULT_USER_STATS,
    MAX_RANDOM_USERNAME,
    SESSION_TOKEN_LENGTH,
} from '@app/constants/auth-constants';
import { AUTH_MESSAGES } from '@app/constants/messages';
import { Game, GameDocument } from '@app/model/database/game';
import { User, UserDocument } from '@app/model/database/user';
import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import * as admin from 'firebase-admin';
import { Model } from 'mongoose';

@Injectable()
export class AuthService implements OnModuleInit {
    private firebaseApp: admin.app.App;

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
        private readonly configService: ConfigService,
    ) {}

    async onModuleInit() {
        const serviceAccountBase64: string = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
        const serviceAccount: admin.ServiceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));

        this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        await this.userModel.updateMany({}, { sessionToken: null, status: 'offline' });
    }

    async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
        return admin.auth(this.firebaseApp).verifyIdToken(token);
    }

    async checkUsernameAvailability(username: string): Promise<boolean> {
        const existingUser = await this.userModel.findOne({ username }).exec();
        return !existingUser;
    }

    async checkEmailAvailability(email: string): Promise<boolean> {
        const existingUser = await this.userModel.findOne({ email }).exec();
        return !existingUser;
    }

    async createUser(firebaseUid: string, email: string, username: string, avatar: string): Promise<{ user: UserDocument; sessionToken: string }> {
        const isAvailable = await this.checkUsernameAvailability(username);
        if (!isAvailable) {
            throw new UnauthorizedException(AUTH_MESSAGES.usernameTaken);
        }

        const sessionToken = this.generateSessionToken();
        const user = await this.userModel.create({
            firebaseUid,
            email,
            username,
            avatar,
            ...DEFAULT_USER_STATS,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            sessionToken,
            status: 'online',
        });
        return { user, sessionToken };
    }

    async login(firebaseUid: string): Promise<{ user: UserDocument; sessionToken: string } | null> {
        let user = await this.userModel.findOne({ firebaseUid }).exec();

        if (!user) {
            const firebaseUser = await admin.auth(this.firebaseApp).getUser(firebaseUid);
            const username = await this.generateUniqueUsername();

            const token = this.generateSessionToken();
            user = await this.userModel.create({
                firebaseUid,
                email: firebaseUser.email,
                username,
                avatar: DEFAULT_AVATAR,
                ...DEFAULT_USER_STATS,
                createdAt: new Date(),
                lastLoginAt: new Date(),
                sessionToken: token,
                status: 'online',
            });

            return { user, sessionToken: token };
        }

        if (user.sessionToken) {
            throw new UnauthorizedException(AUTH_MESSAGES.alreadyLoggedIn);
        }

        const sessionToken = this.generateSessionToken();
        user.sessionToken = sessionToken;
        user.lastLoginAt = new Date();
        user.status = 'online';
        await user.save();

        return { user, sessionToken };
    }

    async logout(firebaseUid: string): Promise<void> {
        await this.userModel.updateOne({ firebaseUid }, { $set: { sessionToken: null, status: 'offline' } }).exec();
    }

    async validateSession(firebaseUid: string, sessionToken: string): Promise<boolean> {
        const user = await this.userModel.findOne({ firebaseUid }).exec();
        return user?.sessionToken === sessionToken;
    }

    async findByFirebaseUid(firebaseUid: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ firebaseUid }).exec();
    }

    async updateProfile(firebaseUid: string, updates: Partial<User>): Promise<UserDocument | null> {
        if (updates.username) {
            const existingUser = await this.userModel.findOne({ username: updates.username, firebaseUid: { $ne: firebaseUid } }).exec();
            if (existingUser) {
                throw new UnauthorizedException('server_msg.username_taken');
            }
        }

        if (updates.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            if (!emailRegex.test(updates.email)) {
                throw new BadRequestException('server_msg.invalid_email');
            }

            const existingUser = await this.userModel.findOne({ email: updates.email, firebaseUid: { $ne: firebaseUid } }).exec();
            if (existingUser) {
                throw new UnauthorizedException('server_msg.email_taken');
            }

            try {
                await admin.auth(this.firebaseApp).updateUser(firebaseUid, { email: updates.email });
            } catch (error) {
                const firebaseError = error as { code?: string };
                if (firebaseError.code === 'auth/invalid-email') {
                    throw new BadRequestException('server_msg.invalid_email');
                }
                if (firebaseError.code === 'auth/email-already-exists') {
                    throw new UnauthorizedException('server_msg.email_taken');
                }
                throw error;
            }
        }

        return this.userModel.findOneAndUpdate({ firebaseUid }, updates, { new: true }).exec();
    }

    async recordGameResult(firebaseUid: string, gameMode: string, isWinner: boolean, duration: number): Promise<void> {
        const update: Record<string, number> = { totalGameTime: duration };
        if (gameMode === 'Classic') {
            update.gamesPlayedClassic = 1;
        } else {
            update.gamesPlayedCTF = 1;
        }
        if (isWinner) {
            update.gamesWon = 1;
        }
        await this.userModel.findOneAndUpdate({ firebaseUid }, { $inc: update }).exec();
    }

    async recordGameWinOnly(firebaseUid: string): Promise<void> {
        await this.userModel.findOneAndUpdate({ firebaseUid }, { $inc: { gamesWon: 1 } }).exec();
    }

    async deleteUser(firebaseUid: string): Promise<void> {
        await this.gameModel.deleteMany({ owner: firebaseUid }).exec();
        await this.userModel.findOneAndDelete({ firebaseUid }).exec();
        await admin.auth(this.firebaseApp).deleteUser(firebaseUid);
    }

    async addOwnedBackground(firebaseUid: string, backgroundId: string): Promise<UserDocument | null> {
        return this.userModel.findOneAndUpdate({ firebaseUid }, { $addToSet: { ownedBackgrounds: backgroundId } }, { new: true }).exec();
    }

    async addOwnedAvatar(firebaseUid: string, avatarName: string): Promise<UserDocument | null> {
        return this.userModel.findOneAndUpdate({ firebaseUid }, { $addToSet: { ownedAvatars: avatarName } }, { new: true }).exec();
    }

    async addOwnedMusic(firebaseUid: string, musicId: string): Promise<UserDocument | null> {
        return this.userModel.findOneAndUpdate({ firebaseUid }, { $addToSet: { ownedMusics: musicId } }, { new: true }).exec();
    }
    async updateTheme(firebaseUid: string, theme: string): Promise<UserDocument | null> {
        return this.userModel.findOneAndUpdate({ firebaseUid }, { $set: { theme } }, { new: true }).exec();
    }

    async updateLanguage(firebaseUid: string, language: string): Promise<UserDocument | null> {
        return this.userModel.findOneAndUpdate({ firebaseUid }, { $set: { language } }, { new: true }).exec();
    }

    async getTutorialStep(firebaseUid: string): Promise<number> {
        const user = await this.userModel.findOne({ firebaseUid }).exec();
        return user?.tutorialStep ?? 0;
    }

    async updateTutorialStep(firebaseUid: string, step: number): Promise<UserDocument | null> {
        return this.userModel.findOneAndUpdate({ firebaseUid }, { $set: { tutorialStep: step } }, { new: true }).exec();
    }

    private generateSessionToken(): string {
        return randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
    }

    private async generateUniqueUsername(): Promise<string> {
        let username: string;
        let isAvailable = false;

        while (!isAvailable) {
            const randomNum = Math.floor(Math.random() * MAX_RANDOM_USERNAME);
            username = `${DEFAULT_USERNAME_PREFIX}${randomNum}`;
            isAvailable = await this.checkUsernameAvailability(username);
        }

        return username;
    }
}
