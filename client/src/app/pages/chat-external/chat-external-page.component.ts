import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatChannelListComponent } from '@app/components/chat-channel-list/chat-channel-list.component';
import { ChatMessageListComponent } from '@app/components/chat-message-list/chat-message-list.component';
import { AlertService } from '@app/services/alert/alert.service';
import { ChatChannelService } from '@app/services/chat-channel/chat-channel.service';
import { CustomizationService } from '@app/services/customization-service/customization.service';
import { SocketService } from '@app/services/socket/socket.service';
import { ChatChannelInfo, ChatChannelMessage } from '@common/types';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subscription, take } from 'rxjs';

type MainTab = 'global' | 'channels';

@Component({
    selector: 'app-chat-external-page',
    standalone: true,
    imports: [CommonModule, ChatMessageListComponent, ChatChannelListComponent, TranslateModule],
    templateUrl: './chat-external-page.component.html',
    styleUrl: './chat-external-page.component.scss',
})
export class ChatExternalPageComponent implements OnInit, OnDestroy {
    @ViewChild(ChatMessageListComponent) private messageList?: ChatMessageListComponent;
    @ViewChild(ChatChannelListComponent) private channelList?: ChatChannelListComponent;

    mainTab: MainTab = 'global';
    activeChannel: ChatChannelInfo | null = null;
    draftTexts = new Map<string, string>();
    messages$: Observable<ChatChannelMessage[]>;
    joinedChannels$: Observable<ChatChannelInfo[]>;

    private deletedSub?: Subscription;
    private pendingActiveChannelId: string | null = null;

    constructor(
        private readonly alertService: AlertService,
        private readonly chatChannelService: ChatChannelService,
        private readonly socketService: SocketService,
        private readonly themeService: CustomizationService,
        private readonly translateService: TranslateService,
    ) {
        this.messages$ = this.chatChannelService.globalMessages$;
        this.joinedChannels$ = this.chatChannelService.joinedChannels$;
        this.restoreDetachStateSync();
    }

    get currentUsername(): string {
        return this.chatChannelService.displayUsername ?? '';
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        this.saveState();
    }

    getDraft(key: string): string {
        return this.draftTexts.get(key) || '';
    }

    ngOnInit(): void {
        this.socketService.connect();
        this.themeService.loadTheme();

        this.deletedSub = this.chatChannelService.channelDeletedId$.subscribe((channelId) => {
            if (this.activeChannel?._id === channelId) {
                this.activeChannel = null;
            }
        });

        this.chatChannelService.ready$.pipe(take(1)).subscribe(() => {
            if (this.pendingActiveChannelId) {
                this.chatChannelService.retrieveChannelMessages(this.pendingActiveChannelId);
                this.pendingActiveChannelId = null;
            }
            this.chatChannelService.refreshJoinedChannels();
        });
    }

    ngOnDestroy(): void {
        this.saveState();
        this.deletedSub?.unsubscribe();
    }

    sendGlobalMessage = (text: string): void => {
        this.chatChannelService.sendGlobalMessage(text);
    };

    sendChannelMessage = (text: string): void => {
        if (this.activeChannel) {
            this.chatChannelService.sendChannelMessage(this.activeChannel._id, text);
        }
    };

    selectMainTab(tab: MainTab): void {
        this.saveDraft();
        this.mainTab = tab;
        if (tab === 'global') {
            this.messages$ = this.chatChannelService.globalMessages$;
        } else if (this.activeChannel) {
            this.messages$ = this.chatChannelService.getChannelMessages$(this.activeChannel._id);
        }
    }

    openChannelChat(channel: ChatChannelInfo): void {
        this.saveDraft();
        this.activeChannel = channel;
        this.messages$ = this.chatChannelService.getChannelMessages$(channel._id);
        this.chatChannelService.retrieveChannelMessages(channel._id);
    }

    backToChannelList(): void {
        this.saveDraft();
        this.activeChannel = null;
    }

    async onLeaveChannel(channel: ChatChannelInfo): Promise<void> {
        const confirmed = await this.alertService.confirm('popup.leave_channel_title', 'popup.leave_channel_message');
        if (!confirmed) return;
        this.chatChannelService.leaveChannel(channel._id);
        if (this.activeChannel?._id === channel._id) {
            this.activeChannel = null;
        }
    }

    async onCloseChannel(channel: ChatChannelInfo): Promise<void> {
        const confirmed = await this.alertService.confirm('popup.delete_channel_title', 'popup.delete_channel_message');
        if (!confirmed) return;
        this.chatChannelService.closeChannel(channel._id);
        if (this.activeChannel?._id === channel._id) {
            this.activeChannel = null;
        }
    }

    private saveDraft(): void {
        if (this.messageList) {
            const key = this.activeChannel ? this.activeChannel._id : 'global';
            this.draftTexts.set(key, this.messageList.messageText);
        }
        if (this.channelList) {
            this.draftTexts.set('_filter', this.channelList.filterQuery);
        }
    }

    private saveState(): void {
        this.saveDraft();
        const state = {
            mainTab: this.mainTab,
            activeChannel: this.activeChannel,
            draftTexts: Object.fromEntries(this.draftTexts),
        };
        localStorage.setItem('chatReattachState', JSON.stringify(state));
    }

    private restoreDetachStateSync(): void {
        const raw = localStorage.getItem('chatDetachState');
        if (!raw) return;
        localStorage.removeItem('chatDetachState');

        try {
            const state = JSON.parse(raw);
            if (state.draftTexts) {
                this.draftTexts = new Map(Object.entries(state.draftTexts));
            }
            if (state.mainTab) {
                this.mainTab = state.mainTab;
            }
            if (state.activeChannel) {
                this.activeChannel = state.activeChannel;
                this.messages$ = this.chatChannelService.getChannelMessages$(state.activeChannel._id);
                this.pendingActiveChannelId = state.activeChannel._id;
            }
            if (state.lang) {
                this.translateService.use(state.lang);
            }
        } catch {
            // Invalid state — use defaults
        }
    }
}
