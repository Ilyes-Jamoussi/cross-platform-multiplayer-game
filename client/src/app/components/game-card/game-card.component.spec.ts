import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameCardComponent } from './game-card.component';
import { GameSizes } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';

describe('GameCardComponent', () => {
    let component: GameCardComponent;
    let fixture: ComponentFixture<GameCardComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameCardComponent, MatTooltipModule, TranslateModule.forRoot()],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCardComponent);
        component = fixture.componentInstance;

        component.game = {
            _id: '1',
            name: 'Test Game',
            description: 'Test Description',
            gameMode: 'Classic',
            state: 'public',
            owner: 'uid-1',
            ownerName: 'user1',
            gridSize: GameSizes.Big,
            nbActions: 1,
            imagePayload: 'base64ImageData',
            lastModified: '2025-02-04',
        };
        component.isOwner = true;
        component.canEdit = true;
        component.canDelete = true;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Input Properties', () => {
        it('should correctly bind input properties', () => {
            fixture.detectChanges();

            expect(component.game.imagePayload).toBe('base64ImageData');
            expect(component.game.name).toBe('Test Game');
            expect(component.game.gridSize).toBe(GameSizes.Big);
            expect(component.game.gameMode).toBe('Classic');
            expect(component.game.lastModified).toBe('2025-02-04');
            expect(component.game.state).toBe('public');
            expect(component.game.owner).toBe('uid-1');
            expect(component.game.ownerName).toBe('user1');
            expect(component.game.description).toBe('Test Description');
        });

        it('should bind isOwner, canEdit, canDelete inputs', () => {
            fixture.detectChanges();

            expect(component.isOwner).toBeTrue();
            expect(component.canEdit).toBeTrue();
            expect(component.canDelete).toBeTrue();
        });

        it('should reflect non-owner state', () => {
            component.isOwner = false;
            component.canEdit = false;
            component.canDelete = false;
            fixture.detectChanges();

            expect(component.isOwner).toBeFalse();
            expect(component.canEdit).toBeFalse();
            expect(component.canDelete).toBeFalse();
        });
    });

    describe('onEdit', () => {
        it('should emit edit event when onEdit is called', () => {
            spyOn(component.edit, 'emit');
            component.onEdit();
            expect(component.edit.emit).toHaveBeenCalled();
        });
    });

    describe('onStateSelect', () => {
        it('should emit stateChange event with the new state value', () => {
            spyOn(component.stateChange, 'emit');
            component.onStateSelect('private');
            expect(component.stateChange.emit).toHaveBeenCalledWith('private');
        });

        it('should emit stateChange event for private-shared', () => {
            spyOn(component.stateChange, 'emit');
            component.onStateSelect('private-shared');
            expect(component.stateChange.emit).toHaveBeenCalledWith('private-shared');
        });

        it('should not emit if same state', () => {
            spyOn(component.stateChange, 'emit');
            component.onStateSelect('public');
            expect(component.stateChange.emit).not.toHaveBeenCalled();
        });
    });

    describe('onDelete', () => {
        it('should emit delete event when onDelete is called', () => {
            spyOn(component.delete, 'emit');
            component.onDelete();
            expect(component.delete.emit).toHaveBeenCalled();
        });
    });
});
