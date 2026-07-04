import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '@app/services/admin-service/admin-service';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { GameModes, GameSizes, Players } from '@common/enums';
import { HttpMessage } from '@common/http-message';
import { Game } from '@common/types';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-cards',
    imports: [MatTooltipModule, CommonModule, FormsModule, TranslateModule, CoinIconComponent],
    standalone: true,
    templateUrl: './cards.component.html',
    styleUrl: './cards.component.scss',
})
export class CardsComponent implements OnInit, OnDestroy {
    @Input() gameData!: Game;
    @Output() gameUpdated = new EventEmitter<void>();
    @Output() overlayOpened = new EventEmitter<void>();

    playersIcon: string = 'assets/players.png';
    cardBackGround: string = 'assets/creation_cards_back_ground.png';
    showEntryFeeInput: boolean = false;
    entryFee: number = 0;
    userCurrency: number = 0;
    private _gameModeImage: string;
    private _maxPlayers: number;
    private readonly destroy$ = new Subject<void>();

    constructor(
        private readonly adminService: AdminService,
        private readonly playerService: PlayerService,
        private readonly alertService: AlertService,
        private readonly gameModeService: GameModeService,
        private readonly authService: AuthService,
    ) {}

    get isEntryFeeValid(): boolean {
        return this.entryFee >= 0 && this.entryFee <= this.userCurrency;
    }

    get maxPlayers(): number {
        return this._maxPlayers;
    }
    get gameModeImage(): string {
        return this._gameModeImage;
    }
    set maxPlayers(value: number) {
        this._maxPlayers = value;
    }

    ngOnInit(): void {
        this._gameModeImage = this.getGameModeImage(this.gameData.gameMode);
        this.maxPlayers = this.getMaxPlayers(this.gameData.gridSize);

        this.authService.userProfile$.pipe(takeUntil(this.destroy$)).subscribe((profile) => {
            if (profile) {
                this.userCurrency = profile.virtualCurrency || 0;
            }
        });
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    getGameModeImage(gameMode: string): string {
        switch (gameMode) {
            case GameModes.CTF:
                return 'assets/ctf.png';
            case GameModes.Classic:
                return 'assets/classic.png';
            default:
                return 'assets/classic.png';
        }
    }

    getMaxPlayers(size: number): number {
        switch (size) {
            case GameSizes.Small:
                return Players.SmallMap;
            case GameSizes.Medium:
                return Players.MediumMap;
            case GameSizes.Big:
                return Players.BigMap;
            default:
                return Players.SmallMap;
        }
    }

    onCardClick(): void {
        this.adminService
            .getGameById(this.gameData._id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.showEntryFeeInput = true;
                    this.overlayOpened.emit();
                },
                error: (err) => {
                    if (err.status === HttpMessage.NotFound) {
                        this.alertService.showInfo('popup.error_title', 'common.game_no_longer_exists');
                        this.gameUpdated.emit();
                    } else {
                        this.alertService.showInfo('popup.error_title', err);
                    }
                },
            });
    }

    confirmCreateGame(): void {
        this.playerService.createGame(this.gameData._id, this.entryFee);
        this.gameModeService.gameMode = this.gameData.gameMode as GameModes;
        this.showEntryFeeInput = false;
    }

    resetOverlay(): void {
        this.showEntryFeeInput = false;
        this.entryFee = 0;
    }
}
