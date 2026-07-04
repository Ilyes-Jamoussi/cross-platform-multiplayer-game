import { TestBed } from '@angular/core/testing';
import { DragDropService } from './drag-drop.service';
import { ItemCounts, GameSizes, TileTypes, ItemId } from '@common/enums';
import { BoardCell } from '@common/interfaces';

describe('DragDropService', () => {
    let service: DragDropService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(DragDropService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should get the observer', () => {
        const observer = service.isDragging$;
        expect(observer).toBeTruthy();
    });

    it('should initialize isDragging as false', () => {
        expect(service.getIsDragging()).toBeFalse();
    });

    it('should set isDragging', () => {
        service.setIsDragging(true);
        expect(service.getIsDragging()).toBeTrue();
    });

    it('should set item counter', () => {
        service.setItemCounter(GameSizes.Small);
        expect(service.observeItemCounter().getValue()).toBe(ItemCounts.SmallItem);
        service.setItemCounter(GameSizes.Medium);
        expect(service.observeItemCounter().getValue()).toBe(ItemCounts.MediumItem);
        service.setItemCounter(GameSizes.Big);
        expect(service.observeItemCounter().getValue()).toBe(ItemCounts.BigItem);
        service.setItemCounter(0);
        expect(service.observeItemCounter().getValue()).toBe(ItemCounts.MediumItem);
    });

    it('should set isDragging', () => {
        service.setIsDragging(false);
        expect(service.getIsDragging()).toBeFalse();
        service.setIsDragging(true);
        expect(service.getIsDragging()).toBeTrue();
    });

    it('should increment startCounter', () => {
        service.setItemCounter(GameSizes.Big);
        service.incrementStartCounter();
        expect(service.observeStartCounter().getValue()).toEqual(ItemCounts.BigItem + 1);
        service.setItemCounter(GameSizes.Medium);
        service.incrementStartCounter();
        expect(service.observeStartCounter().getValue()).toEqual(ItemCounts.MediumItem + 1);
        service.setItemCounter(GameSizes.Small);
        service.incrementStartCounter();
        expect(service.observeStartCounter().getValue()).toEqual(ItemCounts.SmallItem + 1);
    });

    it('should decrement startCounter', () => {
        service.setItemCounter(GameSizes.Big);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).decrementStartCounter();
        expect(service.observeStartCounter().getValue()).toEqual(ItemCounts.BigItem - 1);
        service.setItemCounter(GameSizes.Medium);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).decrementStartCounter();
        expect(service.observeStartCounter().getValue()).toEqual(ItemCounts.MediumItem - 1);
        service.setItemCounter(GameSizes.Small);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).decrementStartCounter();
        expect(service.observeStartCounter().getValue()).toEqual(ItemCounts.SmallItem - 1);
    });

    it('should increment itemCounter', () => {
        service.setItemCounter(GameSizes.Big);
        service.incrementItemCounter();
        expect(service.observeItemCounter().getValue()).toEqual(ItemCounts.BigItem + 1);
        service.setItemCounter(GameSizes.Medium);
        service.incrementItemCounter();
        expect(service.observeItemCounter().getValue()).toEqual(ItemCounts.MediumItem + 1);
        service.setItemCounter(GameSizes.Small);
        service.incrementItemCounter();
        expect(service.observeItemCounter().getValue()).toEqual(ItemCounts.SmallItem + 1);
    });

    it('should decrement itemCounter', () => {
        service.setItemCounter(GameSizes.Big);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).decrementItemCounter();
        expect(service.observeItemCounter().getValue()).toEqual(ItemCounts.BigItem - 1);
        service.setItemCounter(GameSizes.Medium);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).decrementItemCounter();
        expect(service.observeItemCounter().getValue()).toEqual(ItemCounts.MediumItem - 1);
        service.setItemCounter(GameSizes.Small);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).decrementItemCounter();
        expect(service.observeItemCounter().getValue()).toEqual(ItemCounts.SmallItem - 1);
    });

    describe('onDragStart', () => {
        it('should set isDragging to true', () => {
            const mockEvent = new DragEvent('dragstart');
            service.onDragStart(mockEvent, 'testItem', 'testItem');
            expect(service.getIsDragging()).toBeTrue();
        });

        it('should set data transfer', () => {
            const mockEvent = new DragEvent('dragstart');
            Object.defineProperty(mockEvent, 'dataTransfer', {
                value: jasmine.createSpyObj('DataTransfer', ['setData']),
            });
            service.onDragStart(mockEvent, 'testItem', 'testItem');
            expect(mockEvent.dataTransfer?.setData).toHaveBeenCalledWith('text', 'testItem,testItem');
        });

        it('should modify target element style', () => {
            const mockTarget = document.createElement('div');
            const mockEvent = new DragEvent('dragstart');
            Object.defineProperty(mockEvent, 'target', { value: mockTarget });
            service.onDragStart(mockEvent, 'testItem', 'testItem');
            expect(mockTarget.style.opacity).toBe('0.4');
            expect(mockTarget.draggable).toBeFalse();
        });
    });

    describe('onDragEnd', () => {
        it('should set isDragging to false', (done) => {
            const mockEvent = new DragEvent('dragend');
            service.setIsDragging(true);
            service.onDragEnd(mockEvent);
            setTimeout(() => {
                expect(service.getIsDragging()).toBeFalse();
                done();
            }, 0);
        });

        it('should reset target element style if not dropped', (done) => {
            const mockTarget = document.createElement('div');
            const mockEvent = new DragEvent('dragend');
            Object.defineProperty(mockEvent, 'target', { value: mockTarget });
            service.setIsDragging(true);
            service.onDragEnd(mockEvent);
            setTimeout(() => {
                expect(mockTarget.style.opacity).toBe('1');
                expect(mockTarget.style.cursor).toBe('grab');
                expect(mockTarget.draggable).toBeTrue();
                done();
            }, 0);
        });

        it('should handle item-container parent', () => {
            const mockParent = document.createElement('div');
            mockParent.classList.add('item-container');
            const mockTarget = document.createElement('div');
            mockParent.appendChild(mockTarget);
            const mockEvent = new DragEvent('dragend');
            Object.defineProperty(mockEvent, 'target', { value: mockTarget });
            service.onDragEnd(mockEvent);
            expect(mockTarget.style.opacity).toBe('1');
            expect(mockTarget.draggable).toBeTrue();
            expect(mockTarget.style.cursor).toBe('grab');
        });

        it('should handle tile parent', () => {
            const mockParent = document.createElement('div');
            mockParent.classList.add('tile');
            const mockTarget = document.createElement('div');
            mockParent.appendChild(mockTarget);
            const mockEvent = new DragEvent('dragend');
            Object.defineProperty(mockEvent, 'target', { value: mockTarget });
            const preventDefaultSpy = spyOn(mockEvent, 'preventDefault');
            service.onDragEnd(mockEvent);
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(mockTarget.style.opacity).toBe('1');
            expect(mockTarget.draggable).toBeTrue();
            expect(mockTarget.style.cursor).toBe('grab');
        });

        it('should decrement itemCounter if dragged element is Item', () => {
            const mockTarget = document.createElement('div');
            mockTarget.id = ItemId.Item1;
            const mockEvent = new DragEvent('dragend');
            Object.defineProperty(mockEvent, 'target', { value: mockTarget });

            const initialCount = service['itemCounter'].value;
            service.onDragEnd(mockEvent);

            expect(service['itemCounter'].value).toBe(initialCount - 1);
        });
        it('should decrement startCounter if dragged element is StartPoint', () => {
            const mockTarget = document.createElement('div');
            mockTarget.id = ItemId.ItemStartingPoint;
            const mockEvent = new DragEvent('dragend');
            Object.defineProperty(mockEvent, 'target', { value: mockTarget });

            const initialCount = service['startCounter'].value;
            service.onDragEnd(mockEvent);

            expect(service['startCounter'].value).toBe(initialCount - 1);
        });
    });

    describe('giveItemId', () => {
        it('should handle item-7 with multiple instances', () => {
            const grid: BoardCell[][] = [
                [{ tile: TileTypes.Default, item: { name: ItemId.Item7 + 'A', description: '' } }],
                [{ tile: TileTypes.Default, item: { name: ItemId.Item7 + 'B', description: '' } }],
            ];

            expect(service.giveItemId(ItemId.Item1, grid)).toBe(ItemId.Item1);
            expect(service.giveItemId(ItemId.Item7, grid)).toBe(ItemId.Item7 + 'C');
        });

        it('should handle suffix overflow', () => {
            const ALPHABET_LENGTH = 26;
            const LETTER_VALUE = 65;
            const grid: BoardCell[][] = [
                [...Array(ALPHABET_LENGTH)].map((_, i) => ({
                    tile: TileTypes.Default,
                    item: { name: `${ItemId.Item7}${String.fromCharCode(LETTER_VALUE + i)}`, description: '' },
                })),
            ];
            expect(service.giveItemId(ItemId.Item7, grid)).toBe(ItemId.Item7 + 'A1');
        });
    });
    describe('incrementObject', () => {
        it('should increment start counter for starting point item', () => {
            const mockElement = document.createElement('div');
            mockElement.id = ItemId.ItemStartingPoint;
            spyOn(service, 'incrementStartCounter');

            service.incrementObject(mockElement);

            expect(service.incrementStartCounter).toHaveBeenCalled();
        });

        it('should increment item counter for numbered item', () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'item1';
            spyOn(service, 'incrementItemCounter');

            service.incrementObject(mockElement);

            expect(service.incrementItemCounter).toHaveBeenCalled();
        });

        it('should not increment any counter for other items', () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'someOtherItem';
            spyOn(service, 'incrementStartCounter');
            spyOn(service, 'incrementItemCounter');

            service.incrementObject(mockElement);

            expect(service.incrementStartCounter).not.toHaveBeenCalled();
            expect(service.incrementItemCounter).not.toHaveBeenCalled();
        });
    });

    describe('decrementObject', () => {
        it('should decrement start counter for starting point item', () => {
            const mockElement = document.createElement('div');
            mockElement.id = ItemId.ItemStartingPoint;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'decrementStartCounter');

            service.decrementObject(mockElement);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).decrementStartCounter).toHaveBeenCalled();
        });

        it('should decrement item counter for numbered item', () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'item1';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'decrementItemCounter');

            service.decrementObject(mockElement);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).decrementItemCounter).toHaveBeenCalled();
        });

        it('should not decrement any counter for other items', () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'someOtherItem';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'decrementStartCounter');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'decrementItemCounter');

            service.decrementObject(mockElement);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).decrementStartCounter).not.toHaveBeenCalled();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).decrementItemCounter).not.toHaveBeenCalled();
        });
    });
});
