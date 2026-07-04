import { Injectable, OnDestroy } from '@angular/core';
import { ChatChannelService } from '@app/services/chat-channel/chat-channel.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { DELETED_ACCOUNT_USERNAME } from '@common/constants';
import { GameChatEvents } from '@common/gateway-events';
import { Message, MessagePayload } from '@common/interfaces';
import { newDate } from '@common/shared-utils';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class GameTeamChatService implements OnDestroy {
    private readonly _messages = new BehaviorSubject<Message[]>([]);
    private _currentRoomId: string | null = null;
    private accountDeletedSub?: Subscription;

    constructor(
        private readonly gameModeService: GameModeService,
        private readonly socketService: SocketService,
        private readonly playerService: PlayerService,
        private readonly chatChannelService: ChatChannelService,
    ) {
        this.setupListeners();
        this.accountDeletedSub = this.chatChannelService.accountDeleted$.subscribe((deletedUsername) => {
            this._messages.next(
                this._messages.value.map((msg) =>
                    msg.player.name === deletedUsername ? { ...msg, player: { ...msg.player, name: DELETED_ACCOUNT_USERNAME } } : msg,
                ),
            );
        });
    }

    get messages(): Observable<Message[]> {
        return this._messages.asObservable();
    }

    isMyMessage(message: Message) {
        return this.playerService.player.id === message.player.id;
    }

    initForRoom(): void {
        const roomId = this.playerService.roomId;
        if (this._currentRoomId !== roomId) {
            this._messages.next([]);
            this._currentRoomId = roomId;
        }
    }

    reset(): void {
        this._messages.next([]);
    }

    sendMessage(text: string) {
        const teamId = this.gameModeService.getTeamId(this.playerService.player.id);
        if (!teamId) {
            return;
        }
        const payload: MessagePayload = {
            message: {
                message: text,
                time: newDate(),
                player: this.playerService.player,
            },
            roomId: this.playerService.roomId + '-' + teamId,
        };
        this.socketService.sendMessage(GameChatEvents.SendMessage, payload);
    }

    ngOnDestroy(): void {
        this.socketService.off(GameChatEvents.ReceiveTeamMessage);
        this.accountDeletedSub?.unsubscribe();
    }

    private setupListeners() {
        this.socketService.on<MessagePayload>(GameChatEvents.ReceiveTeamMessage, (data) => {
            this._messages.next([...this._messages.value, data.message]);
        });
    }
}
