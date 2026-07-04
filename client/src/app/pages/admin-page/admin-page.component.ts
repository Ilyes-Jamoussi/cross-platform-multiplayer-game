import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { PageLoadingComponent } from '@app/components/page-loading/page-loading.component';
import { Routes } from '@app/enums/routes-enums';
import { AdminService } from '@app/services/admin-service/admin-service';
import { AlertService } from '@app/services/alert/alert.service';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { createLoadingMinDelayScheduler } from '@app/utils/loading-min-delay';
import { GameModes } from '@common/enums';
import { Game } from '@common/types';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    standalone: true,
    imports: [CommonModule, RouterLink, GameCardComponent, PageLoadingComponent, TranslateModule],
})
export class AdminPageComponent implements OnInit {
    readonly gameModes = GameModes;

    currentUserUid: string = '';
    activeTab: GameModes = GameModes.Classic;
    isLoadingGames = true;

    private readonly loadingMinDelay = createLoadingMinDelayScheduler(inject(DestroyRef));
    private games: Game[] = [];
    private gamesLoadStartedAt = 0;
    constructor(
        private readonly adminService: AdminService,
        private readonly alertService: AlertService,
        private readonly authService: AuthService,
        private readonly router: Router,
    ) {}

    filteredGames(mode: string): Game[] {
        return this.games.filter((game) => game.gameMode === mode);
    }

    formatGame(game: Game): Game {
        return {
            ...game,
            lastModified: this.adminService.fixHour(game.lastModified),
        };
    }

    ngOnInit(): void {
        this.currentUserUid = this.authService.getFirebaseUid() || '';
        this.fetchGames();
        sessionStorage.clear();
    }

    fetchGames(options?: { silent?: boolean }): void {
        const silent = options?.silent === true;
        if (!silent) {
            this.isLoadingGames = true;
            this.gamesLoadStartedAt = Date.now();
        }
        this.adminService.getGamesForManagement().subscribe({
            next: (data) => {
                if (silent) {
                    this.games = data;
                    return;
                }
                this.loadingMinDelay.schedule(this.gamesLoadStartedAt, () => {
                    this.games = data;
                    this.isLoadingGames = false;
                });
            },
            error: () => {
                if (silent) {
                    this.games = [];
                    return;
                }
                this.loadingMinDelay.schedule(this.gamesLoadStartedAt, () => {
                    this.games = [];
                    this.isLoadingGames = false;
                });
            },
        });
    }

    isOwner(game: Game): boolean {
        return game.owner === this.currentUserUid;
    }

    canEdit(game: Game): boolean {
        return this.isOwner(game) || game.state === 'public';
    }

    canDelete(game: Game): boolean {
        return this.isOwner(game) || game.state === 'public';
    }

    canDuplicate(game: Game): boolean {
        return game.state === 'public';
    }

    onEditGame(id: string): void {
        const gameToEdit = this.games.find((game) => game._id === id);
        if (gameToEdit) {
            this.adminService.getGameById(id).subscribe({
                next: () => {
                    sessionStorage.setItem('gameToEdit', JSON.stringify(gameToEdit));
                    void this.router.navigate([Routes.MapEditor]);
                },
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                error: () => {},
            });
        }
    }

    onStateChange(id: string, newState: string): void {
        const game = this.games.find((item) => item._id === id);
        if (game) {
            const previousState = game.state;
            game.state = newState;
            this.adminService.updateGameState(id, newState).subscribe({
                error: () => {
                    game.state = previousState;
                },
            });
        }
    }

    onDuplicateGame(id: string): void {
        this.adminService.duplicateGame(id).subscribe({
            next: () => {
                this.fetchGames({ silent: true });
                this.alertService.showSuccess('popup.game_duplicated_title', 'popup.game_duplicated_message');
            },
            error: (err) => {
                if (err instanceof HttpErrorResponse && this.isDuplicateNameConflict(err)) {
                    this.alertService.showInfo('popup.game_already_duplicated_title', 'popup.game_already_duplicated_message');
                }
            },
        });
    }

    async onDeleteGame(id: string): Promise<void> {
        const confirmed = await this.alertService.confirm('popup.delete_game_title', 'popup.delete_game_message');
        if (!confirmed) return;

        const gameToDeleteIndex = this.games.findIndex((game) => game._id === id);
        if (gameToDeleteIndex !== -1) {
            const [removed] = this.games.splice(gameToDeleteIndex, 1);
            this.adminService.deleteGame(removed._id).subscribe({
                error: () => {
                    this.fetchGames({ silent: true });
                },
            });
        }
    }

    /** Server responds 400 when the "*_copie" name already exists (Mongo duplicate key). */
    private isDuplicateNameConflict(err: HttpErrorResponse): boolean {
        const text = this.httpErrorBodyText(err);
        return text.includes('server_msg.duplicate_name');
    }

    private httpErrorBodyText(err: HttpErrorResponse): string {
        const body = err.error;
        if (typeof body === 'string') {
            return body;
        }
        if (body && typeof body === 'object' && 'message' in body) {
            const msg = (body as { message: unknown }).message;
            if (typeof msg === 'string') {
                return msg;
            }
            if (Array.isArray(msg)) {
                return msg.map(String).join(' ');
            }
        }
        return '';
    }
}
