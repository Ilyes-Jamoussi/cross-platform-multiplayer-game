import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PopUpData } from '@app/interfaces/popUp.interface';
import { getTileInfo } from '@app/constants/tile-info-const';
import { TranslateService } from '@ngx-translate/core';
import { AVATARS } from '@common/avatar';
import { MOCK_PLAYERS, MOCK_ROOM } from '@common/constants.spec';
import { RightClickPopupComponent } from './right-click-popup.component';
import { ItemId } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';

describe('RightClickPopupComponent', () => {
    let component: RightClickPopupComponent;
    let fixture: ComponentFixture<RightClickPopupComponent>;
    let mockPlayer = { ...MOCK_PLAYERS[0] };
    let dialogRefSpy: jasmine.SpyObj<MatDialogRef<RightClickPopupComponent>>;
    let tileInfo: ReturnType<typeof getTileInfo>;

    beforeEach(async () => {
        mockPlayer = { ...MOCK_PLAYERS[0] };
        dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

        await TestBed.configureTestingModule({
            imports: [MatDialogModule, RightClickPopupComponent, TranslateModule.forRoot()],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: mockPlayer },
                { provide: MatDialogRef, useValue: dialogRefSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RightClickPopupComponent);
        component = fixture.componentInstance;
        tileInfo = getTileInfo(TestBed.inject(TranslateService));
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should correctly set the displayText', () => {
        const mockData = {
            player: MOCK_PLAYERS[0],
            item: MOCK_ROOM.map?.board[0][0].item,
            tileInfo: tileInfo.TuileDeBase,
        } as PopUpData;
        component.data = mockData;
        component.ngOnInit();
        expect(component.displayText).toBeDefined();
    });

    it('should correctly set the displayText if item is valid', () => {
        const mockData = {
            player: MOCK_PLAYERS[0],
            item: { ...MOCK_ROOM.map?.board[0][0].item, description: ItemId.Item1 },
            tileInfo: tileInfo.TuileDeBase,
        } as PopUpData;
        component.data = mockData;
        component.ngOnInit();
        expect(component.displayText).toBeDefined();
    });

    it('should close the dialog when onClose is called', () => {
        component.onClose();
        expect(dialogRefSpy.close).toHaveBeenCalled();
    });

    it('should close the dialog when backdrop is clicked', () => {
        component.onBackdropClick();
        expect(dialogRefSpy.close).toHaveBeenCalled();
    });

    it('should return AVATARS[0].icon when player.avatar is undefined', () => {
        const player = { ...mockPlayer, avatar: undefined };
        expect(component.getPlayerImage(player)).toBe(AVATARS[0].icon);
    });

    describe('getPlayerImage', () => {
        it('should return the default avatar image when player.avatar does not match any avatar name', () => {
            const wrongPlayer = {
                ...mockPlayer,
                avatar: 'WrongAvatarName',
            };

            expect(component.getPlayerImage(wrongPlayer)).toBe(AVATARS[0].icon);
        });

        it('should return the default avatar image when player.avatar is undefined', () => {
            const wrongPlayer = {
                ...mockPlayer,
                avatar: undefined,
            };

            expect(component.getPlayerImage(wrongPlayer)).toBe(AVATARS[0].icon);
        });
    });

});
