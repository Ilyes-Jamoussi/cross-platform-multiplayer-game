import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DELETED_ACCOUNT_USERNAME } from '@common/constants';
import { ChatChannelMessage } from '@common/types';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-chat-message-list',
    imports: [CommonModule, FormsModule, TranslateModule],
    templateUrl: './chat-message-list.component.html',
    styleUrl: './chat-message-list.component.scss',
    animations: [
        trigger('messageAnimation', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(10px)' }),
                animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
            ]),
        ]),
    ],
})
export class ChatMessageListComponent implements AfterViewChecked, OnChanges, OnInit {
    @Input() messages: ChatChannelMessage[] = [];
    @Input() currentUsername: string = '';
    @Input() sendMessageFn: (text: string) => void;
    @Input() initialText = '';
    @ViewChild('messagesContainer') private readonly messagesContainer?: ElementRef;
    @ViewChild('chatInput') private readonly chatInput!: ElementRef<HTMLInputElement>;

    messageText = '';
    private shouldScroll = false;

    constructor(private readonly translate: TranslateService) {}

    ngOnInit(): void {
        if (this.initialText) {
            this.messageText = this.initialText;
        }
    }

    ngOnChanges(): void {
        this.shouldScroll = true;
    }

    ngAfterViewChecked(): void {
        if (this.shouldScroll) {
            this.scrollToBottom();
            this.shouldScroll = false;
        }
    }

    sendMessage(): void {
        if (!this.messageText.trim()) return;
        this.sendMessageFn(this.messageText);
        this.messageText = '';
        this.chatInput.nativeElement.focus();
        this.shouldScroll = true;
    }

    displayUsername(username: string): string {
        return username === DELETED_ACCOUNT_USERNAME ? this.translate.instant('server_msg.deleted_account') : username;
    }

    formatSystemMessage(content: string): string {
        try {
            const parsed = JSON.parse(content);
            if (parsed.key) {
                return this.translate.instant(parsed.key, parsed.params || {});
            }
        } catch {
            // Not JSON — legacy message, try to translate as a key
            if (content.startsWith('server_msg.')) {
                return this.translate.instant(content);
            }
        }
        return content;
    }

    formatTime(timestamp: string): string {
        const date = new Date(timestamp);
        return [date.getHours(), date.getMinutes(), date.getSeconds()].map((unit) => unit.toString().padStart(2, '0')).join(':');
    }

    private scrollToBottom(): void {
        if (this.messagesContainer) {
            this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
        }
    }
}
