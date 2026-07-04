import { Component, DestroyRef, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardsComponent } from '@app/components/game-creation-cards/cards.component';
import { PageLoadingComponent } from '@app/components/page-loading/page-loading.component';
import { AdminService } from '@app/services/admin-service/admin-service';
import { createLoadingMinDelayScheduler } from '@app/utils/loading-min-delay';
import { Game } from '@common/types';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-game-creation-page',
    imports: [CardsComponent, PageLoadingComponent, RouterLink, TranslateModule],
    standalone: true,
    templateUrl: './game-creation-page.component.html',
    styleUrl: './game-creation-page.component.scss',
})
export class GameCreationPageComponent implements OnInit {
    @ViewChildren(CardsComponent) cardComponents!: QueryList<CardsComponent>;

    cards: Game[] = [];
    isLoadingGames = true;
    gamesLoadError = false;

    private readonly loadingMinDelay = createLoadingMinDelayScheduler(inject(DestroyRef));
    private gamesLoadStartedAt = 0;

    constructor(private readonly adminService: AdminService) {}

    ngOnInit(): void {
        this.loadGames();
    }

    closeOtherCards(openedCard: CardsComponent): void {
        this.cardComponents.forEach((card) => {
            if (card !== openedCard) {
                card.resetOverlay();
            }
        });
    }

    /**
     * @param silent If true (e.g. after editing a map), no loading screen or full-page error screen.
     */
    loadGames(options?: { silent?: boolean }): void {
        const silent = options?.silent === true;
        if (!silent) {
            this.isLoadingGames = true;
            this.gamesLoadStartedAt = Date.now();
            this.gamesLoadError = false;
        }
        this.adminService.getGamesForCreation().subscribe({
            next: (games: Game[]) => {
                if (silent) {
                    this.cards = games;
                    this.gamesLoadError = false;
                    return;
                }
                this.loadingMinDelay.schedule(this.gamesLoadStartedAt, () => {
                    this.cards = games;
                    this.isLoadingGames = false;
                    this.gamesLoadError = false;
                });
            },
            error: () => {
                if (silent) {
                    this.isLoadingGames = false;
                    return;
                }
                this.loadingMinDelay.schedule(this.gamesLoadStartedAt, () => {
                    this.isLoadingGames = false;
                    this.cards = [];
                    this.gamesLoadError = true;
                });
            },
        });
    }
}
