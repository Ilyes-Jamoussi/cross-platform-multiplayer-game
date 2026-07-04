import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameModes, GameSizes } from '@common/enums';
import { Game } from '@common/types';
import { CollapsibleMenuComponent } from './collapsible-menu.component';

describe('CollapsibleMenuComponent', () => {
    let component: CollapsibleMenuComponent;
    let fixture: ComponentFixture<CollapsibleMenuComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CollapsibleMenuComponent, CommonModule],
            providers: [ChangeDetectorRef],
        }).compileComponents();

        fixture = TestBed.createComponent(CollapsibleMenuComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Input Properties', () => {
        it('should correctly bind input properties', () => {
            const gameList: Game[] = createGameList();
            component.label = 'Test Label';
            component.games = gameList;

            component.ngOnChanges({
                games: {
                    previousValue: [],
                    currentValue: gameList,
                    firstChange: true,
                    isFirstChange: () => true,
                },
            });

            fixture.detectChanges();

            expect(component.label).toBe('Test Label');
            expect(component.games).toEqual(gameList);
            expect(component.gameCount).toBe(2);
        });
    });

    describe('toggleMenu', () => {
        it('should toggle isMenuOpen when toggleMenu is called', () => {
            const initialMenuState = component.isMenuOpen;
            component.toggleMenu();
            expect(component.isMenuOpen).toBe(!initialMenuState);
        });

        it('should update the menu height when toggleMenu is called', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'updateMenuHeight');
            component.toggleMenu();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((component as any).updateMenuHeight).toHaveBeenCalled();
        });
    });

    describe('updateMenuHeight', () => {
        it('should update menu height when menu is open', () => {
            const gameListLength = 3;
            component.games = createGameList(gameListLength);
            component.isMenuOpen = true;

            const menuElement = { nativeElement: { style: { height: '' } } };
            component.menu = menuElement as ElementRef<unknown>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (component as any).updateMenuHeight();

            const cardHeight = 17.75;
            const expectedHeight = Math.max(component.games.length * cardHeight, cardHeight);
            expect(menuElement.nativeElement.style.height).toBe(`${expectedHeight}vmin`);
        });

        it('should set menu height to 0 when menu is closed', () => {
            const menuElement = { nativeElement: { style: { height: '' } } };
            component.menu = menuElement as ElementRef<unknown>;
            component.isMenuOpen = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (component as any).updateMenuHeight();

            expect(menuElement.nativeElement.style.height).toBe('0');
        });
    });

    describe('ngOnChanges', () => {
        it('should update gameCount and call updateMenuHeight when games input changes', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'updateMenuHeight');

            const newGames: Game[] = createGameList();
            const previousGames: Game[] = [];
            component.games = newGames;

            component.ngOnChanges({
                games: {
                    previousValue: previousGames,
                    currentValue: newGames,
                    firstChange: false,
                    isFirstChange: () => false,
                },
            });

            expect(component.gameCount).toBe(2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((component as any).updateMenuHeight).toHaveBeenCalled();
        });
    });

    describe('ngAfterViewInit', () => {
        it('should call updateMenuHeight after view is initialized', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn<any>(component, 'updateMenuHeight');
            component.ngAfterViewInit();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((component as any).updateMenuHeight).toHaveBeenCalled();
        });
    });

    describe('ngAfterViewChecked', () => {
        it('should call updateMenuHeight after view is checked', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn<any>(component, 'updateMenuHeight');
            component.ngAfterViewChecked();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((component as any).updateMenuHeight).toHaveBeenCalled();
        });
    });

    function createGameList(count: number = 2): Game[] {
        return Array.from({ length: count }, (_, i) => ({
            _id: `${i + 1}`,
            name: `Game ${i + 1}`,
            description: `Description ${i + 1}`,
            gameMode: i % 2 === 0 ? GameModes.Classic : GameModes.CTF,
            state: 'public',
            owner: `uid-${i + 1}`,
            ownerName: `user${i + 1}`,
            gridSize: i % 2 === 0 ? GameSizes.Big : GameSizes.Medium,
            nbActions: 1,
            imagePayload: `image${i + 1}`,
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            lastModified: `2025-02-0${i + 4}`,
        }));
    }
});
