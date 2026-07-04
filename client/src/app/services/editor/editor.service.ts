import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Grid } from '@common/interfaces';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class EditorService {
    private readonly apiUrl = environment.serverUrl + '/game/';

    constructor(private readonly http: HttpClient) {}

    validateAndAddMap(gameData: Partial<Grid>): Observable<string[]> {
        return this.http.post<string[]>(`${this.apiUrl}`, gameData);
    }

    updateGame(gameData: Partial<Grid>): Observable<string[]> {
        return this.http.patch<string[]>(`${this.apiUrl}${gameData._id}`, gameData);
    }
}
