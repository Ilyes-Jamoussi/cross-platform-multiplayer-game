import { animate, AnimationEvent, style, transition, trigger } from '@angular/animations';
import { Component, HostBinding, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CONFIRM_POPUP_CLOSE_FALLBACK_BUFFER_MS, CONFIRM_POPUP_ENTER_MS, CONFIRM_POPUP_EXIT_MS } from '@app/constants/ui-animations.constants';
import { TranslateModule } from '@ngx-translate/core';

export type PopupType = 'confirm' | 'success' | 'info';

export interface ConfirmPopupData {
    type: PopupType;
    title: string;
    message: string;
    /** Optional ngx-translate interpolation params for `message` (and `title` if `titleParams` is set). */
    messageParams?: Record<string, string | number>;
    titleParams?: Record<string, string | number>;
    confirmLabel?: string;
    cancelLabel?: string;
}

@Component({
    selector: 'app-confirm-popup',
    standalone: true,
    imports: [TranslateModule],
    templateUrl: './confirm-popup.component.html',
    styleUrl: './confirm-popup.component.scss',
    animations: [
        trigger('popupShell', [
            transition(':enter', [style({ opacity: 0 }), animate(`${CONFIRM_POPUP_ENTER_MS}ms ease-out`, style({ opacity: 1 }))]),
            transition(':leave', [animate(`${CONFIRM_POPUP_EXIT_MS}ms ease-in`, style({ opacity: 0 }))]),
        ]),
    ],
})
export class ConfirmPopupComponent implements OnInit, OnDestroy {
    @HostBinding('style.--popup-enter-duration')
    readonly popupEnterDurationCss = `${CONFIRM_POPUP_ENTER_MS}ms`;

    /** Display deferred by one tick to force a clean :enter transition after MatDialog opens. */
    showPopupContent = false;

    private pendingDialogResult: boolean | undefined;
    private closeFallbackTimer?: ReturnType<typeof setTimeout>;

    constructor(
        public dialogRef: MatDialogRef<ConfirmPopupComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmPopupData,
    ) {}

    get icon(): string {
        switch (this.data.type) {
            case 'confirm':
                return '?';
            case 'success':
                return '✓';
            case 'info':
                return 'i';
            default:
                return '';
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (!this.showPopupContent) return;
        if (this.data.type === 'success' || this.data.type === 'info') {
            const target = event.target as HTMLElement;
            if (!target.closest('.popup-container')) {
                this.closeWithAnimation(false);
            }
        }
    }

    ngOnInit(): void {
        setTimeout(() => {
            this.showPopupContent = true;
        });
    }

    ngOnDestroy(): void {
        if (this.closeFallbackTimer !== undefined) {
            clearTimeout(this.closeFallbackTimer);
        }
    }

    onPopupShellDone(event: AnimationEvent): void {
        if (event.phaseName !== 'done' || event.toState !== 'void') {
            return;
        }
        this.flushPendingClose();
    }

    onConfirm(): void {
        this.closeWithAnimation(true);
    }

    onCancel(): void {
        this.closeWithAnimation(false);
    }

    private closeWithAnimation(result: boolean): void {
        if (this.pendingDialogResult !== undefined) {
            return;
        }
        this.pendingDialogResult = result;
        this.showPopupContent = false;
        if (this.closeFallbackTimer !== undefined) {
            clearTimeout(this.closeFallbackTimer);
        }
        this.closeFallbackTimer = setTimeout(() => {
            this.closeFallbackTimer = undefined;
            this.flushPendingClose();
        }, CONFIRM_POPUP_EXIT_MS + CONFIRM_POPUP_CLOSE_FALLBACK_BUFFER_MS);
    }

    private flushPendingClose(): void {
        if (this.pendingDialogResult === undefined) {
            return;
        }
        if (this.closeFallbackTimer !== undefined) {
            clearTimeout(this.closeFallbackTimer);
            this.closeFallbackTimer = undefined;
        }
        const result = this.pendingDialogResult;
        this.pendingDialogResult = undefined;
        this.dialogRef.close(result);
    }
}
