import { currentUser } from '@app/decorators/current-user.decorator';
import { GlobalChannelGateway } from '@app/gateways/chat-channel/global-channel.gateway';
import { AuthGuard } from '@app/guards/auth.guard';
import { UserDocument } from '@app/model/database/user';
import { AuthService } from '@app/services/auth/auth.service';
import { ChatChannelService } from '@app/services/chat-channel/chat-channel.service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { DELETED_ACCOUNT_USERNAME } from '@common/constants';
import { BadRequestException, Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly virtualCurrencyService: VirtualCurrencyService,
        private readonly chatChannelService: ChatChannelService,
        private readonly globalChannelGateway: GlobalChannelGateway,
    ) {}

    @Post('check-username')
    async checkUsername(@Body() body: { username: string }) {
        const isAvailable = await this.authService.checkUsernameAvailability(body.username);
        return { available: isAvailable };
    }

    @Post('check-email')
    async checkEmail(@Body() body: { email: string }) {
        const isAvailable = await this.authService.checkEmailAvailability(body.email);
        return { available: isAvailable };
    }

    @Post()
    async createUser(@Body() body: { uid: string; email: string; username: string; avatar: string }) {
        return this.authService.createUser(body.uid, body.email, body.username, body.avatar);
    }

    @Post('login')
    async login(@Body() body: { uid: string }) {
        return this.authService.login(body.uid);
    }

    @Post('logout')
    @UseGuards(AuthGuard)
    async logout(@currentUser() user: UserDocument) {
        return this.authService.logout(user.firebaseUid);
    }

    @Get()
    @UseGuards(AuthGuard)
    getCurrentUser(@currentUser() user: UserDocument) {
        return user;
    }

    @Put()
    @UseGuards(AuthGuard)
    async updateCurrentUser(
        @currentUser() user: UserDocument,
        @Body() updates: { username?: string; email?: string; avatar?: string; selectedBackground?: string },
    ) {
        return this.authService.updateProfile(user.firebaseUid, updates);
    }

    @Delete()
    @UseGuards(AuthGuard)
    async deleteCurrentUser(@currentUser() user: UserDocument) {
        const { username } = user;
        await this.chatChannelService.replaceUsername(username, DELETED_ACCOUNT_USERNAME);
        await this.chatChannelService.removeUserFromAllChannels(username);
        this.globalChannelGateway.broadcastAccountDeleted(username);
        return this.authService.deleteUser(user.firebaseUid);
    }

    @Post('purchase-background')
    @UseGuards(AuthGuard)
    async purchaseBackground(@currentUser() user: UserDocument, @Body() body: { backgroundId: string; price: number }) {
        const { backgroundId, price } = body;

        if (user.ownedBackgrounds?.includes(backgroundId)) {
            throw new BadRequestException('Background already owned');
        }

        const hasFunds = await this.virtualCurrencyService.hasSufficientCurrency(user.firebaseUid, price);
        if (!hasFunds) {
            throw new BadRequestException('Insufficient currency');
        }

        await this.virtualCurrencyService.removeCurrency(user.firebaseUid, price);

        const updatedUser = await this.authService.addOwnedBackground(user.firebaseUid, backgroundId);
        return updatedUser;
    }

    @Post('purchase-avatar')
    @UseGuards(AuthGuard)
    async purchaseAvatar(@currentUser() user: UserDocument, @Body() body: { avatarName: string; price: number }) {
        const { avatarName, price } = body;

        if (user.ownedAvatars?.includes(avatarName)) {
            throw new BadRequestException('Avatar already owned');
        }

        const hasFunds = await this.virtualCurrencyService.hasSufficientCurrency(user.firebaseUid, price);
        if (!hasFunds) {
            throw new BadRequestException('Insufficient currency');
        }

        await this.virtualCurrencyService.removeCurrency(user.firebaseUid, price);

        const updatedUser = await this.authService.addOwnedAvatar(user.firebaseUid, avatarName);
        return updatedUser;
    }

    @Post('purchase-music')
    @UseGuards(AuthGuard)
    async purchaseMusic(@currentUser() user: UserDocument, @Body() body: { musicId: string; price: number }) {
        const { musicId, price } = body;

        if (user.ownedMusics?.includes(musicId)) {
            throw new BadRequestException('Music already owned');
        }

        const hasFunds = await this.virtualCurrencyService.hasSufficientCurrency(user.firebaseUid, price);
        if (!hasFunds) {
            throw new BadRequestException('Insufficient currency');
        }

        await this.virtualCurrencyService.removeCurrency(user.firebaseUid, price);

        const updatedUser = await this.authService.addOwnedMusic(user.firebaseUid, musicId);
        return updatedUser;
    }

    @Post('change-theme')
    @UseGuards(AuthGuard)
    async changeTheme(@currentUser() user: UserDocument, @Body() body: { theme: string }) {
        const { theme } = body;

        const updatedUser = await this.authService.updateTheme(user.firebaseUid, theme);
        return updatedUser;
    }

    @Post('change-language')
    @UseGuards(AuthGuard)
    async changeLanguage(@currentUser() user: UserDocument, @Body() body: { language: string }) {
        const { language } = body;
        const updatedUser = await this.authService.updateLanguage(user.firebaseUid, language);
        return updatedUser;
    }

    @Get('tutorial')
    @UseGuards(AuthGuard)
    async getTutorialStep(@currentUser() user: UserDocument) {
        const step = await this.authService.getTutorialStep(user.firebaseUid);
        return { step };
    }

    @Put('tutorial')
    @UseGuards(AuthGuard)
    async updateTutorialStep(@currentUser() user: UserDocument, @Body() body: { step: number }) {
        await this.authService.updateTutorialStep(user.firebaseUid, body.step);
        return { step: body.step };
    }
}
