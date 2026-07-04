import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Player } from '@common/interfaces';
import { AVATARS } from '@common/avatar';
import { PopUpData } from '@app/interfaces/popUp.interface';
import { ITEM_DESCRIPTIONS } from '@common/constants';
import { ItemId } from '@common/enums';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-right-click-popup',
    templateUrl: './right-click-popup.component.html',
    styleUrls: ['./right-click-popup.component.scss'],
    standalone: true,
    imports: [TranslateModule],
})
export class RightClickPopupComponent implements OnInit {
    playerImage: string | undefined = undefined;
    displayText: string | undefined = undefined;

    constructor(
        private readonly dialogRef: MatDialogRef<RightClickPopupComponent>,
        private readonly translate: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: PopUpData,
    ) {}

    ngOnInit(): void {
        const itemName = this.data.item?.name;
        const tileInfo = this.data.tileInfo ? `${this.data.tileInfo}\n` : '';
        const baseItemId = itemName ? Object.values(ItemId).find((id) => itemName.includes(id)) : undefined;
        const descriptionKey = baseItemId ? ITEM_DESCRIPTIONS.get(baseItemId) : undefined;
        const itemDescription =
            descriptionKey && baseItemId !== ItemId.ItemStartingPoint
                ? `${this.translate.instant('right_click.item')} : ${this.translate.instant(descriptionKey)}\n`
                : '';

        if (this.isPlayerData(this.data)) {
            const player = this.data.player as Player;
            this.playerImage = this.getPlayerImage(player);
            const playerName = `${this.translate.instant('right_click.player')} : ${player.name}\n`;
            this.displayText = playerName + tileInfo + itemDescription;
        } else {
            this.displayText = tileInfo + itemDescription;
        }
    }

    isPlayerData(data: PopUpData) {
        return data.player?.avatar !== undefined;
    }

    getPlayerImage(player: Player): string {
        return player.avatar ? AVATARS.find((avatar) => avatar.name === player.avatar)?.icon ?? AVATARS[0].icon : AVATARS[0].icon;
    }

    onClose(): void {
        this.dialogRef.close();
    }

    onBackdropClick(): void {
        this.dialogRef.close();
    }
}
