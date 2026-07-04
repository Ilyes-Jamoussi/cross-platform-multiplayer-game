import { ScrollStrategyOptions } from '@angular/cdk/overlay';
import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Router, NavigationStart } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { POPUP_HEIGHT, SNACKBAR_TIME } from '@common/constants';
import { RightClickPopupComponent } from '@app/components/right-click-popup/right-click-popup.component';
import { ConfirmPopupComponent, ConfirmPopupData } from '@app/components/confirm-popup/confirm-popup.component';
import { TileTypes } from '@common/enums';
import { getTileInfo } from '@app/constants/tile-info-const';
import { WinnerAnnouncementComponent } from '@app/components/winner-announcement-popup/winner-announcement-popup.component';
import { PopUpData } from '@app/interfaces/popUp.interface';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root',
})
export class AlertService {
    constructor(
        private readonly snackBar: MatSnackBar,
        private readonly popUp: MatDialog,
        private readonly router: Router,
        private readonly translate: TranslateService,
        private readonly scrollStrategies: ScrollStrategyOptions,
    ) {
        this.router.events.pipe(filter((event) => event instanceof NavigationStart)).subscribe(() => {
            this.snackBar.dismiss();
        });
    }

    alert(message: string | unknown): void {
        const raw = typeof message === 'string' ? message : JSON.stringify(message);
        const displayMessage = this.translateServerMessage(raw);
        const closeLabel = this.translate.instant('common.close');

        this.snackBar.open(displayMessage, closeLabel, {
            panelClass: ['error-snackbar'],
            verticalPosition: 'top',
            duration: SNACKBAR_TIME,
        });
    }

    success(message: string): void {
        const displayMessage = this.translateServerMessage(message);
        const closeLabel = this.translate.instant('common.close');

        this.snackBar.open(displayMessage, closeLabel, {
            panelClass: ['success-snackbar'],
            verticalPosition: 'top',
            duration: SNACKBAR_TIME,
        });
    }

    warning(message: string): void {
        const displayMessage = this.translateServerMessage(message);
        const closeLabel = this.translate.instant('common.close');

        this.snackBar.open(displayMessage, closeLabel, {
            panelClass: ['warning-snackbar'],
            verticalPosition: 'top',
            duration: SNACKBAR_TIME,
        });
    }

    info(message: string): void {
        const displayMessage = this.translateServerMessage(message);
        const closeLabel = this.translate.instant('common.close');

        this.snackBar.open(displayMessage, closeLabel, {
            panelClass: ['info-snackbar'],
            verticalPosition: 'top',
            duration: SNACKBAR_TIME,
        });
    }

    notify(message: string): MatSnackBarRef<TextOnlySnackBar> {
        const displayMessage = this.translateServerMessage(message);

        return this.snackBar.open(displayMessage, undefined, {
            panelClass: ['settings-tooltip'],
            verticalPosition: 'top',
            duration: SNACKBAR_TIME,
        });
    }
    closeAll(): void {
        this.popUp.closeAll();
    }

    announceWinner(message: string): void {
        this.popUp.closeAll();
        this.popUp.open(WinnerAnnouncementComponent, {
            data: { message },
            hasBackdrop: false,
            disableClose: false,
            scrollStrategy: this.scrollStrategies.noop(),
        });
    }
    tileInfo(message: PopUpData, event: MouseEvent) {
        if (Object.values(TileTypes).includes(message.tile as TileTypes)) {
            const tileInfo = getTileInfo(this.translate);
            message.tileInfo = tileInfo[message.tile as TileTypes];
        }
        const screenHeight = window.innerHeight;
        let topPosition = event.clientY;
        const estimatedPopupHeight = POPUP_HEIGHT;
        if (topPosition + estimatedPopupHeight > screenHeight) {
            topPosition = screenHeight - estimatedPopupHeight;
        }
        this.popUp.closeAll();
        this.popUp.open(RightClickPopupComponent, {
            hasBackdrop: false,
            data: message,
            position: { top: `${topPosition}px`, left: `${event.clientX}px` },
            scrollStrategy: this.scrollStrategies.noop(),
        });
    }

    async confirm(
        title: string,
        message: string,
        confirmLabel?: string,
        cancelLabel?: string,
        messageParams?: Record<string, string | number>,
        titleParams?: Record<string, string | number>,
    ): Promise<boolean> {
        const dialogRef = this.popUp.open(ConfirmPopupComponent, {
            ...this.confirmPopupShellConfig(),
            data: { type: 'confirm', title, message, confirmLabel, cancelLabel, messageParams, titleParams } as ConfirmPopupData,
            disableClose: true,
        });
        const result = await firstValueFrom(dialogRef.afterClosed());
        return !!result;
    }

    showSuccess(title: string, message: string): void {
        this.popUp.open(ConfirmPopupComponent, {
            ...this.confirmPopupShellConfig(),
            data: { type: 'success', title, message } as ConfirmPopupData,
            disableClose: false,
        });
    }

    showInfo(title: string, message: string): void {
        this.popUp.open(ConfirmPopupComponent, {
            ...this.confirmPopupShellConfig(),
            data: { type: 'info', title, message } as ConfirmPopupData,
            disableClose: false,
        });
    }

    /** Avoids the `body` padding (scrollbar) from MatDialog's scroll blocking → horizontal jump on close. */
    private confirmPopupShellConfig(): Pick<
        MatDialogConfig,
        'backdropClass' | 'panelClass' | 'scrollStrategy' | 'enterAnimationDuration' | 'exitAnimationDuration'
    > {
        return {
            backdropClass: 'confirm-popup-backdrop',
            panelClass: 'confirm-popup-panel',
            scrollStrategy: this.scrollStrategies.noop(),
            /* 0 = no MDC animation (avoids scale + border flash on the surface). */
            enterAnimationDuration: 0,
            exitAnimationDuration: 0,
        };
    }

    private translateServerMessage(message: string): string {
        // Handle parameterized messages: "key|{...params}"
        const pipeIndex = message.indexOf('|');
        if (pipeIndex !== -1) {
            const key = message.substring(0, pipeIndex);
            try {
                const params = JSON.parse(message.substring(pipeIndex + 1));
                const withParams = this.translate.instant(key, params);
                if (withParams !== key) return withParams;
            } catch {
                const keyOnly = this.translate.instant(key);
                if (keyOnly !== key) return keyOnly;
            }
        }
        // Try translating as an i18n key
        const translated = this.translate.instant(message);
        return translated !== message ? translated : message;
    }
}
