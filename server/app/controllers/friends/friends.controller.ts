import { Controller, Post, Delete, Param, UseGuards, Get, Query } from '@nestjs/common';
import { AuthGuard } from '@app/guards/auth.guard';
import { currentUser } from '@app/decorators/current-user.decorator';
import { UserDocument } from '@app/model/database/user';
import { FriendsService } from '@app/services/friends/friends.service';

@Controller('friends')
@UseGuards(AuthGuard)
export class FriendsController {
    constructor(private friendsService: FriendsService) {}

    @Get('search')
    async search(@currentUser() user: UserDocument, @Query('name') name: string) {
        return await this.friendsService.searchUsers(user.firebaseUid, name);
    }

    @Post(':uidDestination')
    async sendRequest(@currentUser() user: UserDocument, @Param('uidDestination') uidDestination: string) {
        await this.friendsService.sendFriendRequest(user.firebaseUid, uidDestination);
        return { message: 'server_msg.request_sent' };
    }

    @Post('accept/:uidDestination')
    async acceptRequest(@currentUser() user: UserDocument, @Param('uidDestination') uidDestination: string) {
        await this.friendsService.acceptFriendRequest(user.firebaseUid, uidDestination);
        return { message: 'server_msg.friend_added' };
    }

    @Post('refuse/:uidDestination')
    async refuseRequest(@currentUser() user: UserDocument, @Param('uidDestination') uidDestination: string) {
        await this.friendsService.refuseFriendRequest(user.firebaseUid, uidDestination);
        return { message: 'server_msg.request_refused' };
    }

    @Delete(':uidDestination')
    async deleteFriend(@currentUser() user: UserDocument, @Param('uidDestination') uidDestination: string) {
        await this.friendsService.removeFriend(user.firebaseUid, uidDestination);
        return { message: 'server_msg.friend_removed' };
    }

    @Get()
    async getFriends(@currentUser() user: UserDocument) {
        return await this.friendsService.getFriendList(user.firebaseUid);
    }

    @Get('requests')
    async getPendingRequests(@currentUser() user: UserDocument) {
        return await this.friendsService.getPendingRequests(user.firebaseUid);
    }

    @Get('requests/sent')
    async getSentRequests(@currentUser() user: UserDocument) {
        return await this.friendsService.getSentRequests(user.firebaseUid);
    }
}
