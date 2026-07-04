import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ChatChannelListComponent } from '@app/components/chat-channel-list/chat-channel-list.component';
import { ChatMessageListComponent } from '@app/components/chat-message-list/chat-message-list.component';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { ChatChannelService } from '@app/services/chat-channel/chat-channel.service';
import { ElectronService } from '@app/services/electron/electron.service';
import { ChatChannelInfo, ChatChannelMessage } from '@common/types';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

type MainTab = 'global' | 'channels';

@Component({
    selector: 'app-chat-menu',
    imports: [CommonModule, ChatMessageListComponent, ChatChannelListComponent, TranslateModule],
    templateUrl: './chat-menu.component.html',
    styleUrl: './chat-menu.component.scss',
})
export class ChatMenuComponent implements OnInit, OnDestroy {
    @ViewChild(ChatMessageListComponent) private messageList?: ChatMessageListComponent;
    @ViewChild(ChatChannelListComponent) private channelList?: ChatChannelListComponent;

    isOpen = false;
    isVisible = true;
    mainTab: MainTab = 'global';
    activeChannel: ChatChannelInfo | null = null;
    draftTexts = new Map<string, string>();

    messages$: Observable<ChatChannelMessage[]>;
    joinedChannels$: Observable<ChatChannelInfo[]>;

    private routerSub?: Subscription;
    private detachSub?: Subscription;
    private deletedSub?: Subscription;
    private readonly excludedRoutes: string[] = [Routes.Login];

    constructor(
        private readonly alertService: AlertService,
        private readonly chatChannelService: ChatChannelService,
        private readonly router: Router,
        private readonly electronService: ElectronService,
        private readonly translateService: TranslateService,
    ) {
        this.messages$ = this.chatChannelService.globalMessages$;
        this.joinedChannels$ = this.chatChannelService.joinedChannels$;
    }

    get currentUsername(): string {
        return this.chatChannelService.displayUsername ?? '';
    }

    get isElectron(): boolean {
        return this.electronService.isElectron;
    }

    get isChatDetached(): boolean {
        return this.electronService.isChatDetached;
    }

    getDraft(key: string): string {
        return this.draftTexts.get(key) || '';
    }

    sendGlobalMessage = (text: string): void => {
        this.chatChannelService.sendGlobalMessage(text);
    };

    sendChannelMessage = (text: string): void => {
        if (this.activeChannel) {
            this.chatChannelService.sendChannelMessage(this.activeChannel._id, text);
        }
    };

    ngOnInit(): void {
        this.updateVisibility();
        this.routerSub = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
            this.updateVisibility();
            if (!this.isVisible) {
                this.isOpen = false;
                if (this.electronService.isChatDetached) {
                    this.electronService.closeChatWindow();
                }
            }
        });

        this.detachSub = this.electronService.chatDetached$.subscribe((detached) => {
            if (detached) {
                this.isOpen = false;
            } else {
                this.restoreReattachState();
            }
        });

        this.deletedSub = this.chatChannelService.channelDeletedId$.subscribe((channelId) => {
            if (this.activeChannel?._id === channelId) {
                this.activeChannel = null;
            }
        });
    }

    ngOnDestroy(): void {
        this.routerSub?.unsubscribe();
        this.detachSub?.unsubscribe();
        this.deletedSub?.unsubscribe();
    }

    toggleChat(): void {
        if (this.electronService.isChatDetached) {
            this.electronService.focusChatWindow();
            return;
        }
        this.isOpen = !this.isOpen;
    }

    detachChat(): void {
        this.saveDraft();
        const state = {
            mainTab: this.mainTab,
            activeChannel: this.activeChannel,
            draftTexts: Object.fromEntries(this.draftTexts),
            lang: this.translateService.getCurrentLang(),
        };
        localStorage.setItem('chatDetachState', JSON.stringify(state));
        this.isOpen = false;
        this.electronService.detachChat();
    }

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

    private restoreReattachState(): void {
        const raw = localStorage.getItem('chatReattachState');
        if (!raw) return;
        localStorage.removeItem('chatReattachState');

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
                this.chatChannelService.retrieveChannelMessages(state.activeChannel._id);
            }
        } catch {
            // Invalid state — use defaults
        }
    }

    private updateVisibility(): void {
        this.isVisible = !this.excludedRoutes.includes(this.router.url);
    }
}
