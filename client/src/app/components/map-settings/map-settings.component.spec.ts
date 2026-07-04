import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MapSettingsComponent } from './map-settings.component';

describe('MapSettingsComponent', () => {
    let component: MapSettingsComponent;
    let fixture: ComponentFixture<MapSettingsComponent>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [FormsModule, MapSettingsComponent, TranslateModule.forRoot()],
            providers: [{ provide: Router, useValue: routerSpyObj }],
        }).compileComponents();

        routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(MapSettingsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
        expect(component.gameMode).toBe('Classic');
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(component.mapSize).toBe(10);
    });

    it('should clear sessionStorage, set gameToEdit, and navigate on submit', async () => {
        spyOn(sessionStorage, 'clear');
        spyOn(sessionStorage, 'setItem');

        await component.onSubmit();

        expect(sessionStorage.clear).toHaveBeenCalled();
        expect(sessionStorage.setItem).toHaveBeenCalledWith(
            'gameToEdit',
            JSON.stringify({
                gridSize: 10,
                gameMode: 'Classic',
                state: 'public',
                nbActions: 1,
            }),
        );
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/map-editor']);
    });

    it('should use updated values when submitting', async () => {
        component.gameMode = 'CTF';
        component.mapSize = 15;
        spyOn(sessionStorage, 'setItem');

        await component.onSubmit();

        expect(sessionStorage.setItem).toHaveBeenCalledWith(
            'gameToEdit',
            JSON.stringify({
                gridSize: 15,
                gameMode: 'CTF',
                state: 'public',
                nbActions: 1,
            }),
        );
    });
});
