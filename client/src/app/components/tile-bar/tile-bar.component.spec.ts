import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid-service/grid-service.service';
import { TILE_IMAGES } from '@common/constants';
import { TileTypes } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { TileBarComponent } from './tile-bar.component';

describe('TileBarComponent', () => {
    let component: TileBarComponent;
    let fixture: ComponentFixture<TileBarComponent>;
    let dragDropServiceSpy: jasmine.SpyObj<DragDropService>;
    let gridServiceSpy: jasmine.SpyObj<GridService>;

    beforeEach(async () => {
        const dragDropSpyObj = jasmine.createSpyObj('DragDropService', [''], {
            isDragging$: new BehaviorSubject<boolean>(false),
        });
        const gridSpyObj = jasmine.createSpyObj('GridService', [''], {
            clickedTile: TileTypes.Default,
        });

        await TestBed.configureTestingModule({
            imports: [TileBarComponent, TranslateModule.forRoot()],
            providers: [
                { provide: DragDropService, useValue: dragDropSpyObj },
                { provide: GridService, useValue: gridSpyObj },
            ],
        }).compileComponents();

        dragDropServiceSpy = TestBed.inject(DragDropService) as jasmine.SpyObj<DragDropService>;
        gridServiceSpy = TestBed.inject(GridService) as jasmine.SpyObj<GridService>;
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TileBarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with correct tile lists', () => {
        expect(component.tiles.length).toBeGreaterThan(0);
        expect(component.preloadTiles.length).toBeGreaterThan(0);
        expect(component.tiles).not.toEqual(component.preloadTiles);
    });

    it('should update currentTileDescription and clickedTile on isDragging$ true', () => {
        component.currentTileDescription = 'Test';
        (dragDropServiceSpy.isDragging$ as BehaviorSubject<boolean>).next(true);
        expect(component.currentTileDescription).toBe('');
        expect(gridServiceSpy.clickedTile).toBe(TileTypes.Default);
    });

    it('should get correct tile image', () => {
        const testTile = TileTypes.Wall;
        const expectedImage = TILE_IMAGES.get(testTile);
        expect(component.getTileImage(testTile)).toBe(expectedImage || '');
    });

    it('should update currentTileDescription on onClick', () => {
        const testTile = TileTypes.Wall;
        component.onClick(testTile);
        expect(component.currentTileDescription).toBe(testTile);
    });

    it('should reset currentTileDescription on second click', () => {
        const testTile = TileTypes.Wall;
        component.onClick(testTile);
        component.onClick(testTile);
        expect(component.currentTileDescription).toBe('');
    });
});
