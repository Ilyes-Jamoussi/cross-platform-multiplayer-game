import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid-service/grid-service.service';
import { ItemService } from '@app/services/item/item.service';
import { GameSizes, ItemId } from '@common/enums';
import { Item, Section } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { ItemBarComponent } from './item-bar.component';

describe('ItemBarComponent', () => {
    let component: ItemBarComponent;
    let fixture: ComponentFixture<ItemBarComponent>;
    let dragDropServiceSpy: jasmine.SpyObj<DragDropService>;
    let itemServiceSpy: jasmine.SpyObj<ItemService>;
    let gridServiceSpy: jasmine.SpyObj<GridService>;
    let itemCountSubject: BehaviorSubject<number>;
    let startCountSubject: BehaviorSubject<number>;

    beforeEach(async () => {
        itemCountSubject = new BehaviorSubject<number>(0);
        startCountSubject = new BehaviorSubject<number>(0);

        const dragDropSpy = jasmine.createSpyObj('DragDropService', [
            'observeItemCounter',
            'observeStartCounter',
            'onDragEnd',
            'onDragStart',
            'setDraggable',
            'setIsDragging',
            'incrementItemCounter',
            'incrementStartCounter',
        ]);
        const itemSpy = jasmine.createSpyObj('ItemService', [
            'updateItemStyles',
            'setSize',
            'setMode',
            'filterSectionsByMode',
            'filterItemsByMapSize',
        ]);
        const gridSpy = jasmine.createSpyObj('GridService', ['dropDeleteItem']);

        dragDropSpy.observeItemCounter.and.returnValue(itemCountSubject.asObservable());
        dragDropSpy.observeStartCounter.and.returnValue(startCountSubject.asObservable());

        await TestBed.configureTestingModule({
            imports: [ItemBarComponent, TranslateModule.forRoot()],
            providers: [
                { provide: DragDropService, useValue: dragDropSpy },
                { provide: ItemService, useValue: itemSpy },
                { provide: GridService, useValue: gridSpy },
            ],
        }).compileComponents();

        dragDropServiceSpy = TestBed.inject(DragDropService) as jasmine.SpyObj<DragDropService>;
        itemServiceSpy = TestBed.inject(ItemService) as jasmine.SpyObj<ItemService>;
        gridServiceSpy = TestBed.inject(GridService) as jasmine.SpyObj<GridService>;
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ItemBarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should handle item counter changes correctly', fakeAsync(() => {
        spyOn(document, 'getElementById').and.returnValue(document.createElement('div'));

        fixture.detectChanges();

        itemCountSubject.next(0);
        tick();
        expect(itemServiceSpy.updateItemStyles).toHaveBeenCalledWith(true);

        itemServiceSpy.updateItemStyles.calls.reset();
        dragDropServiceSpy.setDraggable.calls.reset();

        itemCountSubject.next(1);
        tick();
        expect(itemServiceSpy.updateItemStyles).toHaveBeenCalledWith(false);
        expect(dragDropServiceSpy.setDraggable).toHaveBeenCalledWith(jasmine.any(HTMLElement), true);
    }));

    it('should handle start counter changes correctly', fakeAsync(() => {
        spyOn(document, 'getElementById').and.returnValue(document.createElement('div'));

        fixture.detectChanges();

        startCountSubject.next(0);
        tick();
        expect(dragDropServiceSpy.setDraggable).toHaveBeenCalledWith(jasmine.any(HTMLElement), false);

        dragDropServiceSpy.setDraggable.calls.reset();

        startCountSubject.next(1);
        tick();
        expect(dragDropServiceSpy.setDraggable).toHaveBeenCalledWith(jasmine.any(HTMLElement), true);
    }));

    it('should call dragDropService.onDragEnd on dragend event', () => {
        const event = new DragEvent('dragend');
        component.onDragEnd(event);
        expect(dragDropServiceSpy.onDragEnd).toHaveBeenCalledWith(event);
    });

    it('should initialize from sessionStorage', () => {
        const mockGame = { gridSize: '10', gameMode: 'Classic' };
        spyOn(sessionStorage, 'getItem').and.returnValue(JSON.stringify(mockGame));
        component.ngOnInit();
        expect(itemServiceSpy.mapSize).toBe(GameSizes.Small);
        expect(itemServiceSpy.mode).toBe('Classic');
    });

    it('should call dragDropService.onDragStart on dragstart', () => {
        const event = new DragEvent('dragstart');
        component.onDragStart(event, 'item', 'description');
        expect(dragDropServiceSpy.onDragStart).toHaveBeenCalledWith(event, 'item', 'description');
    });

    it('should return correct item count', () => {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        itemCountSubject.next(5);
        dragDropServiceSpy.observeItemCounter.and.returnValue(itemCountSubject);
        expect(component.getItemLeft()).toBe('5');
    });

    it('should return correct start count', () => {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        startCountSubject.next(5);
        dragDropServiceSpy.observeStartCounter.and.returnValue(startCountSubject);
        expect(component.getStartLeft()).toBe('5');
    });

    describe('onDrop', () => {
        it('should handle drop event for tile item correctly', () => {
            const mockElement = document.createElement('div');
            const mockParent = document.createElement('div');
            mockParent.appendChild(mockElement);
            mockElement.id = 'tile-1';
            const event = {
                dataTransfer: {
                    getData: jasmine.createSpy().and.returnValue('tile-1'),
                },
            } as unknown as DragEvent;

            spyOn(document, 'getElementById').and.returnValue(mockElement);
            if (mockElement.parentElement) spyOn(mockElement.parentElement, 'removeChild');

            component.onDrop(event);

            expect(dragDropServiceSpy.setIsDragging).toHaveBeenCalledWith(false);
            expect(document.getElementById).toHaveBeenCalledWith('tile-1');
            expect(mockElement.parentElement?.removeChild).toHaveBeenCalledWith(mockElement);
            expect(document.getElementById).toHaveBeenCalledWith('1');
            expect(dragDropServiceSpy.setDraggable).toHaveBeenCalledWith(mockElement, true);
            expect(gridServiceSpy.dropDeleteItem).toHaveBeenCalled();
        });

        it('should handle drop event for non-tile item correctly', () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'item-1';
            const event = {
                dataTransfer: {
                    getData: jasmine.createSpy().and.returnValue('item-1'),
                },
            } as unknown as DragEvent;

            spyOn(document, 'getElementById').and.returnValue(mockElement);

            component.onDrop(event);

            expect(dragDropServiceSpy.setIsDragging).toHaveBeenCalledWith(false);
            expect(document.getElementById).toHaveBeenCalledWith('item-1');
            expect(dragDropServiceSpy.setDraggable).toHaveBeenCalledWith(mockElement, true);
            expect(dragDropServiceSpy.incrementItemCounter).toHaveBeenCalled();
        });

        it('should handle drop event for starting point item correctly', () => {
            const mockElement = document.createElement('div');
            mockElement.id = ItemId.ItemStartingPoint;
            const event = {
                dataTransfer: {
                    getData: jasmine.createSpy().and.returnValue(ItemId.ItemStartingPoint),
                },
            } as unknown as DragEvent;

            spyOn(document, 'getElementById').and.returnValue(mockElement);

            component.onDrop(event);

            expect(dragDropServiceSpy.setIsDragging).toHaveBeenCalledWith(false);
            expect(document.getElementById).toHaveBeenCalledWith(ItemId.ItemStartingPoint);
            expect(dragDropServiceSpy.setDraggable).toHaveBeenCalledWith(mockElement, true);
            expect(dragDropServiceSpy.incrementStartCounter).toHaveBeenCalled();
        });

        it('should do nothing if no id is provided', () => {
            const event = {
                dataTransfer: {
                    getData: jasmine.createSpy().and.returnValue(null),
                },
            } as unknown as DragEvent;

            component.onDrop(event);

            expect(dragDropServiceSpy.setIsDragging).toHaveBeenCalledWith(false);
            expect(dragDropServiceSpy.incrementItemCounter).not.toHaveBeenCalled();
            expect(dragDropServiceSpy.incrementStartCounter).not.toHaveBeenCalled();
        });
    });

    it('should prevent default on allowDrop', () => {
        const event = { preventDefault: jasmine.createSpy() } as unknown as DragEvent;
        component.allowDrop(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call itemService.filterSectionsByMode', () => {
        const sections: Section[] = [];
        component.filterSectionsByMode(sections);
        expect(itemServiceSpy.filterSectionsByMode).toHaveBeenCalledWith(sections);
    });

    it('should call itemService.filterItemsByMapSize', () => {
        const items: Item[][] = [];
        component.filterItemsByMapSize(items);
        expect(itemServiceSpy.filterItemsByMapSize).toHaveBeenCalledWith(items);
    });
});
