import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { WinnerAnnouncementComponent } from './winner-announcement-popup.component';

describe('WinnerAnnouncementComponent', () => {
    let component: WinnerAnnouncementComponent;
    let fixture: ComponentFixture<WinnerAnnouncementComponent>;
    let dialogRefSpy: jasmine.SpyObj<MatDialogRef<WinnerAnnouncementComponent>>;

    beforeEach(async () => {
        dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

        await TestBed.configureTestingModule({
            imports: [WinnerAnnouncementComponent],
            providers: [
                { provide: MatDialogRef, useValue: dialogRefSpy },
                { provide: MAT_DIALOG_DATA, useValue: { message: 'Player 1 Wins!' } },
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(WinnerAnnouncementComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should display the winner message', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('Player 1 Wins!');
    });

    it('should close the dialog after 3 seconds', fakeAsync(() => {
        spyOn(component, 'close').and.callThrough();

        component.ngOnInit();
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        tick(3000);

        expect(component.close).toHaveBeenCalled();
        expect(dialogRefSpy.close).toHaveBeenCalled();
    }));
    it('should close the dialog when onClose is called', () => {
        dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).dialogRef = dialogRefSpy;
        component.close();
        expect(dialogRefSpy.close).toHaveBeenCalled();
    });
});
