import { Injectable, OnDestroy } from '@angular/core';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { SocketService } from '@app/services/socket/socket.service';
import { DELETED_ACCOUNT_USERNAME } from '@common/constants';
import { CustomChannelEvents, GlobalChannelEvents } from '@common/gateway-events';
import { ChannelDeletedPayload, ChatChannelInfo, ChatChannelMessage } from '@common/types';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest, distinctUntilChanged, filter, map } from 'rxjs';

export interface DeletedChannelNotification {
    channelName: string;
    selfDeleted: boolean;
}

interface SharedChatState {
    username: string | null;
    globalMessages: ChatChannelMessage[];
    joinedChannels: ChatChannelInfo[];
    channelMessages: Record<string, ChatChannelMessage[]>;
}

const SHARED_STATE_KEY = 'chatSharedState';

@Injectable({ providedIn: 'root' })
export class ChatChannelService implements OnDestroy {
    private readonly globalMessages = new BehaviorSubject<ChatChannelMessage[]>([]);
    private readonly channelMessages = new Map<string, BehaviorSubject<ChatChannelMessage[]>>();
    private readonly joinedChannels = new BehaviorSubject<ChatChannelInfo[]>([]);
    private readonly searchResults = new BehaviorSubject<ChatChannelInfo[]>([]);
    private readonly deletedChannelNotifications = new BehaviorSubject<DeletedChannelNotification[]>([]);
    private readonly channelDeletedId = new Subject<string>();
    private readonly accountDeletedUsername = new Subject<string>();
    private readonly isReady = new BehaviorSubject<boolean>(false);
    private connectionSub?: Subscription;
    private suppressPersist = false;
    private cachedUsername?: string;

    constructor(
        private readonly socketService: SocketService,
        private readonly authService: AuthService,
    ) {
        this.hydrateFromStorage();
        this.setupStorageSync();
        this.setupGlobalListeners();
        this.setupCustomListeners();
        this.waitForConnectionAndInit();
    }

    get ready$(): Observable<boolean> {
        return this.isReady.pipe(filter((ready) => ready));
    }
    get globalMessages$(): Observable<ChatChannelMessage[]> {
        return this.globalMessages.asObservable();
    }

    get joinedChannels$(): Observable<ChatChannelInfo[]> {
        return this.joinedChannels.asObservable();
    }

    get searchResults$(): Observable<ChatChannelInfo[]> {
        return this.searchResults.asObservable();
    }

    get deletedChannelNotifications$(): Observable<DeletedChannelNotification[]> {
        return this.deletedChannelNotifications.asObservable();
    }

    get channelDeletedId$(): Observable<string> {
        return this.channelDeletedId.asObservable();
    }

    get accountDeleted$(): Observable<string> {
        return this.accountDeletedUsername.asObservable();
    }

    get username(): string | undefined {
        return this.authService.currentUserProfile?.username;
    }

    get displayUsername(): string | undefined {
        return this.authService.currentUserProfile?.username ?? this.cachedUsername;
    }

    getChannelMessages$(channelId: string): Observable<ChatChannelMessage[]> {
        return this.getOrCreateChannelSubject(channelId).asObservable();
    }

    sendGlobalMessage(content: string): void {
        if (!this.username || !content.trim()) return;
        this.socketService.sendMessage(GlobalChannelEvents.SendMessage, {
            username: this.username,
            content: content.trim(),
            timestamp: new Date().toISOString(),
        });
    }

    sendChannelMessage(channelId: string, content: string): void {
        if (!this.username || !content.trim()) return;
        const message: ChatChannelMessage = {
            channelId,
            username: this.username,
            content: content.trim(),
            timestamp: new Date().toISOString(),
        };
        this.socketService.sendMessage(CustomChannelEvents.SendMessage, message);
    }

    retrieveChannelMessages(channelId: string): void {
        if (!this.username) return;
        this.socketService.sendMessage(CustomChannelEvents.RetrieveMessages, { channelId, username: this.username });
    }

    createChannel(name: string): void {
        if (!this.username) return;
        this.socketService.sendMessage(CustomChannelEvents.Create, { name, username: this.username });
    }

    joinChannel(channelId: string): void {
        if (!this.username) return;
        this.socketService.sendMessage(CustomChannelEvents.Join, { channelId, username: this.username });
    }

    leaveChannel(channelId: string): void {
        if (!this.username) return;
        this.socketService.sendMessage(CustomChannelEvents.Leave, { channelId, username: this.username });
    }

    closeChannel(channelId: string): void {
        if (!this.username) return;
        this.socketService.sendMessage(CustomChannelEvents.CloseChannel, { channelId, username: this.username });
    }

    dismissDeletedNotification(channelName: string): void {
        const current = this.deletedChannelNotifications.value;
        this.deletedChannelNotifications.next(current.filter((notif) => notif.channelName !== channelName));
    }

    searchChannels(query: string): void {
        if (!this.username) return;
        this.socketService.sendMessage(CustomChannelEvents.Search, { query, username: this.username });
    }

    refreshJoinedChannels(): void {
        if (this.username) {
            this.socketService.sendMessage(CustomChannelEvents.GetJoinedChannels, this.username);
        }
    }

    ngOnDestroy(): void {
        window.removeEventListener('storage', this.handleStorageEvent);
        this.socketService.off(GlobalChannelEvents.ReceiveMessage);
        this.socketService.off(GlobalChannelEvents.AccountDeleted);
        this.socketService.off(CustomChannelEvents.ReceiveMessage);
        this.socketService.off(CustomChannelEvents.GiveMessages);
        this.socketService.off(CustomChannelEvents.ChannelDeleted);
        this.socketService.off(CustomChannelEvents.newOwner);
        this.socketService.off(CustomChannelEvents.SearchResults);
        this.socketService.off(CustomChannelEvents.GiveJoinedChannels);
        this.connectionSub?.unsubscribe();
    }

    private setupGlobalListeners(): void {
        this.socketService.on<ChatChannelMessage>(GlobalChannelEvents.ReceiveMessage, (message) => {
            const current = this.globalMessages.value;
            if (this.containsMessage(current, message)) return;
            this.globalMessages.next([...current, message]);
            this.persistState();
        });

        this.socketService.on<{ username: string }>(GlobalChannelEvents.AccountDeleted, ({ username: deletedUsername }) => {
            const replaceUsername = (msg: ChatChannelMessage): ChatChannelMessage =>
                msg.username === deletedUsername ? { ...msg, username: DELETED_ACCOUNT_USERNAME } : msg;

            this.globalMessages.next(this.globalMessages.value.map(replaceUsername));
            this.channelMessages.forEach((subject) => {
                subject.next(subject.value.map(replaceUsername));
            });
            this.accountDeletedUsername.next(deletedUsername);
            this.persistState();
        });
    }

    private setupCustomListeners(): void {
        this.socketService.on<ChatChannelMessage>(CustomChannelEvents.ReceiveMessage, (message) => {
            const subject = this.channelMessages.get(message.channelId);
            if (!subject) return;
            const current = subject.value;
            if (this.containsMessage(current, message)) return;
            subject.next([...current, message]);
            this.persistState();
        });

        this.socketService.on<{ channelId: string; messages: ChatChannelMessage[] }>(CustomChannelEvents.GiveMessages, (data) => {
            const subject = this.getOrCreateChannelSubject(data.channelId);
            subject.next(data.messages);
            this.persistState();
        });

        this.socketService.on<ChannelDeletedPayload>(CustomChannelEvents.ChannelDeleted, (payload) => {
            this.channelMessages.delete(payload.channelId);
            const wasJoined = this.joinedChannels.value.some((channel) => channel._id === payload.channelId);
            this.channelDeletedId.next(payload.channelId);
            this.refreshJoinedChannels();
            if (wasJoined && payload.channelName) {
                const current = this.deletedChannelNotifications.value;
                if (!current.some((notif) => notif.channelName === payload.channelName)) {
                    const selfDeleted = payload.deletedBy === this.username;
                    this.deletedChannelNotifications.next([...current, { channelName: payload.channelName, selfDeleted }]);
                }
            }
            this.persistState();
        });

        this.socketService.on<{ channelId: string; newOwner: string }>(CustomChannelEvents.newOwner, ({ channelId, newOwner }) => {
            const currentChannels = this.joinedChannels.value;
            const channelIndex = currentChannels.findIndex((channel) => channel._id === channelId);
            if (channelIndex !== -1) {
                const updatedChannel = { ...currentChannels[channelIndex], owner: newOwner };
                const updatedChannels = [...currentChannels];
                updatedChannels[channelIndex] = updatedChannel;
                this.joinedChannels.next(updatedChannels);
                this.persistState();
            }
        });

        this.socketService.on<ChatChannelInfo[]>(CustomChannelEvents.SearchResults, (channels) => {
            this.searchResults.next(channels);
        });

        this.socketService.on<ChatChannelInfo[]>(CustomChannelEvents.GiveJoinedChannels, (channels) => {
            this.joinedChannels.next(channels);
            this.persistState();
        });
    }

    private waitForConnectionAndInit(): void {
        this.connectionSub = combineLatest([this.socketService.isConnected(), this.authService.userProfile$])
            .pipe(
                map(([connected, profile]) => connected && !!profile),
                distinctUntilChanged(),
                filter((ready) => ready),
            )
            .subscribe(() => {
                if (!this.username) return;
                const storedUsername = this.readStoredUsername();
                if (storedUsername && storedUsername !== this.username) {
                    this.globalMessages.next([]);
                    this.channelMessages.forEach((subject) => subject.next([]));
                    this.joinedChannels.next([]);
                }
                this.persistState();
                this.refreshJoinedChannels();
                this.isReady.next(true);
            });
    }

    private getOrCreateChannelSubject(channelId: string): BehaviorSubject<ChatChannelMessage[]> {
        if (!this.channelMessages.has(channelId)) {
            this.channelMessages.set(channelId, new BehaviorSubject<ChatChannelMessage[]>([]));
        }
        return this.channelMessages.get(channelId) as BehaviorSubject<ChatChannelMessage[]>;
    }

    private containsMessage(list: ChatChannelMessage[], msg: ChatChannelMessage): boolean {
        return list.some(
            (existing) =>
                existing.username === msg.username &&
                existing.timestamp === msg.timestamp &&
                existing.content === msg.content &&
                existing.channelId === msg.channelId,
        );
    }

    private setupStorageSync(): void {
        window.addEventListener('storage', this.handleStorageEvent);
    }

    private readonly handleStorageEvent = (event: StorageEvent): void => {
        if (event.key !== SHARED_STATE_KEY || !event.newValue) return;
        try {
            const state = JSON.parse(event.newValue) as SharedChatState;
            this.cachedUsername = state.username ?? undefined;
            this.applyStoredState(state);
        } catch {
            // Ignore malformed state
        }
    };

    private hydrateFromStorage(): void {
        try {
            const raw = localStorage.getItem(SHARED_STATE_KEY);
            if (!raw) return;
            const state = JSON.parse(raw) as SharedChatState;
            this.cachedUsername = state.username ?? undefined;
            this.applyStoredState(state);
        } catch {
            // Ignore malformed state
        }
    }

    private applyStoredState(state: SharedChatState): void {
        this.suppressPersist = true;
        try {
            if (Array.isArray(state.globalMessages)) {
                this.globalMessages.next(this.mergeMessages(this.globalMessages.value, state.globalMessages));
            }
            if (Array.isArray(state.joinedChannels)) {
                this.joinedChannels.next(state.joinedChannels);
            }
            if (state.channelMessages && typeof state.channelMessages === 'object') {
                for (const [channelId, messages] of Object.entries(state.channelMessages)) {
                    if (Array.isArray(messages)) {
                        const subject = this.getOrCreateChannelSubject(channelId);
                        subject.next(this.mergeMessages(subject.value, messages));
                    }
                }
            }
        } finally {
            this.suppressPersist = false;
        }
    }

    private mergeMessages(current: ChatChannelMessage[], incoming: ChatChannelMessage[]): ChatChannelMessage[] {
        if (current.length === 0) return [...incoming];
        const result = [...current];
        for (const msg of incoming) {
            if (!this.containsMessage(result, msg)) {
                result.push(msg);
            }
        }
        result.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
        return result;
    }

    private readStoredUsername(): string | null {
        try {
            const raw = localStorage.getItem(SHARED_STATE_KEY);
            if (!raw) return null;
            const state = JSON.parse(raw) as SharedChatState;
            return state.username ?? null;
        } catch {
            return null;
        }
    }

    private persistState(): void {
        if (this.suppressPersist) return;
        try {
            const channelMessagesRecord: Record<string, ChatChannelMessage[]> = {};
            this.channelMessages.forEach((subject, channelId) => {
                channelMessagesRecord[channelId] = subject.value;
            });
            const state: SharedChatState = {
                username: this.username ?? null,
                globalMessages: this.globalMessages.value,
                joinedChannels: this.joinedChannels.value,
                channelMessages: channelMessagesRecord,
            };
            if (this.username) {
                this.cachedUsername = this.username;
            }
            localStorage.setItem(SHARED_STATE_KEY, JSON.stringify(state));
        } catch {
            // Ignore storage quota / serialization errors
        }
    }
}
