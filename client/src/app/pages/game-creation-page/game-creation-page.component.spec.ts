import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MIN_PAGE_LOADING_MS } from '@app/constants/page-loading.constants';
import { AdminService } from '@app/services/admin-service/admin-service';
import { GAME_ARRAY_1 } from '@common/constants.spec';
import { HttpMessage } from '@common/http-message';
import { Game } from '@common/types';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { GameCreationPageComponent } from './game-creation-page.component';

describe('GameCreationPageComponent', () => {
    let component: GameCreationPageComponent;
    let fixture: ComponentFixture<GameCreationPageComponent>;
    let adminServiceSpy: jasmine.SpyObj<AdminService>;

    const mockGames: Game[] = GAME_ARRAY_1;

    beforeEach(async () => {
        adminServiceSpy = jasmine.createSpyObj('AdminService', ['getGamesForCreation']);
        adminServiceSpy.getGamesForCreation.and.returnValue(of(mockGames));

        await TestBed.configureTestingModule({
            imports: [GameCreationPageComponent, TranslateModule.forRoot()],
            providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AdminService, useValue: adminServiceSpy }],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should call loadGames on ngOnInit', () => {
        spyOn(component, 'loadGames');

        component.ngOnInit();

        expect(component.loadGames).toHaveBeenCalled();
    });

    it('should load all games returned by getGamesForCreation', fakeAsync(() => {
        adminServiceSpy.getGamesForCreation.and.returnValue(of(mockGames));

        component.loadGames();
        tick(MIN_PAGE_LOADING_MS);
        expect(adminServiceSpy.getGamesForCreation).toHaveBeenCalled();
        expect(component.cards).toEqual(mockGames);
    }));

    it('should set cards to an empty array when getGamesForCreation fails', fakeAsync(() => {
        const errorResponse = new HttpErrorResponse({
            status: HttpMessage.NotFound,
            statusText: 'games not found',
        });

        adminServiceSpy.getGamesForCreation.and.returnValue(throwError(() => errorResponse));

        component.loadGames();
        tick(MIN_PAGE_LOADING_MS);

        expect(adminServiceSpy.getGamesForCreation).toHaveBeenCalled();
        expect(component.cards).toEqual([]);
        expect(component.gamesLoadError).toBeTrue();
    }));
});
