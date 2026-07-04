import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameTeamChatService } from '@app/services/game-team-chat/game-team-chat.service';
import { DELETED_ACCOUNT_USERNAME, DOM_DELAY } from '@common/constants';
import { Message } from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-game-team-chat',
    imports: [FormsModule, TranslateModule],
    templateUrl: './game-team-chat.component.html',
    styleUrl: './game-team-chat.component.scss',
    standalone: true,
})
export class GameTeamChatComponent implements OnInit, OnDestroy {
    @ViewChild('messagesContainer') private readonly messagesContainer!: ElementRef;
    @ViewChild('chatInput') private readonly chatInput!: ElementRef<HTMLInputElement>;
    messages: Message[] = [];
    messageText: string = '';
    messagesSubscription = new Subscription();

    constructor(
        private readonly gameChatService: GameTeamChatService,
        private readonly translate: TranslateService,
    ) {}

    ngOnInit(): void {
        this.gameChatService.initForRoom();
        this.messagesListener();
    }

    isMyMessage(message: Message) {
        return this.gameChatService.isMyMessage(message);
    }

    displayName(name?: string): string {
        if (!name) return '';
        return name === DELETED_ACCOUNT_USERNAME ? this.translate.instant('server_msg.deleted_account') : name;
    }

    sendMessage(text: string) {
        if (text.length === 0) return;
        this.gameChatService.sendMessage(text);
        this.messageText = '';
        this.chatInput.nativeElement.focus();
        this.scrollToBottom();
    }

    ngOnDestroy(): void {
        this.messagesSubscription.unsubscribe();
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            setTimeout(() => {
                const container = this.messagesContainer.nativeElement;
                container.scrollTop = container.scrollHeight;
            }, DOM_DELAY);
        }
    }
    private messagesListener() {
        this.messagesSubscription = this.gameChatService.messages.subscribe((messages) => {
            this.messages = messages;
            this.scrollToBottom();
        });
    }
}
