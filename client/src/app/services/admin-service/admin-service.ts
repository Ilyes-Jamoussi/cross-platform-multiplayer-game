import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Game } from '@common/types';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FORMAT_CHARACTERS, HOUR_CHANGE } from '@common/constants';
import { AdminRoutes } from '@app/enums/admin-routes';

@Injectable({
    providedIn: 'root',
})
export class AdminService {
    private readonly apiUrl = environment.serverUrl + AdminRoutes.Game;

    constructor(private readonly http: HttpClient) {}

    getGamesForManagement(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.apiUrl}?context=management`);
    }

    getGamesForCreation(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.apiUrl}?context=creation`);
    }

    getGameById(id: string): Observable<Game> {
        return this.http.get<Game>(`${this.apiUrl}${id}`);
    }

    updateGameState(id: string, state: string): Observable<Game> {
        return this.http.patch<Game>(`${this.apiUrl}${AdminRoutes.State}${id}`, { state });
    }

    duplicateGame(id: string): Observable<Game> {
        return this.http.post<Game>(`${this.apiUrl}${AdminRoutes.Duplicate}${id}`, {});
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${id}`);
    }

    fixHour(date?: string): string {
        if (!date) return 'N/A';
        const dateObj = new Date(date);
        dateObj.setHours(dateObj.getHours() - HOUR_CHANGE);
        return dateObj.toISOString().replace('T', ' ').slice(0, FORMAT_CHARACTERS);
    }
}
