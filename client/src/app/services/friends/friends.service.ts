import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { FriendSocketEvents } from '@app/enums/socket-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { SocketService } from '@app/services/socket/socket.service';
import { AccountType } from '@common/types';
import { BehaviorSubject, Observable, Subscription, combineLatest } from 'rxjs';
import { distinctUntilChanged, filter } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class FriendsService implements OnDestroy {
    friends$: Observable<AccountType[]>;
    requests$: Observable<AccountType[]>;
    sentRequests$: Observable<AccountType[]>;

    private friendsSubject = new BehaviorSubject<AccountType[]>([]);
    private requestsSubject = new BehaviorSubject<AccountType[]>([]);
    private sentRequestsSubject = new BehaviorSubject<AccountType[]>([]);
    private connectionSub?: Subscription;

    constructor(
        private http: HttpClient,
        private alertService: AlertService,
        private authService: AuthService,
        private socketService: SocketService,
        private ngZone: NgZone,
    ) {
        this.friends$ = this.friendsSubject.asObservable();
        this.requests$ = this.requestsSubject.asObservable();
        this.sentRequests$ = this.sentRequestsSubject.asObservable();

        this.initSocketManager();
    }

    registerUserSocket(): void {
        const uid = this.authService.currentUserProfile?.uid;
        const socketId = this.socketService.getSocketId();

        if (uid && socketId) {
            this.socketService.sendMessage(FriendSocketEvents.RegisterFriendSocket, { uid });
        } else {
            if (!socketId) this.socketService.connect();
        }
    }

    refresh(): void {
        this.getFriends().subscribe({
            next: (friends) => {
                this.friendsSubject.next(friends);
                const currentProfile = this.authService.currentUserProfile;
                if (currentProfile) {
                    this.authService.refreshUserProfile({
                        ...currentProfile,
                        friendList: friends.map((friend) => friend.uid),
                    });
                }
            },
        });

        this.getRequests().subscribe({
            next: (requests) => this.requestsSubject.next(requests),
        });

        this.getSentRequests().subscribe({
            next: (sentRequests) => this.sentRequestsSubject.next(sentRequests),
        });
    }

    searchUsers(query: string): Observable<AccountType[]> {
        return this.http.get<AccountType[]>(`${environment.serverUrl}/friends/search`, {
            params: { name: query },
        });
    }

    sendRequest(user: AccountType): void {
        const optimisticRequest: AccountType = {
            ...user,
        };

        const currentSent = this.sentRequestsSubject.value;
        this.sentRequestsSubject.next([...currentSent, optimisticRequest]);

        this.http.post(`${environment.serverUrl}/friends/${user.uid}`, {}).subscribe({
            next: () => {
                this.alertService.showSuccess('popup.success_title', 'common.request_sent_success');
                this.refresh();
            },
            error: () => {
                this.sentRequestsSubject.next(currentSent);
                this.alertService.showInfo('popup.error_title', 'common.request_send_error');
            },
        });
    }

    accept(uid: string): void {
        const currentRequests = this.requestsSubject.value;
        const currentFriends = this.friendsSubject.value;
        const currentSentRequests = this.sentRequestsSubject.value;
        const acceptedRequest = currentRequests.find((req) => req.uid === uid);

        if (acceptedRequest) {
            this.requestsSubject.next(currentRequests.filter((req) => req.uid !== uid));
            this.friendsSubject.next([...currentFriends, acceptedRequest]);
            this.sentRequestsSubject.next(currentSentRequests.filter((req) => req.uid !== uid));
        }

        this.http.post(`${environment.serverUrl}/friends/accept/${uid}`, {}).subscribe({
            next: () => this.refresh(),
            error: () => {
                this.requestsSubject.next(currentRequests);
                this.friendsSubject.next(currentFriends);
                this.sentRequestsSubject.next(currentSentRequests);
                this.alertService.showInfo('popup.error_title', 'common.accept_error');
            },
        });
    }

    refuse(uid: string): void {
        const currentRequests = this.requestsSubject.value;
        this.requestsSubject.next(currentRequests.filter((req) => req.uid !== uid));

        this.http.post(`${environment.serverUrl}/friends/refuse/${uid}`, {}).subscribe({
            next: () => this.refresh(),
            error: () => {
                this.requestsSubject.next(currentRequests);
                this.alertService.showInfo('popup.error_title', 'common.refuse_error');
            },
        });
    }

    remove(uid: string): void {
        const currentFriends = this.friendsSubject.value;
        const currentRequests = this.requestsSubject.value;
        const currentSentRequests = this.sentRequestsSubject.value;

        this.friendsSubject.next(currentFriends.filter((friend) => friend.uid !== uid));
        this.requestsSubject.next(currentRequests.filter((req) => req.uid !== uid));
        this.sentRequestsSubject.next(currentSentRequests.filter((req) => req.uid !== uid));

        this.http.delete(`${environment.serverUrl}/friends/${uid}`).subscribe({
            next: () => this.refresh(),
            error: () => {
                this.friendsSubject.next(currentFriends);
                this.requestsSubject.next(currentRequests);
                this.sentRequestsSubject.next(currentSentRequests);
                this.alertService.showInfo('popup.error_title', 'common.remove_error');
            },
        });
    }

    ngOnDestroy(): void {
        this.connectionSub?.unsubscribe();
        this.socketService.off(FriendSocketEvents.RequestNotification);
        this.socketService.off(FriendSocketEvents.RequestReply);
        this.socketService.off(FriendSocketEvents.StatusUpdate);
    }

    private getFriends(): Observable<AccountType[]> {
        return this.http.get<AccountType[]>(`${environment.serverUrl}/friends`);
    }

    private getRequests(): Observable<AccountType[]> {
        return this.http.get<AccountType[]>(`${environment.serverUrl}/friends/requests`);
    }

    private getSentRequests(): Observable<AccountType[]> {
        return this.http.get<AccountType[]>(`${environment.serverUrl}/friends/requests/sent`);
    }

    private initSocketManager() {
        this.socketService.connect();

        const connectionStatus$ = combineLatest([this.socketService.isConnected(), this.authService.userProfile$.pipe(distinctUntilChanged())]);

        this.connectionSub = connectionStatus$
            .pipe(filter(([isConnected, profile]: [boolean, AccountType | null]) => isConnected && !!profile))
            .subscribe(([, profile]: [boolean, AccountType | null]) => {
                if (profile) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const uid = profile.uid || (profile as any).firebaseUid;
                    this.socketService.sendMessage(FriendSocketEvents.RegisterFriendSocket, { uid });
                }
            });

        this.socketService.on(FriendSocketEvents.RequestNotification, () => {
            this.ngZone.run(() => this.refresh());
        });

        this.socketService.on(FriendSocketEvents.RequestReply, () => {
            this.ngZone.run(() => this.refresh());
        });

        this.socketService.on(FriendSocketEvents.StatusUpdate, (data: { uid: string; status: string }) => {
            this.ngZone.run(() => {
                const current = this.friendsSubject.value;
                const updated = current.map((friend) => (friend.uid === data.uid ? { ...friend, status: data.status } : friend));
                this.friendsSubject.next(updated);
            });
        });
    }
}
