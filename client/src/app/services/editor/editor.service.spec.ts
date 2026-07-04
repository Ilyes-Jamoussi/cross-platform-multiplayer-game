import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Grid } from '@common/interfaces';
import { environment } from 'src/environments/environment';
import { EditorService } from './editor.service';

describe('EditorService', () => {
    let httpMock: HttpTestingController;
    let service: EditorService;
    let baseUrl: string;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
        });
        service = TestBed.inject(EditorService);
        httpMock = TestBed.inject(HttpTestingController);
        baseUrl = `${environment.serverUrl}/game/`;
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should send POST request to validate and add map', () => {
        const mockGameData: Partial<Grid> = { name: 'Test Game', description: 'Test Description' };

        service.validateAndAddMap(mockGameData).subscribe();

        const req = httpMock.expectOne(baseUrl);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(mockGameData);
    });

    it('should send PATCH request to update game', () => {
        const mockGameData: Partial<Grid> = { _id: '12345', name: 'Test Game', description: 'Test Description' };

        service.updateGame(mockGameData).subscribe();

        const req = httpMock.expectOne(`${baseUrl}${mockGameData._id}`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual(mockGameData);
    });
});
