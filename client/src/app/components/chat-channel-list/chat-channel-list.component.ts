import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatChannelService, DeletedChannelNotification } from '@app/services/chat-channel/chat-channel.service';
import { SocketService } from '@app/services/socket/socket.service';
import { CustomChannelEvents } from '@common/gateway-events';
import { ChatChannelInfo } from '@common/types';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subscription } from 'rxjs';

type ModalTab = 'join' | 'create';

@Component({
    selector: 'app-chat-channel-list',
    imports: [CommonModule, FormsModule, TranslateModule],
    templateUrl: './chat-channel-list.component.html',
    styleUrl: './chat-channel-list.component.scss',
})
export class ChatChannelListComponent implements OnDestroy, OnInit {
    @Input() channels: ChatChannelInfo[] = [];
    @Input() currentUsername = '';
    @Output() openChannel = new EventEmitter<ChatChannelInfo>();
    @Output() leaveChannel = new EventEmitter<ChatChannelInfo>();
    @Output() closeChannelEvent = new EventEmitter<ChatChannelInfo>();
    @Input() initialFilter = '';

    isModalOpen = false;
    modalTab: ModalTab = 'join';
    searchQuery = '';
    filterQuery = '';
    searchResults: ChatChannelInfo[] = [];
    errorMessage = '';
    deletedNotifications$: Observable<DeletedChannelNotification[]>;

    private searchSub: Subscription;
    private createdSub: Subscription;
    private boundErrorCallback: (msg: string) => void;

    constructor(
        private readonly chatChannelService: ChatChannelService,
        private readonly socketService: SocketService,
        private readonly translate: TranslateService,
    ) {
        this.deletedNotifications$ = this.chatChannelService.deletedChannelNotifications$;
        this.boundErrorCallback = (msg: string) => {
            this.errorMessage = msg.startsWith('server_msg.') ? this.translate.instant(msg) : msg;
        };
        this.searchSub = this.chatChannelService.searchResults$.subscribe((results) => {
            this.searchResults = results;
        });
        this.createdSub = this.chatChannelService.joinedChannels$.subscribe(() => {
            if (this.isModalOpen && this.modalTab === 'create' && !this.errorMessage) {
                this.closeModal();
            }
        });
        this.socketService.on<string>(CustomChannelEvents.Error, this.boundErrorCallback);
    }

    get filteredChannels(): ChatChannelInfo[] {
        if (!this.filterQuery.trim()) return this.channels;
        const query = this.filterQuery.toLowerCase();
        return this.channels.filter((channel) => channel.name.toLowerCase().startsWith(query));
    }

    ngOnInit(): void {
        if (this.initialFilter) {
            this.filterQuery = this.initialFilter;
        }
        this.chatChannelService.refreshJoinedChannels();
    }

    ngOnDestroy(): void {
        this.searchSub.unsubscribe();
        this.createdSub.unsubscribe();
        this.socketService.off(CustomChannelEvents.Error, this.boundErrorCallback);
    }

    onSearchInput(): void {
        this.errorMessage = '';
        if (this.modalTab === 'join') {
            if (this.searchQuery.trim()) {
                this.chatChannelService.searchChannels(this.searchQuery.trim());
            } else {
                this.searchResults = [];
            }
        }
    }

    onJoinChannel(channelId: string): void {
        this.chatChannelService.joinChannel(channelId);
        this.searchResults = this.searchResults.filter((channel) => channel._id !== channelId);
    }

    onCreate(): void {
        if (!this.searchQuery.trim()) return;
        this.errorMessage = '';
        this.chatChannelService.createChannel(this.searchQuery.trim());
    }

    closeModal(): void {
        this.isModalOpen = false;
        this.searchQuery = '';
        this.searchResults = [];
        this.errorMessage = '';
    }

    isOwner(channel: ChatChannelInfo): boolean {
        return channel.owner === this.currentUsername;
    }

    dismissNotification(channelName: string): void {
        this.chatChannelService.dismissDeletedNotification(channelName);
    }
}
