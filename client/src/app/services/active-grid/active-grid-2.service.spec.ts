import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ActiveGridService } from './active-grid.service';
import { environment } from 'src/environments/environment';
import { GameData, Grid, Player } from '@common/interfaces';
import { GAME_DATA, MOCK_PLAYERS } from '@common/constants.spec';
import { MockService } from 'ng-mocks';
import { AlertService } from '@app/services/alert/alert.service';
import { of, throwError } from 'rxjs';
import { Position } from '@common/types';
import { PlayerMovementService } from '@app/services/player-mouvement/player-movement.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';

describe('ActiveGridService', () => {
    let service: ActiveGridService;
    let httpTestingController: HttpTestingController;
    let router: Router;
    let httpClient: HttpClient;
    let playerMovementService: PlayerMovementService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ActiveGridService,
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: PlayerMovementService,
                    useValue: MockService(PlayerMovementService),
                },
                {
                    provide: AlertService,
                    useValue: MockService(AlertService),
                },
                {
                    provide: GameModeService,
                    useValue: MockService(GameModeService),
                },
                {
                    provide: Router,
                    useValue: {
                        navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
                        events: of(),
                        getCurrentNavigation: jasmine.createSpy('getCurrentNavigation').and.returnValue({
                            finalUrl: {
                                toString: () => '/loading/test-room-id',
                            },
                        }),
                    },
                },
            ],
        });

        service = TestBed.inject(ActiveGridService);
        httpTestingController = TestBed.inject(HttpTestingController);
        router = TestBed.inject(Router);
        httpClient = TestBed.inject(HttpClient);
        playerMovementService = TestBed.inject(PlayerMovementService);
    });

    afterEach(() => {
        httpTestingController.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should handle error when loading grid data fails', () => {
        const mockRoomId = 'test-room-id';
        const mockError = { error: { error: 'Failed to load grid' } };
        spyOn(httpClient, 'post').and.returnValue(throwError(() => mockError));

        service.loadGrid(mockRoomId);
        expect(httpClient.post).toHaveBeenCalledWith(`${environment.serverUrl}/game/start`, { roomId: mockRoomId });
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should navigate to home when roomId is empty', () => {
        const mockRoomId = '';

        service.loadGrid(mockRoomId);
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should handle unknown error when loading grid data', () => {
        const mockRoomId = 'test-room-id';
        const mockError = { error: 'An unknown error occurred' };
        spyOn(httpClient, 'post').and.returnValue(throwError(() => mockError));

        service.loadGrid(mockRoomId);
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
    it('should handle network error when loading grid data', () => {
        const mockRoomId = 'test-room-id';
        spyOn(httpClient, 'post').and.returnValue(throwError(() => new ErrorEvent('Network error')));

        service.loadGrid(mockRoomId);
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
    function loadGrid(mockGridData: GameData, mockRoomId = 'test-room-id') {
        spyOn(httpClient, 'post').and.returnValue(of(mockGridData));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setUpSpy = spyOn(service as any, 'setUpMovementListeners');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setLogicSpy = spyOn(service as any, 'setLogicListeners');
        service.loadGrid(mockRoomId);
        expect(setUpSpy).toHaveBeenCalled();
        expect(setLogicSpy).toHaveBeenCalled();
    }
    it('should set up movement and logic listeners on successful grid load', () => {
        const mockGridData = { ...GAME_DATA } as unknown as GameData;
        loadGrid(mockGridData);
    });
    it('should set up movement and logic listeners on successful grid load for CTF', () => {
        const mockGridData = { ...GAME_DATA } as unknown as GameData;
        mockGridData.teams = [];
        loadGrid(mockGridData);
    });

    it('should return immediately if ActiveClick.grid is undefined', () => {
        const mockClickEvent = {
            grid: undefined as unknown as Grid,
            position: { x: 0, y: 0 },
            event: { button: 0 } as MouseEvent,
        };

        const result = service.handleClick(mockClickEvent);
        expect(result).toBeUndefined();
    });
    it('should return early if _selectedPlayer is undefined or moving is true', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (playerMovementService as any)._highlightedPath = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._selectedPlayer = undefined;
        service.handleHovered({ x: 0, y: 0 } as Position);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._selectedPlayer = { id: 'player1' } as Player;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._isMoving = true;
        service.handleHovered({ x: 0, y: 0 } as Position);
        expect(playerMovementService.highlightedPath).toBeUndefined();
    });

    it('should return early if highlightedPath is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (playerMovementService as any)._highlightedPath = undefined;
        service.handleUnhovered();
        expect(playerMovementService.highlightedPath).toBeUndefined();
    });

    it('should return early if highlightedPath.positions is empty', () => {
        playerMovementService.highlightedPath = { positions: [], cost: 0, turns: 0 };
        service.handleUnhovered();
        expect(playerMovementService.highlightedPath).toEqual({ positions: [], cost: 0, turns: 0 });
    });

    it('should return false if grid is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._gridSubject.next(undefined);
        const result = service.isOpposingPlayer({ x: 0, y: 0 });
        expect(result).toBeFalse();
    });

    it('should return false if grid is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._gridSubject.next(undefined);
        const result = service.isOpposingPlayer({ x: 0, y: 0 });
        expect(result).toBeFalse();
    });

    it('should return early if grid is undefined for move player', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._selectedPlayer = MOCK_PLAYERS[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)._selectedPosition = { x: 0, y: 0 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (playerMovementService as any)._reachableTiles = [];
        service.moveSelectedPlayer({ positions: [], cost: 0, turns: 0 });
        expect(playerMovementService.reachableTiles).toBeUndefined();
    });
});
