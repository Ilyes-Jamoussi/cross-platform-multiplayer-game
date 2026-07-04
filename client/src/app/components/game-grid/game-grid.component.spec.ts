import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { GridVerifier } from '@app/classes/grid-verifier/grid-verifier';
import { Html2CanvasWrapper } from '@app/classes/wrapper/wrappers';
import { AlertService } from '@app/services/alert/alert.service';
import { GridService } from '@app/services/grid-service/grid-service.service';
import { GAME_DATA } from '@common/constants.spec';
import { GameSizes, ItemId, TileTypes } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { GameGridComponent } from './game-grid.component';

describe('GameGridComponent', () => {
    let component: GameGridComponent;
    let fixture: ComponentFixture<GameGridComponent>;
    let gridServiceSpy: jasmine.SpyObj<GridService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        const gridServiceSpyObj = jasmine.createSpyObj(
            'GridService',
            ['init', 'onDrop', 'allowDrop', 'onDragStart', 'onMouseUp', 'onMouseDown', 'resetGrid', 'getItem', 'createNewGrid'],
            {
                grid$: new BehaviorSubject(GAME_DATA.board),
                gridSubject: new BehaviorSubject(GAME_DATA.board),
                clickedTile: TileTypes.Default,
                objectGrid: { gridSize: '10' },
                game: { grid: GAME_DATA.board },
                isTooltipVisible: false,
            },
        );
        const grid = gridServiceSpyObj.gridSubject.value;
        grid[0][0].item.name = ItemId.Item7 + 'A';
        grid[0][0].item.description = 'desc';
        grid[0][0].tile = TileTypes.Ice;
        gridServiceSpyObj.gridSubject.next(grid);

        const alertSpyObj = jasmine.createSpyObj('alertService', ['alert']);
        const routerSpyObj = jasmine.createSpyObj('router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [GameGridComponent, MatTooltipModule, TranslateModule.forRoot()],
            providers: [
                { provide: GridService, useValue: gridServiceSpyObj },
                { provide: AlertService, useValue: alertSpyObj },
                { provide: Router, useValue: routerSpyObj },
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        gridServiceSpy = TestBed.inject(GridService) as jasmine.SpyObj<GridService>;
        routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GameGridComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize grid on ngOnInit', () => {
        component.ngOnInit();
        expect(gridServiceSpy.init).toHaveBeenCalled();
        expect(component.grid).toEqual(GAME_DATA.board);
    });

    it('should go back to admin page if no grid', () => {
        gridServiceSpy.init.and.throwError(new Error('Grid initialization failed'));
        component.ngOnInit();

        expect(gridServiceSpy.init).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin']);
    });

    it('should call GridService methods on drag and drop events', () => {
        const mockEvent = new DragEvent('drop');
        component.onDrop(mockEvent);
        expect(gridServiceSpy.onDrop).toHaveBeenCalledWith(mockEvent);

        component.allowDrop(mockEvent);
        expect(gridServiceSpy.allowDrop).toHaveBeenCalledWith(mockEvent);

        component.onDragStart({ event: mockEvent, coords: { row: 0, col: 0 }, item: 'item', description: 'description' });
        expect(gridServiceSpy.onDragStart).toHaveBeenCalledWith({
            event: mockEvent,
            coords: { row: 0, col: 0 },
            item: 'item',
            description: 'description',
        });
    });

    it('should call GridService methods on mouse events', () => {
        const mockEvent = new MouseEvent('mouseup');
        component.onMouseUp(mockEvent, { row: 0, col: 0 });
        expect(gridServiceSpy.onMouseUp).toHaveBeenCalledWith(mockEvent, { row: 0, col: 0 });

        component.onMouseDown(mockEvent, { row: 0, col: 0 });
        expect(gridServiceSpy.onMouseDown).toHaveBeenCalledWith(mockEvent, { row: 0, col: 0 });
    });

    it('should reset grid', () => {
        component.resetGrid();
        expect(gridServiceSpy.resetGrid).toHaveBeenCalled();
    });

    it('should get tile size', () => {
        expect(component.getTileSize()).toBe('calc(70vmin / 10)');
    });

    it('should get size from GridService', () => {
        expect(component.getSize()).toBe(GameSizes.Small);
    });

    it('should get isTooltipVisible from GridService', () => {
        expect(component.getIsTooltipVisible()).toBe(false);
    });

    describe('saveGrid', () => {
        let validateSpy: jasmine.Spy;
        let takeScreenshotSpy: jasmine.Spy;

        beforeEach(() => {
            validateSpy = spyOn(GridVerifier, 'validateGameMapFromFrontend');
            takeScreenshotSpy = spyOn(component, 'takeScreenshot').and.resolveTo();
            spyOn(component.visibilityChange, 'emit');
        });

        it('should save grid and take screenshot if grid is valid', fakeAsync(() => {
            validateSpy.and.returnValue([]);
            const newGrid = [[]];
            gridServiceSpy.createNewGrid.and.returnValue(newGrid);

            component.saveGrid();
            tick();

            expect(gridServiceSpy.objectGrid.board).toEqual(component.grid);
            expect(takeScreenshotSpy).toHaveBeenCalled();
            expect(component.visibilityChange.emit).toHaveBeenCalledWith(true);
        }));
    });

    describe('takeScreenshot', () => {
        let querySelectorSpy: jasmine.Spy;
        let html2canvasSpy: jasmine.Spy;
        let setItemSpy: jasmine.Spy;

        beforeEach(() => {
            querySelectorSpy = spyOn(document, 'querySelector');
            html2canvasSpy = spyOn(Html2CanvasWrapper, 'html2canvas').and.resolveTo({
                toDataURL: jasmine.createSpy().and.returnValue('data:image/png;base64,mockImageData'),
            } as unknown as HTMLCanvasElement);
            setItemSpy = spyOn(sessionStorage, 'setItem');
            spyOn(window, 'alert').and.callFake(() => {
                return;
            });
        });

        it('should take screenshot successfully', fakeAsync(() => {
            querySelectorSpy.and.returnValue({} as Element);
            component.takeScreenshot();
            tick();

            expect(querySelectorSpy).toHaveBeenCalledWith('.grid');
            expect(html2canvasSpy).toHaveBeenCalledWith({} as Element, {
                useCORS: true,
                scale: 1,
            });
            expect(setItemSpy).toHaveBeenCalledWith('gameToEdit', jasmine.any(String));
            expect(gridServiceSpy.objectGrid.imagePayload).toBe('mockImageData');
        }));

        it('should not take screenshot if grid element is not found', fakeAsync(() => {
            querySelectorSpy.and.returnValue(null);

            component.takeScreenshot();
            tick();

            expect(querySelectorSpy).toHaveBeenCalledWith('.grid');
            expect(setItemSpy).not.toHaveBeenCalled();
        }));
    });

    describe('Getters', () => {
        it('should return tile image', () => {
            expect(component.getImage({ row: 0, col: 0 })).toBe('./assets/images/ice_tile.png');
        });
        it('should return item image', () => {
            gridServiceSpy.getItem.and.returnValue(ItemId.Item7 + 'A');
            expect(component.getItemImage({ row: 0, col: 0 })).toBe('./assets/items/7.png');
        });
        it('should return start image', () => {
            gridServiceSpy.getItem.and.returnValue(ItemId.ItemStartingPoint + 'A');
            expect(component.getItemImage({ row: 0, col: 0 })).toBe('./assets/items/red.png');
        });
        it('should return item description', () => {
            expect(component.getItemDescription({ row: 0, col: 0 })).toBe('');
            Object.defineProperty(gridServiceSpy, 'clickedTile', {
                get: () => {
                    return TileTypes.Ice;
                },
            });
            expect(component.getItemDescription({ row: 0, col: 0 })).toBe('');
        });
        it('should return item ID', () => {
            gridServiceSpy.getItem.and.returnValue('tile-' + ItemId.Item7);
            expect(component.getId({ row: 0, col: 0 })).toBe('tile-' + ItemId.Item7);
            gridServiceSpy.getItem.and.returnValue(ItemId.Item7);
            expect(component.getId({ row: 0, col: 0 })).toBe('tile-' + ItemId.Item7);
        });
        it('should get cursor style', () => {
            expect(component.getCursorStyle()).toBe('grab');
            Object.defineProperty(gridServiceSpy, 'clickedTile', {
                get: () => {
                    return TileTypes.Ice;
                },
            });
            expect(component.getCursorStyle()).toBe('default');
        });
    });
});
