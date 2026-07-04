import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { ActiveGridComponent } from '@app/components/active-grid/active-grid.component';
import { GameInfoComponent } from '@app/components/game-info/game-info.component';
import { InventoryPopUpComponent } from '@app/components/inventory-popup/inventory-popup.component';
import { InventoryTradePopupComponent } from '@app/components/inventory-trade-popup/inventory-trade-popup.component';
import { LogChatComponent } from '@app/components/log-chat/log-chat.component';
import { PlayerListComponent } from '@app/components/player-list/player-list.component';
import { PlayerPanelComponent } from '@app/components/player-panel/player-panel.component';
import { TimerComponent } from '@app/components/timer/timer.component';
import { CombatSpectatorCardComponent } from '@app/components/combat-spectator-card/combat-spectator-card.component';
import { VsPopUpComponent } from '@app/components/vs-pop-up/vs-pop-up.component';
import { ActionService } from '@app/services/action/action.service';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { AlertService } from '@app/services/alert/alert.service';
import { CombatService } from '@app/services/combat/combat.service';
import { DebugService } from '@app/services/debug-service/debug-service.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { GameOverService } from '@app/services/game-over/game-over-service';
import { ItemService } from '@app/services/item/item.service';
import { LogService } from '@app/services/logs/log.service';
import { PlayerMovementService } from '@app/services/player-mouvement/player-movement.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TimeService } from '@app/services/time/time.service';
import { TurnService } from '@app/services/turn/turn-service';
import { POPUP_LENGTH } from '@common/constants';
import { Actions, LobbyGameMode, PlayerState } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { Position } from '@common/types';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { combineLatest, Subscription } from 'rxjs';

@Component({
    selector: 'app-active-game-page',
    templateUrl: './active-game-page.component.html',
    styleUrls: ['./active-game-page.component.scss'],
    imports: [
        ActiveGridComponent,
        LogChatComponent,
        TimerComponent,
        PlayerPanelComponent,
        PlayerListComponent,
        VsPopUpComponent,
        CombatSpectatorCardComponent,
        GameInfoComponent,
        InventoryPopUpComponent,
        InventoryTradePopupComponent,
        MatTooltip,
        TranslateModule,
    ],
    providers: [
        ActionService,
        CombatService,
        TimeService,
        TurnService,
        ActiveGridService,
        GameOverService,
        DebugService,
        PlayerMovementService,
        LogService,
        ItemService,
    ],

    standalone: true,
})
export class ActiveGamePageComponent implements OnInit, OnDestroy {
    @ViewChild('vsPopup') vsPopUpComponent!: VsPopUpComponent;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    LobbyGameMode = LobbyGameMode;
    private _isMyTurn: boolean = false;
    private _isTurnPopupVisible: boolean = false;
    private _isCombatStarted: boolean = false;
    private _startCombatSubscription: Subscription;
    private _endCombatSubscription: Subscription;
    private _turnSubscription: Subscription;
    private _gameOverSubscription: Subscription;
    private _combatActionSubscription: Subscription;
    private _isGameStart: boolean = true;
    private _gameStartTimeout: ReturnType<typeof setTimeout> | undefined;

    // eslint-disable-next-line max-params
    constructor(
        readonly gameModeService: GameModeService,
        private readonly actionService: ActionService,
        private readonly combatService: CombatService,
        private readonly alertService: AlertService,
        private readonly turnService: TurnService,
        private readonly gameOverService: GameOverService,
        private readonly playerService: PlayerService,
        private readonly activeGridService: ActiveGridService,
        private readonly translate: TranslateService,
        private readonly socketService: SocketService,
    ) {}

    get isTurnPopupVisible() {
        return this._isTurnPopupVisible;
    }

    get isMyTurn() {
        return this._isMyTurn && !this.combatService.isWaitingForCombatEnd && !this.combatService.isInCombat;
    }

    get isSpectator() {
        return this.isObserver();
    }

    get isMoving() {
        return this.activeGridService.isMoving;
    }

    get isCombatStarted() {
        return this._isCombatStarted;
    }

    get isActionClicked() {
        return this.actionService.isActionClicked;
    }

    /** i18n tooltip: avoids concatenating a bogus "… | translate" string in the template. */
    get actionButtonTooltip(): string {
        const defaultTxt = this.translate.instant('game_page.tile_tooltip.default');
        if (!this.actionService.isActionClicked) {
            return defaultTxt;
        }
        const reclick = this.translate.instant('game_page.tile_tooltip.reclick');
        return `${defaultTxt}\n━━━━━━━━━━━━━━\n\n${reclick}`;
    }

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
    }

    isGameStart() {
        return this._isGameStart;
    }

    isCTF() {
        return this.activeGridService.isCTF();
    }

    isFogOfWar() {
        return this.gameModeService.isFogOfWar;
    }

    isDropInDropOut() {
        return this.gameModeService.isDropInDropOut;
    }

    isAction() {
        if (this.isObserver()) {
            return;
        }
        this.actionService.isActionClicked = !this.actionService.isActionClicked;
        if (this.actionService.isActionClicked) {
            this.activeGridService.deselectPlayer();
        } else {
            this.activeGridService.findAndSelectPlayer();
        }
    }

    hasActionLeft() {
        return this.actionService.hasActionLeft;
    }

    getAdjacentPlayerOrDoor() {
        return this.actionService.getAdjacentPlayerOrDoor();
    }
    ngOnInit() {
        this._gameStartTimeout = setTimeout(() => {
            this._isGameStart = false;
        }, POPUP_LENGTH);
        this._turnSubscription = combineLatest([this.turnService.getCurrentTurn(), this.turnService.blockPlaying]).subscribe(
            ([player, blockPlaying]) => {
                if (player) {
                    this._isGameStart = false;
                }
                this._isMyTurn = this.turnService.isMyTurn();
                if (this._isMyTurn && !blockPlaying && !this.isObserver()) {
                    this.actionService.isActionClicked = false;
                    this.resetSpeed(this.turnService.playerLastPosition);
                    this.showTurnPopup();
                }
            },
        );
        this._gameOverSubscription = combineLatest([this.gameOverService.getGameOverStatus(), this.gameOverService.getWinner()]).subscribe(
            ([isGameOver, winner]) => {
                const grid = this.activeGridService.gridSubject.getValue();
                if (!grid) return;
                this.gameOverService.handleGameOver(isGameOver, winner, this.turnService.getPlayer());
            },
        );
        this._combatActionSubscription = this.actionService.hasActionLeftSubject.subscribe((actionsLeft) => {
            if (actionsLeft === 0 && this._isMyTurn) {
                this.activeGridService.findAndSelectPlayer();
            }
        });
        this.gameOverService.init();
        this.listenerStartCombat();
        this.listenerEndCombat();

        // Signal to server that this client is ready to play.
        const roomId = this.playerService.roomId;
        if (roomId) {
            this.socketService.sendMessage(ActiveGameEvents.PlayerReady, { roomId });
        }
    }

    ngOnDestroy() {
        if (this._gameStartTimeout) {
            clearTimeout(this._gameStartTimeout);
        }
        if (this._turnSubscription) {
            this._turnSubscription.unsubscribe();
        }
        if (this._gameOverSubscription) {
            this._gameOverSubscription.unsubscribe();
        }
        if (this._startCombatSubscription) {
            this._startCombatSubscription.unsubscribe();
        }
        if (this._endCombatSubscription) {
            this._endCombatSubscription.unsubscribe();
        }
        if (this._combatActionSubscription) {
            this._combatActionSubscription.unsubscribe();
        }
        this.turnService.ngOnDestroy();
        this.gameOverService.cleanup();
    }

    listenerStartCombat() {
        this._startCombatSubscription = this.actionService.onCombatStart.subscribe(() => {
            this._isCombatStarted = true;
            this.alertService.closeAll();
            this.activeGridService.deselectPlayer();
            this.vsPopUpComponent.initiateFight();
        });
    }

    listenerEndCombat() {
        this._endCombatSubscription = this.actionService.onCombatEnded.subscribe(() => {
            this.vsPopUpComponent.endFight();
            this._isCombatStarted = false;
            /* if (this.isSpectator) {
                this.activeGridService.findAndSelectPlayer(); // Pour désélectionner le joueur éliminé
            }*/
        });
    }

    escapeAction() {
        if (this.isObserver()) {
            return;
        }
        this.actionService.sendCombatAction(this.playerService.roomId, this.playerService.player, Actions.Escape);
    }

    attackAction() {
        if (this.isObserver()) {
            return;
        }
        this.actionService.sendCombatAction(this.playerService.roomId, this.playerService.player, Actions.Attack);
    }

    async quitGame() {
        const confirmed = await this.alertService.confirm('popup.abandon_game_title', 'popup.abandon_game_message');
        if (!confirmed) return;
        this.playerService.quitGame();
    }

    nextTurn() {
        if (this.isObserver()) {
            return;
        }
        this.actionService.resetActions();
        this.turnService.nextTurn();
    }

    private showTurnPopup() {
        this._isTurnPopupVisible = true;
        setTimeout(() => {
            this._isTurnPopupVisible = false;
        }, POPUP_LENGTH);
    }

    private resetSpeed(position: Position | undefined) {
        if (!position) {
            return;
        }
        const grid = this.activeGridService.gridSubject.getValue();
        const cell = grid?.board[position.x]?.[position.y];
        const player = cell?.player;

        if (cell && player?.stats?.maxSpeed) {
            player.stats.speed = player.stats.maxSpeed;
            cell.player = player;
        }
    }

    private isObserver(): boolean {
        const player = this.playerService.player;
        return player?.state === PlayerState.ELIMINATED || !!player?.isSpectator;
    }
}
