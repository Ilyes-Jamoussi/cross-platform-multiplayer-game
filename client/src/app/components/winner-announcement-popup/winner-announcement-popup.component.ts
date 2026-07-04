import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { POPUP_LENGTH } from '@common/constants';

@Component({
    selector: 'app-winner-announcement',
    templateUrl: './winner-announcement-popup.component.html',
    standalone: true,
})
export class WinnerAnnouncementComponent implements OnInit {
    constructor(
        public dialogRef: MatDialogRef<WinnerAnnouncementComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { message: string },
    ) {}

    ngOnInit(): void {
        setTimeout(() => this.close(), POPUP_LENGTH);
    }

    close(): void {
        this.dialogRef.close();
    }
}
