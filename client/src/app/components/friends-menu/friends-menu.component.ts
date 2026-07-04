import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { FriendsService } from '@app/services/friends/friends.service';
import { MOVEMENT_DELAY, SEARCH_DEBOUNCE_TIME } from '@common/constants';
import { AccountType } from '@common/types';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, take } from 'rxjs/operators';

@Component({
    selector: 'app-friends-menu',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule],
    templateUrl: './friends-menu.component.html',
    styleUrl: './friends-menu.component.scss',
})
export class FriendsMenuComponent implements OnInit, OnDestroy {
    @Input() hideButton = false;
    isOpen = false;
    isVisible = true;
    searchQuery = '';
    searchResults: AccountType[] = [];
    searchFocused = false;
    pendingExpanded = true;
    sentExpanded = true;

    friends$: Observable<AccountType[]>;
    requests$: Observable<AccountType[]>;
    sentRequests$: Observable<AccountType[]>;

    private routerSubscription?: Subscription;
    private searchSubscription?: Subscription;
    private searchSubject = new Subject<string>();
    private excludedRoutes: string[] = [Routes.Login];

    constructor(
        public friendsService: FriendsService,
        private router: Router,
        private authService: AuthService,
        private alertService: AlertService,
    ) {
        this.friends$ = this.friendsService.friends$;
        this.requests$ = this.friendsService.requests$;
        this.sentRequests$ = this.friendsService.sentRequests$;
    }

    get currentUsername(): string | undefined {
        return this.authService.currentUserProfile?.username;
    }

    ngOnInit(): void {
        this.updateVisibility();

        this.authService.userProfile$
            .pipe(
                filter((profile) => !!profile),
                take(1),
            )
            .subscribe(() => {
                this.friendsService.refresh();
            });

        this.routerSubscription = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
            this.updateVisibility();
            if (!this.isVisible) {
                this.isOpen = false;
            }
        });

        this.searchSubscription = this.searchSubject.pipe(debounceTime(SEARCH_DEBOUNCE_TIME), distinctUntilChanged()).subscribe((query) => {
            if (query.length >= 1) {
                this.performSearch(query);
            } else {
                this.searchResults = [];
            }
        });
    }

    ngOnDestroy(): void {
        this.routerSubscription?.unsubscribe();
        this.searchSubscription?.unsubscribe();
    }

    toggleMenu(): void {
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            this.friendsService.refresh();
        } else {
            this.searchResults = [];
            this.searchQuery = '';
        }
    }

    search(): void {
        this.searchSubject.next(this.searchQuery);
    }

    onSearchBlur(): void {
        setTimeout(() => {
            this.searchFocused = false;
        }, MOVEMENT_DELAY);
    }

    sendRequest(user: AccountType): void {
        this.friendsService.sendRequest(user);
    }

    accept(uid: string): void {
        this.friendsService.accept(uid);
    }

    refuse(uid: string): void {
        this.friendsService.refuse(uid);
    }

    async remove(uid: string, username: string): Promise<void> {
        const confirmed = await this.alertService.confirm('popup.remove_friend_title', 'popup.remove_friend_message', undefined, undefined, {
            name: username,
        });
        if (!confirmed) return;
        this.friendsService.remove(uid);
    }

    canAdd(friend: AccountType, friends: AccountType[], requests: AccountType[]): boolean {
        return !friends.some((existing) => existing.uid === friend.uid) && !requests.some((req) => req.uid === friend.uid);
    }

    isFriend(user: AccountType, friends: AccountType[]): boolean {
        return friends.some((existing) => existing.uid === user.uid);
    }

    isPending(user: AccountType, requests: AccountType[], sentRequests: AccountType[]): boolean {
        return requests.some((req) => req.uid === user.uid) || sentRequests.some((req) => req.uid === user.uid);
    }

    private performSearch(query: string): void {
        this.friendsService.searchUsers(query).subscribe({
            next: (res) => {
                this.searchResults = res;
            },
            error: () => {
                this.alertService.showInfo('popup.error_title', 'common.search_error');
                this.searchResults = [];
            },
        });
    }

    private updateVisibility(): void {
        this.isVisible = !this.excludedRoutes.includes(this.router.url);
    }
}
