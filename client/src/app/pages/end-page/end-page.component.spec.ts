import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameChatComponent } from '@app/components/game-chat/game-chat.component';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { PlayerService } from '@app/services/player/player.service';
import { GameStats, Player, PlayerStats } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { EndPageComponent } from './end-page.component';

describe('EndPageComponent', () => {
    let component: EndPageComponent;
    let fixture: ComponentFixture<EndPageComponent>;
    let playerServiceSpy: jasmine.SpyObj<PlayerService>;

    const mockGameStats: GameStats = {
        players: [
            {
                id: '1',
                name: 'Player 1',
                playerStats: {
                    nCombats: 5,
                    nEvasions: 2,
                    nVictories: 3,
                    nDefeats: 2,
                    hpLost: 20,
                    hpDealt: 30,
                    nItemsCollected: 4,
                    tilesVisitedPercentage: 45,
                } as PlayerStats,
            } as Player,
            {
                id: '2',
                name: 'Player 2',
                playerStats: {
                    nCombats: 3,
                    nEvasions: 4,
                    nVictories: 2,
                    nDefeats: 1,
                    hpLost: 15,
                    hpDealt: 25,
                    nItemsCollected: 2,
                    tilesVisitedPercentage: 30,
                } as PlayerStats,
            } as Player,
        ],
        globalStats: {
            duration: 125000,
            totalTurns: 10,
            doorsUsed: [],
            doorsUsedPercent: 50,
            tilesVisited: [],
            tilesVisitedPercentage: 75,
            flagHolders: [],
        },
    };

    beforeEach(async () => {
        playerServiceSpy = jasmine.createSpyObj('PlayerService', ['quitGame']);

        const mockAuthService = jasmine.createSpyObj('AuthService', [], { userProfile$: of(null) });

        await TestBed.configureTestingModule({
            imports: [CommonModule, GameChatComponent, EndPageComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PlayerService, useValue: playerServiceSpy },
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(EndPageComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        localStorage.removeItem('gameStats');
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should initialize with default values when no gameStats in localStorage', () => {
            spyOn(localStorage, 'getItem').and.returnValue(null);
            component.ngOnInit();

            expect(component.globalStats.duration).toBe(0);
            expect(component.globalStats.totalTurns).toBe(0);
            expect(component.globalStats.doorsUsedPercent).toBe(0);

            expect(component.formattedDuration).toBe('0m 00s');
        });

        it('should update stats when gameStats exists in localStorage', () => {
            spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify(mockGameStats));
            component.ngOnInit();

            expect(component.players).toEqual(mockGameStats.players);
            expect(component.globalStats).toEqual(mockGameStats.globalStats);

            expect(component.formattedDuration).toBe('2m 05s');
        });
    });

    describe('ngOnDestroy', () => {
        it('should remove gameStats from localStorage', () => {
            spyOn(localStorage, 'removeItem');
            component.ngOnDestroy();
            expect(localStorage.removeItem).toHaveBeenCalledWith('gameStats');
        });
    });

    describe('isCurrentUser', () => {
        it('should return true when player id matches current player id', () => {
            const currentPlayer: Player = { id: '123', name: 'Current Player' } as Player;
            playerServiceSpy.player = currentPlayer;

            const result = component.isCurrentUser(currentPlayer);
            expect(result).toBeTrue();
        });

        it('should return false when player id does not match current player id', () => {
            const currentPlayer: Player = { id: '123', name: 'Current Player' } as Player;
            const otherPlayer: Player = { id: '456', name: 'Other Player' } as Player;
            playerServiceSpy.player = currentPlayer;

            const result = component.isCurrentUser(otherPlayer);
            expect(result).toBeFalse();
        });
    });

    describe('sortTable', () => {
        beforeEach(() => {
            component.players = [...mockGameStats.players];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (component as any).ascending = false;
        });

        it('should not sort if players array is empty', () => {
            component.players = [];
            const initialPlayers = [...component.players];
            component.sortTable('name');
            expect(component.players).toEqual(initialPlayers);
        });

        it('should sort by name in ascending order first (A-Z)', () => {
            component.sortTable('name');
            expect(component.players[0].name).toBe('Player 1');
            expect(component.players[1].name).toBe('Player 2');
        });

        it('should sort by name in ascending order on second call (Z-A)', () => {
            component.sortTable('name');
            component.sortTable('name');
            expect(component.players[0].name).toBe('Player 2');
            expect(component.players[1].name).toBe('Player 1');
        });

        it('should sort by numeric stats in descending order first (largest first)', () => {
            component.sortTable('nCombats');
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.players[0].playerStats?.nCombats).toBe(5);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.players[1].playerStats?.nCombats).toBe(3);
        });

        it('should sort by numeric stats in ascending order on second call (smallest first)', () => {
            component.sortTable('nCombats');
            component.sortTable('nCombats');
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.players[0].playerStats?.nCombats).toBe(3);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.players[1].playerStats?.nCombats).toBe(5);
        });

        it('should handle undefined names correctly when sorting by name', () => {
            component.players = [{ id: '1', name: undefined, playerStats: {} } as Player, { id: '2', name: 'Player B', playerStats: {} } as Player];

            component.sortTable('name');

            expect(component.players[1].name).toBe('Player B');
            expect(component.players[0].name).toBeUndefined();

            component.players = [{ id: '1', name: 'Player B', playerStats: {} } as Player, { id: '2', name: undefined, playerStats: {} } as Player];

            component.sortTable('name');

            expect(component.players[1].name).toBeUndefined();
            expect(component.players[0].name).toBe('Player B');
        });

        it('should handle undefined playerStats correctly when sorting by a numeric column', () => {
            component.players = [
                { id: '1', name: 'Player A', playerStats: undefined } as Player,
                { id: '2', name: 'Player B', playerStats: { nCombats: 3 } } as Player,
            ];

            component.sortTable('nCombats');

            expect(component.players[0].id).toBe('2');
            expect(component.players[1].id).toBe('1');

            component.players = [
                { id: '1', name: 'Player A', playerStats: { nCombats: 3 } } as Player,
                { id: '2', name: 'Player B', playerStats: undefined } as Player,
            ];

            component.sortTable('nCombats');

            expect(component.players[0].id).toBe('2');
            expect(component.players[1].id).toBe('1');
        });

        it('should handle undefined numeric values in playerStats correctly', () => {
            component.players = [
                { id: '1', name: 'Player A', playerStats: {} } as Player,
                { id: '2', name: 'Player B', playerStats: { nCombats: 3 } } as Player,
            ];

            component.sortTable('nCombats');

            expect(component.players[0].id).toBe('2');
            expect(component.players[1].id).toBe('1');

            component.sortTable('nCombats');

            expect(component.players[0].id).toBe('1');
            expect(component.players[1].id).toBe('2');
        });
    });

    describe('time formatting', () => {
        it('should display 0m 00s for 0ms duration', () => {
            const testStats = {
                ...mockGameStats,
                globalStats: { ...mockGameStats.globalStats, duration: 0 },
            };
            spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify(testStats));
            component.ngOnInit();
            expect(component.formattedDuration).toBe('0m 00s');
        });

        it('should display correct time for partial minute', () => {
            const testStats = {
                ...mockGameStats,
                globalStats: { ...mockGameStats.globalStats, duration: 30500 },
            };
            spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify(testStats));
            component.ngOnInit();
            expect(component.formattedDuration).toBe('0m 30s');
        });

        it('should display correct time for full minutes', () => {
            const testStats = {
                ...mockGameStats,
                globalStats: { ...mockGameStats.globalStats, duration: 180000 },
            };
            spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify(testStats));
            component.ngOnInit();
            expect(component.formattedDuration).toBe('3m 00s');
        });
    });

    describe('default global stats', () => {
        it('should initialize with empty/default values', () => {
            spyOn(localStorage, 'getItem').and.returnValue(null);
            component.ngOnInit();

            expect(component.globalStats.duration).toBe(0);
            expect(component.globalStats.totalTurns).toBe(0);
            expect(component.globalStats.doorsUsed).toEqual([]);
            expect(component.globalStats.flagHolders).toEqual([]);
        });
    });

    describe('stats updating', () => {
        it('should correctly update all stats from localStorage', () => {
            spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify(mockGameStats));
            component.ngOnInit();

            expect(component.players.length).toBe(2);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.globalStats.totalTurns).toBe(10);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(component.globalStats.tilesVisitedPercentage).toBe(75);
        });
    });
});
