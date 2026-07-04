import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Game } from '@common/types';
import { HttpMessage } from '@common/http-message';
import { of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AdminService } from './admin-service';

describe('AdminService', () => {
    let service: AdminService;
    let httpClientSpy: jasmine.SpyObj<HttpClient>;

    const apiUrl = environment.serverUrl + '/game/';

    const mockGames: Game[] = [
        {
            _id: '1',
            name: 'Game 1',
            gameMode: 'Classic',
            gridSize: 10,
            nbActions: 1,
            state: 'public',
            owner: 'uid-1',
            ownerName: 'user1',
            imagePayload: '',
            description: '',
            lastModified: '',
        },
        {
            _id: '2',
            name: 'Game 2',
            gameMode: 'CTF',
            gridSize: 15,
            nbActions: 1,
            state: 'private',
            owner: 'uid-2',
            ownerName: 'user2',
            imagePayload: '',
            description: '',
            lastModified: '',
        },
        {
            _id: '3',
            name: 'Game 3',
            gameMode: 'Classic',
            gridSize: 20,
            nbActions: 1,
            state: 'private-shared',
            owner: 'uid-3',
            ownerName: 'user3',
            imagePayload: '',
            description: '',
            lastModified: '',
        },
    ];

    beforeEach(() => {
        httpClientSpy = jasmine.createSpyObj('HttpClient', ['get', 'patch', 'delete']);

        TestBed.configureTestingModule({
            providers: [AdminService, { provide: HttpClient, useValue: httpClientSpy }],
        });

        service = TestBed.inject(AdminService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getGamesForManagement', () => {
        it('should retrieve games for management context', () => {
            httpClientSpy.get.and.returnValue(of(mockGames));
            service.getGamesForManagement().subscribe((games) => {
                expect(games).toEqual(mockGames);
            });
            expect(httpClientSpy.get).toHaveBeenCalledWith(`${apiUrl}?context=management`);
        });

        it('should handle errors', () => {
            httpClientSpy.get.and.returnValue(throwError(() => ({ status: HttpMessage.InternalServerError })));
            service.getGamesForManagement().subscribe({
                next: () => fail('Expected an error, but got a success response'),
                error: (error) => expect(error.status).toBe(HttpMessage.InternalServerError),
            });
        });
    });

    describe('getGamesForCreation', () => {
        it('should retrieve games for creation context', () => {
            httpClientSpy.get.and.returnValue(of(mockGames));
            service.getGamesForCreation().subscribe((games) => {
                expect(games).toEqual(mockGames);
            });
            expect(httpClientSpy.get).toHaveBeenCalledWith(`${apiUrl}?context=creation`);
        });

        it('should handle errors', () => {
            httpClientSpy.get.and.returnValue(throwError(() => ({ status: HttpMessage.InternalServerError })));
            service.getGamesForCreation().subscribe({
                next: () => fail('Expected an error, but got a success response'),
                error: (error) => expect(error.status).toBe(HttpMessage.InternalServerError),
            });
        });
    });

    describe('getGameById', () => {
        it('should retrieve a single game', () => {
            httpClientSpy.get.and.returnValue(of(mockGames[0]));
            service.getGameById('1').subscribe((game) => {
                expect(game).toEqual(mockGames[0]);
            });
            expect(httpClientSpy.get).toHaveBeenCalledWith(`${apiUrl}1`);
        });
    });

    describe('updateGameState', () => {
        it('should send a PATCH request to update game state', () => {
            httpClientSpy.patch.and.returnValue(of(mockGames[0]));
            service.updateGameState('1', 'private').subscribe();
            expect(httpClientSpy.patch).toHaveBeenCalledWith(`${apiUrl}state/1`, { state: 'private' });
        });
    });

    describe('deleteGame', () => {
        it('should send a DELETE request to remove a game', () => {
            httpClientSpy.delete.and.returnValue(of(null));
            service.deleteGame('2').subscribe();
            expect(httpClientSpy.delete).toHaveBeenCalledWith(`${apiUrl}2`);
        });
    });

    describe('fixHour', () => {
        it('should return "N/A" for null or undefined input', () => {
            expect(service.fixHour(undefined)).toBe('N/A');
        });

        it('should correctly adjust the hour and format the date', () => {
            const inputDate = '2023-05-15T10:30:00.000Z';
            const expectedOutput = '2023-05-15 05:30:00';
            expect(service.fixHour(inputDate)).toBe(expectedOutput);
        });

        it('should handle date rollover when subtracting hours', () => {
            const inputDate = '2023-05-15T02:30:00.000Z';
            const expectedOutput = '2023-05-14 21:30:00';
            expect(service.fixHour(inputDate)).toBe(expectedOutput);
        });

        it('should truncate milliseconds', () => {
            const inputDate = '2023-05-15T10:30:00.123Z';
            const expectedOutput = '2023-05-15 05:30:00';
            expect(service.fixHour(inputDate)).toBe(expectedOutput);
        });
    });
});
