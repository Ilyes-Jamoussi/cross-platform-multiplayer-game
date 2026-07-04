import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { CosmeticsService } from '@app/services/cosmetics/cosmetics.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { AVATARS, Avatar } from '@common/avatar';
import { GameRoomEvents } from '@common/gateway-events';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { StatsPageComponent } from './stats-page.component';

describe('StatsPageComponent', () => {
    let component: StatsPageComponent;
    let fixture: ComponentFixture<StatsPageComponent>;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockRouter: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        mockPlayerService = jasmine.createSpyObj('PlayerService', ['updateAvatars'], {
            player: { name: '', avatar: '' },
            roomId: 'test-room',
        });

        mockSocketService = jasmine.createSpyObj('SocketService', ['on', 'off', 'disconnect', 'sendMessage']);

        mockRouter = jasmine.createSpyObj('Router', ['navigate']);
        mockRouter.navigate.and.returnValue(Promise.resolve(true));

        const mockAuthService = jasmine.createSpyObj('AuthService', [], { userProfile$: of(null) });
        const mockCosmeticsService = jasmine.createSpyObj('CosmeticsService', ['getShopAvatars']);
        mockCosmeticsService.getShopAvatars.and.returnValue([]);

        await TestBed.configureTestingModule({
            imports: [StatsPageComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PlayerService, useValue: mockPlayerService },
                { provide: SocketService, useValue: mockSocketService },
                { provide: Router, useValue: mockRouter },
                { provide: AuthService, useValue: mockAuthService },
                { provide: CosmeticsService, useValue: mockCosmeticsService },
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(StatsPageComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should initialize room when valid conditions are met', fakeAsync(() => {
            component.ngOnInit();
            tick();

            expect(mockSocketService.on).toHaveBeenCalledWith(GameRoomEvents.AvatarUpdate, jasmine.any(Function));
            expect(mockPlayerService.updateAvatars).toHaveBeenCalled();
        }));

        describe('navigation cases', () => {
            beforeEach(() => {
                mockRouter.navigate.calls.reset();
                mockSocketService.disconnect.calls.reset();
                mockPlayerService.updateAvatars.calls.reset();
            });

            it('should navigate to home and disconnect when roomId is empty', fakeAsync(() => {
                Object.defineProperty(mockPlayerService, 'roomId', { get: () => '' });
                mockPlayerService.player.name = '';

                component.ngOnInit();
                tick();

                expect(mockRouter.navigate).toHaveBeenCalledOnceWith(['/home']);
                expect(mockSocketService.disconnect).toHaveBeenCalledTimes(1);
                expect(mockPlayerService.updateAvatars).not.toHaveBeenCalled();
            }));

            it('should navigate to home and disconnect when player name exists', fakeAsync(() => {
                Object.defineProperty(mockPlayerService, 'roomId', { get: () => 'test-room' });
                mockPlayerService.player.name = 'existing-player';

                component.ngOnInit();
                tick();

                expect(mockRouter.navigate).toHaveBeenCalledOnceWith(['/home']);
                expect(mockSocketService.disconnect).toHaveBeenCalledTimes(1);
                expect(mockPlayerService.updateAvatars).not.toHaveBeenCalled();
            }));

            it('should not navigate when both conditions are valid', fakeAsync(() => {
                Object.defineProperty(mockPlayerService, 'roomId', { get: () => 'test-room' });
                mockPlayerService.player.name = '';

                component.ngOnInit();
                tick();

                expect(mockRouter.navigate).not.toHaveBeenCalled();
                expect(mockSocketService.disconnect).not.toHaveBeenCalled();
                expect(mockPlayerService.updateAvatars).toHaveBeenCalled();
            }));
        });
    });

    it('should update isValid on onIsValidChange', () => {
        component.onIsValidChange(true);
        expect(component.isValid).toBeTrue();
    });

    it('should show username input when validateStats is called and isValid is true', () => {
        component.isValid = true;
        component.validateStats();
        expect(component.showUsernameInput).toBeTrue();
    });

    it('should update showUsernameInput on onUsernameVisibilityChange', () => {
        component.onUsernameVisibilityChange(false);
        expect(component.showUsernameInput).toBeFalse();
    });

    it('should update selectedAvatar on onAvatarSelected', () => {
        const testAvatar: Avatar = AVATARS[1];
        component.onAvatarSelected(testAvatar);
        expect(component.selectedAvatar).toBe(testAvatar);
    });

    describe('isAvailable', () => {
        it('should return true for available avatar', () => {
            const testAvatar = AVATARS[0];
            component.avatars[0].isAvailable = true;
            expect(component.isAvailable(testAvatar)).toBeTrue();
        });

        it('should return false for unavailable avatar', () => {
            const testAvatar = AVATARS[0];
            component.avatars[0].isAvailable = false;
            expect(component.isAvailable(testAvatar)).toBeFalse();
        });

        it('should return false when avatar is not found', () => {
            const nonExistentAvatar: Avatar = { name: 'NonExistent', image: 'nonexistent.png', icon: '', animation: '', idle: '' };
            expect(component.isAvailable(nonExistentAvatar)).toBeFalse();
        });

        it('should return true when avatar is the current player avatar regardless of availability', () => {
            const testAvatar = AVATARS[0];
            component['currentPlayerAvatar'] = testAvatar.name;

            component.avatars[0].isAvailable = false;
            expect(component.isAvailable(testAvatar)).toBeTrue();

            component.avatars[0].isAvailable = true;
            expect(component.isAvailable(testAvatar)).toBeTrue();
        });
    });

    describe('setupRoomUpdateListener', () => {
        it('should update avatars availability and make initial selection when first called', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'updateAvatarsAvailability');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'makeInitialSelection');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'selectFirstAvailableAvatar');

            component['setupRoomUpdateListener']();
            const callback = mockSocketService.on.calls.mostRecent().args[1];
            callback({ selectedAvatars: ['Avatar1', 'Avatar2'] });

            expect(component['updateAvatarsAvailability']).toHaveBeenCalledWith(['Avatar1', 'Avatar2']);
            expect(component['makeInitialSelection']).toHaveBeenCalled();
            expect(component['selectFirstAvailableAvatar']).not.toHaveBeenCalled();
        });

        it('should update avatars availability and select first available avatar on subsequent calls', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'updateAvatarsAvailability');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'makeInitialSelection');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'selectFirstAvailableAvatar');

            component['initialSelectionMade'] = true;

            component['setupRoomUpdateListener']();
            const callback = mockSocketService.on.calls.mostRecent().args[1];
            callback({ selectedAvatars: ['Avatar1', 'Avatar2'] });

            expect(component['updateAvatarsAvailability']).toHaveBeenCalledWith(['Avatar1', 'Avatar2']);
            expect(component['makeInitialSelection']).not.toHaveBeenCalled();
            expect(component['selectFirstAvailableAvatar']).toHaveBeenCalled();
        });
    });

    describe('makeInitialSelection', () => {
        beforeEach(() => {
            component.avatars = AVATARS.map((avatar) => ({ ...avatar, isAvailable: true }));
        });

        it('should select the first available avatar and update player service and socket', () => {
            component.avatars[0].isAvailable = false;
            const availableAvatar = component.avatars[1];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(component as any, 'makeInitialSelection').and.callThrough();

            component['setupRoomUpdateListener']();
            const callback = mockSocketService.on.calls.mostRecent().args[1];
            callback({ selectedAvatars: [AVATARS[0].name] });

            expect(component['makeInitialSelection']).toHaveBeenCalled();
            expect(component.selectedAvatar).toEqual(availableAvatar);
            expect(component['currentPlayerAvatar']).toEqual(availableAvatar.name);
            expect(mockPlayerService.player.avatar).toEqual(availableAvatar.name);
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(GameRoomEvents.AvatarUpdate, {
                roomId: 'test-room',
                nextAvatar: availableAvatar.name,
            });
        });

        it('should select the first avatar if no avatars are available', () => {
            component.avatars.forEach((avatar) => (avatar.isAvailable = false));

            component['makeInitialSelection']();

            expect(component.selectedAvatar).toEqual(AVATARS[0]);
            expect(component['currentPlayerAvatar']).toEqual(AVATARS[0].name);
            expect(mockPlayerService.player.avatar).toEqual(AVATARS[0].name);
            expect(mockSocketService.sendMessage).toHaveBeenCalledWith(GameRoomEvents.AvatarUpdate, {
                roomId: 'test-room',
                nextAvatar: AVATARS[0].name,
            });
        });
    });

    describe('updateAvatarsAvailability', () => {
        it('should update avatars availability based on selected avatars', () => {
            component['updateAvatarsAvailability'](['IceWolf', 'Phoenix']);
            expect(component.avatars.find((a) => a.name === 'IceWolf')?.isAvailable).toBeFalse();
            expect(component.avatars.find((a) => a.name === 'Phoenix')?.isAvailable).toBeFalse();
            expect(component.avatars.find((a) => a.name !== 'IceWolf' && a.name !== 'Phoenix')?.isAvailable).toBeTrue();
        });

        it('should keep the current player avatar available even if in selectedAvatars', () => {
            component['currentPlayerAvatar'] = 'IceWolf';

            component['updateAvatarsAvailability'](['IceWolf', 'Phoenix']);

            expect(component.avatars.find((a) => a.name === 'IceWolf')?.isAvailable).toBeTrue();
            expect(component.avatars.find((a) => a.name === 'Phoenix')?.isAvailable).toBeFalse();

            const otherAvatars = component.avatars.filter((a) => a.name !== 'IceWolf' && a.name !== 'Phoenix');
            otherAvatars.forEach((avatar) => {
                expect(avatar.isAvailable).toBeTrue();
            });
        });
    });

    describe('selectFirstAvailableAvatar', () => {
        beforeEach(() => {
            component.selectedAvatar = AVATARS[1];
            mockPlayerService.player.avatar = AVATARS[1].name;
        });

        it('should select first avatar if no avatars are available', () => {
            component.avatars.forEach((a) => (a.isAvailable = false));

            spyOn(component, 'onAvatarSelected');
            component['selectFirstAvailableAvatar']();

            expect(component.onAvatarSelected).toHaveBeenCalledWith(AVATARS[0]);
        });

        it('should not call onAvatarSelected if fallback is same as current', () => {
            component.avatars.forEach((a) => (a.isAvailable = false));

            component.selectedAvatar = AVATARS[0];
            mockPlayerService.player.avatar = AVATARS[0].name;

            spyOn(component, 'onAvatarSelected');
            component['selectFirstAvailableAvatar']();

            expect(component.onAvatarSelected).not.toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('should clean up socket listeners', () => {
            component.ngOnInit();
            component.ngOnDestroy();
            expect(mockSocketService.off).toHaveBeenCalledWith(GameRoomEvents.AvatarUpdate);
        });
    });
});
