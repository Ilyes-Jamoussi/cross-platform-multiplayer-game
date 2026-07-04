import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BoardCell } from '@common/interfaces';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface GeneratorParams {
    gridSize: number;
    gameMode: string;
    waterPercentage: number;
    icePercentage: number;
}

@Injectable({
    providedIn: 'root',
})
export class BoardGeneratorService {
    private readonly apiUrl = environment.serverUrl + '/game/generate';

    constructor(private readonly http: HttpClient) {}

    generateGrid(params: GeneratorParams): Observable<BoardCell[][]> {
        return this.http.post<BoardCell[][]>(this.apiUrl, params);
    }
}
