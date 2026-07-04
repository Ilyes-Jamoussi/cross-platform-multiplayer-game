import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageLoadingComponent } from '@app/components/page-loading/page-loading.component';
import { PublicRoomCardComponent } from '@app/components/public-room-card/public-room-card.component';
import { JOIN_PAGE_ROOM_CODE_LENGTH } from '@app/constants/join-page.constants';
import { CONFIRM_POPUP_ENTER_MS, CONFIRM_POPUP_EXIT_MS } from '@app/constants/ui-animations.constants';
import { Routes } from '@app/enums/routes-enums';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { createLoadingMinDelayScheduler } from '@app/utils/loading-min-delay';
import { GameRoomEvents } from '@common/gateway-events';
import { PublicRoomInfo, RoomData } from '@common/interfaces';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-join-page',
    templateUrl: './join-page.component.html',
    styleUrls: ['./join-page.component.scss'],
    standalone: true,
    imports: [FormsModule, PageLoadingComponent, TranslateModule, PublicRoomCardComponent, CoinIconComponent],
    animations: [
        trigger('privateJoinShell', [
            transition(':enter', [style({ opacity: 0 }), animate(`${CONFIRM_POPUP_ENTER_MS}ms ease-out`, style({ opacity: 1 }))]),
            transition(':leave', [animate(`${CONFIRM_POPUP_EXIT_MS}ms ease-in`, style({ opacity: 0 }))]),
        ]),
    ],
})
export class JoinPageComponent implements OnInit, OnDestroy {
    /** Progress bar segments (one per code digit). */
    readonly codeDigitSlots = [...Array(JOIN_PAGE_ROOM_CODE_LENGTH).keys()];

    roomId = '';
    /** Shown as soon as a non-numeric character is entered (paste, keyboard, IME). */
    digitsOnlyError = false;
    isJoining = false;

    /** Private game code entry modal (opened via button). */
    showPrivateJoinModal = false;

    showConfirmation = false;
    roomData: RoomData | null = null;
    userCurrency = 0;
    availableRooms: PublicRoomInfo[] = [];
    isLoadingPublicRooms = true;
    publicRoomsLoadError = false;

    private readonly loadingMinDelay = createLoadingMinDelayScheduler(inject(DestroyRef));
    private publicRoomsLoadStartedAt = 0;
    private profileSub?: Subscription;

    constructor(
        private playerService: PlayerService,
        private authService: AuthService,
        private alertService: AlertService,
        private socketService: SocketService,
        private http: HttpClient,
        private router: Router,
        private translateService: TranslateService,
    ) {}

    @HostListener('document:keydown.escape')
    onEscapeClosePrivateModal(): void {
        if (!this.showPrivateJoinModal || this.showConfirmation || this.isJoining) {
            return;
        }
        this.closePrivateJoinModal();
    }

    ngOnInit() {
        this.profileSub = this.authService.userProfile$.subscribe((profile) => {
            if (profile) {
                this.userCurrency = profile.virtualCurrency || 0;
                this.availableRooms = this.filterVisibleRooms(this.availableRooms);
            }
        });

        this.loadInitialRooms();
        this.socketService.on<PublicRoomInfo[]>(GameRoomEvents.PublicRoomsUpdate, this.onPublicRoomsUpdate);
    }

    ngOnDestroy() {
        this.profileSub?.unsubscribe();
        this.socketService.off<PublicRoomInfo[]>(GameRoomEvents.PublicRoomsUpdate, this.onPublicRoomsUpdate);
    }

    async joinRoom(room: PublicRoomInfo) {
        this.hidePrivateJoinModal();
        this.roomId = room.roomId.replace(/\D/g, '').slice(0, JOIN_PAGE_ROOM_CODE_LENGTH);
        this.digitsOnlyError = false;
        await this.onSubmit();
    }

    openPrivateJoinModal(): void {
        this.showPrivateJoinModal = true;
        this.digitsOnlyError = false;
        setTimeout(() => document.getElementById('join-private-room-code')?.focus(), 0);
    }

    /** Closes the modal without resetting the code (submission, public card, etc.). */
    hidePrivateJoinModal(): void {
        this.showPrivateJoinModal = false;
    }

    /** User close: resets the field. */
    closePrivateJoinModal(): void {
        if (this.isJoining) {
            return;
        }
        this.hidePrivateJoinModal();
        this.roomId = '';
        this.digitsOnlyError = false;
    }

    onPrivateModalOverlayClick(event: MouseEvent): void {
        if (event.target !== event.currentTarget || this.isJoining) {
            return;
        }
        this.closePrivateJoinModal();
    }

    isValidCode(): boolean {
        return new RegExp(`^\\d{${JOIN_PAGE_ROOM_CODE_LENGTH}}$`).test(this.roomId);
    }

    /**
     * Filters non-digits, max 4. If the raw value contained anything but digits, immediate message.
     */
    onRoomCodeChange(value: string): void {
        const hadInvalid = /[^\d]/.test(value);
        const next = value.replace(/\D/g, '').slice(0, JOIN_PAGE_ROOM_CODE_LENGTH);
        this.digitsOnlyError = hadInvalid;
        this.roomId = next;
    }

    /**
     * Blocks keyboard input of non-digits (the message shows without waiting for 4 characters).
     */
    onRoomCodeKeydown(event: KeyboardEvent): void {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        const navigationKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (navigationKeys.includes(event.key)) {
            return;
        }
        if (event.key === 'Enter') {
            return;
        }
        if (event.key.length === 1 && !/[0-9]/.test(event.key)) {
            event.preventDefault();
            this.digitsOnlyError = true;
        }
    }

    async onSubmit() {
        if (!this.isValidCode() || this.isJoining) {
            return;
        }

        this.isJoining = true;
        let validatedRoomId: string;
        try {
            validatedRoomId = await this.playerService.validateRoomId(this.roomId);
        } catch {
            this.isJoining = false;
            return;
        }
        if (!validatedRoomId) {
            this.isJoining = false;
            return;
        }

        this.http.get<RoomData>(`${environment.serverUrl}/game-room/${validatedRoomId}/data`).subscribe({
            next: (roomData) => {
                this.isJoining = false;
                this.roomData = roomData;

                if (roomData.entryFee === 0) {
                    this.playerService.joinGame(validatedRoomId, false);
                    this.hidePrivateJoinModal();
                } else if (this.userCurrency < roomData.entryFee) {
                    this.hidePrivateJoinModal();
                    void this.router.navigate([Routes.Home]).then(() => {
                        this.alertService.showInfo(
                            'popup.error_title',
                            this.translateService.instant('common.insufficient_currency', { fee: roomData.entryFee, balance: this.userCurrency }),
                        );
                    });
                } else {
                    this.showConfirmation = true;
                    this.hidePrivateJoinModal();
                }
            },
            error: () => {
                this.isJoining = false;
                this.alertService.showInfo('popup.error_title', 'common.room_info_error');
            },
        });
    }

    confirmJoin() {
        if (this.roomData) {
            this.playerService.joinGame(this.roomId, false);
            this.showConfirmation = false;
        }
    }

    cancelJoin() {
        this.showConfirmation = false;
        this.roomData = null;
    }

    retryLoadPublicRooms(): void {
        this.isLoadingPublicRooms = true;
        this.publicRoomsLoadError = false;
        this.loadInitialRooms();
    }

    private filterVisibleRooms(rooms: PublicRoomInfo[]): PublicRoomInfo[] {
        const friendList = this.authService.currentUserProfile?.friendList || [];
        return rooms.filter((room) => !room.isFriendsOnly || (room.hostUid != null && friendList.includes(room.hostUid)));
    }

    private onPublicRoomsUpdate = (rooms: PublicRoomInfo[]) => {
        this.availableRooms = this.filterVisibleRooms(rooms ?? []);
        this.publicRoomsLoadError = false;
        if (this.isLoadingPublicRooms) {
            this.finishPublicRoomsLoading();
        }
    };

    private loadInitialRooms() {
        this.publicRoomsLoadStartedAt = Date.now();
        this.http.get<PublicRoomInfo[]>(`${environment.serverUrl}/game-room/public`).subscribe({
            next: (rooms) => {
                this.availableRooms = this.filterVisibleRooms(rooms ?? []);
                this.publicRoomsLoadError = false;
                this.finishPublicRoomsLoading();
            },
            error: () => {
                this.availableRooms = [];
                this.publicRoomsLoadError = true;
                this.finishPublicRoomsLoading();
            },
        });
    }

    private finishPublicRoomsLoading(): void {
        this.loadingMinDelay.schedule(this.publicRoomsLoadStartedAt, () => {
            this.isLoadingPublicRooms = false;
        });
    }
}
