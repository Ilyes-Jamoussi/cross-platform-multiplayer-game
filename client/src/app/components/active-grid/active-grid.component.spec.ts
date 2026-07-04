import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActionService } from '@app/services/action/action.service';
import { ActiveGridService } from '@app/services/active-grid/active-grid.service';
import { AlertService } from '@app/services/alert/alert.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { TurnService } from '@app/services/turn/turn-service';
import { AVATARS } from '@common/avatar';
import { DEBOUNCE_TIME, TILE_IMAGES } from '@common/constants';
import { GAME_DATA } from '@common/constants.spec';
import { Actions, Directions, PlayerState, TileTypes } from '@common/enums';
import { Grid, ItemCell, Player } from '@common/interfaces';
import { Position } from '@common/types';
import { BehaviorSubject, of, Subject, Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ActiveGridComponent } from './active-grid.component';

describe('ActiveGridComponent', () => {
    let component: ActiveGridComponent;
    let fixture: ComponentFixture<ActiveGridComponent>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeGridServiceMock: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let playerServiceMock: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let actionServiceMock: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let turnServiceMock: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let alertServiceMock: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gameModeServiceMock: any;

    beforeEach(async () => {
        activeGridServiceMock = {
            gridSubject: new Subject(),
            grid$: of(GAME_DATA),
            loadGrid: jasmine.createSpy('loadGrid'),
            init: jasmine.createSpy('init'),
            handleClick: jasmine.createSpy('handleClick'),
            handleHovered: jasmine.createSpy('handleHovered'),
            handleUnhovered: jasmine.createSpy('handleUnhovered'),
            getReachableTile: jasmine.createSpy('getReachableTile'),
            getHighlightedTile: jasmine.createSpy('getHighlightedTile'),
            findAndSelectPlayer: jasmine.createSpy('findAndSelectPlayer'),
            deselectPlayer: jasmine.createSpy('deselectPlayer'),
            isOpposingPlayer: jasmine.createSpy('isOpposingPlayer'),
            isDebug: false,
            canStillMove: new BehaviorSubject<boolean>(true),
            ngOnDestroy: jasmine.createSpy('ngOnDestroy'),
            getIsIceAdjacent: jasmine.createSpy('getIsIceAdjacent'),
        };

        playerServiceMock = {
            roomId: 'room1',
            player: { id: 'player1', avatar: 'avatar1' },
        };

        actionServiceMock = {
            setupListeners: jasmine.createSpy('setupListeners'),
            toggleDoorListener: jasmine.createSpy('toggleDoorListener'),
            hasActionLeftSubject: new Subject(),
            getAdjacentPlayerOrDoor: jasmine.createSpy('getAdjacentPlayerOrDoor'),
            isActionClicked: false,
            isCombat: false,
            sendCombatInit: jasmine.createSpy('sendCombatInit'),
            sendToggledDoor: jasmine.createSpy('sendToggledDoor'),
            disableListeners: jasmine.createSpy('disableListeners'),
            hasActionLeft: true,
            resetActions: jasmine.createSpy('resetActions'),
            consumeAction: jasmine.createSpy('consumeAction'),
            isSpecificPlayerAdjacent: jasmine.createSpy('isSpecificPlayerAdjacent'),
            getPlayerPosition: jasmine.createSpy('getPlayerPosition').and.returnValue({ x: 0, y: 0 }),
            isAdjacent: jasmine.createSpy('isAdjacent').and.returnValue(true),
        };

        turnServiceMock = {
            isMyTurn: jasmine.createSpy('isMyTurn').and.returnValue(true),
            freezeTurn: jasmine.createSpy('freezeTurn'),
            nextTurn: jasmine.createSpy('nextTurn'),
            isBlocking: false,
            timeLeft: 10,
        };

        alertServiceMock = {
            tileInfo: jasmine.createSpy('tileInfo'),
        };

        gameModeServiceMock = {
            showFlagHolder: jasmine.createSpy('showFlagHolder'),
            makeStartingPointGlow: jasmine.createSpy('makeStartingPointGlow'),
            onReset: jasmine.createSpy('onReset'),
            isCtf: jasmine.createSpy('isCtf'),
            isPartOfOwnTeam: jasmine.createSpy('isPartOfOwnTeam'),
            getTeamId: jasmine.createSpy('getTeamId').and.returnValue(''),
            isTeamGameMode: jasmine.createSpy('isTeamGameMode').and.returnValue(false),
        };

        await TestBed.configureTestingModule({
            imports: [ActiveGridComponent, TranslateModule.forRoot()],
            providers: [
                { provide: ActiveGridService, useValue: activeGridServiceMock },
                { provide: PlayerService, useValue: playerServiceMock },
                { provide: ActionService, useValue: actionServiceMock },
                { provide: TurnService, useValue: turnServiceMock },
                { provide: AlertService, useValue: alertServiceMock },
                { provide: GameModeService, useValue: gameModeServiceMock },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ActiveGridComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('should return true if grid is defined', () => {
        component['_grid'] = GAME_DATA as Grid;
        expect(component.isDefined()).toBeTrue();
    });

    it('should call unsubscribe on _activeGrid if it is defined', () => {
        const mockSubscription = new Subscription();
        spyOn(mockSubscription, 'unsubscribe');

        Object.defineProperty(component, '_activeGrid', { value: mockSubscription, writable: true });

        component.ngOnDestroy();

        expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });

    it("should call findAndSelectPlayer if hasActionsLeft is false and it is the player's turn", () => {
        turnServiceMock.isMyTurn.and.returnValue(true);
        spyOn(activeGridServiceMock.canStillMove, 'getValue').and.returnValue(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'checkAndProcessTurnEnd');

        actionServiceMock.hasActionLeftSubject.next(false);

        expect(activeGridServiceMock.findAndSelectPlayer).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).checkAndProcessTurnEnd).toHaveBeenCalledWith(true);
    });

    it('should call checkAndProcessTurnEnd with the correct argument', () => {
        turnServiceMock.isMyTurn.and.returnValue(true);
        spyOn(activeGridServiceMock.canStillMove, 'getValue').and.returnValue(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'checkAndProcessTurnEnd');

        actionServiceMock.hasActionLeftSubject.next(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).checkAndProcessTurnEnd).toHaveBeenCalledWith(true);
    });

    it('should call checkAndProcessTurnEnd with the correct argument when canStillMove emits a value', () => {
        actionServiceMock.getAdjacentPlayerOrDoor.and.returnValue(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'checkAndProcessTurnEnd');

        activeGridServiceMock.canStillMove.next(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).checkAndProcessTurnEnd).toHaveBeenCalledWith(true);
    });

    it('should return true if tile is a door and conditions are met', () => {
        component['_grid'] = {
            board: [[{ tile: TileTypes.Door, item: { name: '' }, player: undefined }], [{ tile: TileTypes.Default, player: { id: 'player1' } }]],
        } as Grid;
        spyOn(component, 'isMyTurn').and.returnValue(true);
        spyOn(component, 'getIsAction').and.returnValue(true);
        spyOn(component, 'getAdjacentPlayers').and.returnValue(true);
        spyOn(component, 'hasActionsLeft').and.returnValue(true);

        expect(component.isDoor(0, 0)).toBeTrue();
    });

    it('should return false if tile is not a door', () => {
        component['_grid'] = {
            board: [[{ tile: TileTypes.Default }]],
        } as Grid;
        expect(component.isDoor(0, 0)).toBeFalse();
    });

    it('should return the correct tile image', () => {
        component['_grid'] = {
            board: [[{ tile: TileTypes.Default }]],
        } as Grid;
        const expectedImage = TILE_IMAGES.get(TileTypes.Default) as string;
        expect(component.getTileImage(0, 0)).toBe(expectedImage);
    });

    it('should return the default avatar if player has no avatar', () => {
        component['_grid'] = {
            board: [[{ player: { id: 'player1' } }]],
        } as Grid;
        expect(component.getPlayerAvatar(0, 0)).toBe(AVATARS[0].idle);
    });

    it("should return the player's avatar if available", () => {
        component['_grid'] = {
            board: [[{ player: { id: 'player1', avatar: 'avatar1' } }]],
        } as Grid;
        expect(component.getPlayerAvatar(0, 0)).toBe(AVATARS[0].idle);
    });

    it('should call activeGridService.handleClick with correct parameters', () => {
        const mockEvent = { button: 0 } as MouseEvent;
        const mockPosition = { x: 1, y: 2 } as Position;
        const mockGrid = GAME_DATA as Grid;

        component['_grid'] = mockGrid;
        component.tileClick(mockEvent, mockPosition);

        expect(activeGridServiceMock.handleClick).toHaveBeenCalledWith({
            event: mockEvent,
            position: mockPosition,
            grid: mockGrid,
        });
    });

    it('should ignore tile clicks when current player is spectator', () => {
        playerServiceMock.player = { ...playerServiceMock.player, state: PlayerState.ELIMINATED, isSpectator: true };
        const mockEvent = { button: 0 } as MouseEvent;
        const mockPosition = { x: 1, y: 2 } as Position;
        const mockGrid = GAME_DATA as Grid;
        component['_grid'] = mockGrid;

        component.tileClick(mockEvent, mockPosition);

        expect(activeGridServiceMock.handleClick).not.toHaveBeenCalled();
    });

    describe('startCombat', () => {
        it('should start combat if tile is an opposing player and conditions are met', () => {
            const mockCurrentPlayerCell = {
                tile: TileTypes.Default,
                canCombat: true,
                player: { id: 'player1' },
                position: { x: 0, y: 0 },
            };
            const mockOpposingPlayerCell = {
                tile: TileTypes.Default,
                canCombat: true,
                player: { id: 'player2' },
                position: { x: 0, y: 1 },
            };
            const mockGrid = {
                board: [[mockCurrentPlayerCell, mockOpposingPlayerCell]],
            } as Grid;

            component['_grid'] = mockGrid;
            actionServiceMock.isActionClicked = true;
            activeGridServiceMock.isMoving = false;

            actionServiceMock.getPlayerPosition = jasmine.createSpy('getPlayerPosition').and.returnValue({ x: 0, y: 0 });
            actionServiceMock.isAdjacent = jasmine.createSpy('isAdjacent').and.returnValue(true);

            spyOn(component, 'isDoor').and.returnValue(false);
            activeGridServiceMock.isOpposingPlayer.and.returnValue(true);
            spyOn(component, 'startCombat');

            component.onTileDoubleClick(mockOpposingPlayerCell.position);

            expect(activeGridServiceMock.deselectPlayer).toHaveBeenCalled();
            expect(actionServiceMock.isCombat).toBeTrue();
            expect(component.startCombat).toHaveBeenCalled();
        });

        it('should freeze turn and send combat init when timeLeft > 0', () => {
            turnServiceMock.timeLeft = 10;
            component.startCombat();

            expect(turnServiceMock.freezeTurn).toHaveBeenCalled();
            expect(actionServiceMock.sendCombatInit).toHaveBeenCalledWith(playerServiceMock.roomId, playerServiceMock.player, Actions.StartCombat);
        });

        it('should not start combat when timeLeft is 0', () => {
            turnServiceMock.timeLeft = 0;
            component.startCombat();

            expect(turnServiceMock.freezeTurn).not.toHaveBeenCalled();
            expect(actionServiceMock.sendCombatInit).not.toHaveBeenCalled();
        });

        it('should not start combat when timeLeft is negative', () => {
            turnServiceMock.timeLeft = -1;
            component.startCombat();

            expect(turnServiceMock.freezeTurn).not.toHaveBeenCalled();
            expect(actionServiceMock.sendCombatInit).not.toHaveBeenCalled();
        });

        it('should not start combat when current player is spectator', () => {
            playerServiceMock.player = { ...playerServiceMock.player, state: PlayerState.ELIMINATED, isSpectator: true };

            component.startCombat();

            expect(turnServiceMock.freezeTurn).not.toHaveBeenCalled();
            expect(actionServiceMock.sendCombatInit).not.toHaveBeenCalled();
        });

        it('should freeze the turn and send combat init', () => {
            component.startCombat();

            expect(turnServiceMock.freezeTurn).toHaveBeenCalled();

            expect(actionServiceMock.sendCombatInit).toHaveBeenCalledWith(playerServiceMock.roomId, playerServiceMock.player, Actions.StartCombat);
        });
    });

    describe('onTileDoubleClick', () => {
        it('should set newState to OpenedDoor if cell.tile is Door', () => {
            const mockPosition = { x: 1, y: 2 };
            const mockCell = { tile: TileTypes.Door, canCombat: false, player: undefined };
            const mockGrid = {
                board: [[], [null, null, mockCell]],
            } as Grid;

            component['_grid'] = mockGrid;
            actionServiceMock.isActionClicked = true;
            actionServiceMock.hasActionLeft = true;
            actionServiceMock.isActionClicked = true;
            activeGridServiceMock.isMoving = false;
            spyOn(component, 'isDoor').and.returnValue(true); // This should return true for door tiles
            spyOn(component, 'isTeamMember').and.returnValue(false);

            component.onTileDoubleClick(mockPosition);

            expect(actionServiceMock.sendToggledDoor).toHaveBeenCalledWith(mockPosition, playerServiceMock.roomId, TileTypes.OpenedDoor);
            expect(actionServiceMock.isActionClicked).toBeFalse();
        });

        it('should set newState to Door if cell.tile is OpenedDoor', () => {
            const mockPosition = { x: 1, y: 2 };
            const mockCell = { tile: TileTypes.OpenedDoor, canCombat: false, player: undefined };
            const mockGrid = {
                board: [[], [null, null, mockCell]],
            } as Grid;

            component['_grid'] = mockGrid;
            actionServiceMock.isActionClicked = true;
            activeGridServiceMock.isMoving = false;
            spyOn(component, 'isDoor').and.returnValue(true);
            spyOn(component, 'isTeamMember').and.returnValue(false);

            component.onTileDoubleClick(mockPosition);

            expect(actionServiceMock.sendToggledDoor).toHaveBeenCalledWith(mockPosition, playerServiceMock.roomId, TileTypes.Door);
            expect(actionServiceMock.isActionClicked).toBeFalse();
        });

        it('should not toggle door if isTeamMember returns true', () => {
            const mockPosition = { x: 1, y: 2 };
            const mockCell = { tile: TileTypes.Door, canCombat: false, player: { id: '1' } };
            const mockGrid = {
                board: [[], [null, null, mockCell]],
            } as Grid;

            component['_grid'] = mockGrid;
            actionServiceMock.isActionClicked = true;
            activeGridServiceMock.isMoving = false;
            spyOn(component, 'isDoor').and.returnValue(true);
            spyOn(component, 'isTeamMember').and.returnValue(true);

            component.onTileDoubleClick(mockPosition);

            expect(actionServiceMock.sendToggledDoor).not.toHaveBeenCalled();
        });
    });

    it('should call combatService.isSpecificPlayerAdjacent with correct parameters', () => {
        const mockRowIndex = 1;
        const mockColIndex = 2;
        const mockGrid = GAME_DATA as Grid;

        component['_grid'] = mockGrid;
        component.getAdjacentPlayers(mockRowIndex, mockColIndex);

        expect(actionServiceMock.isSpecificPlayerAdjacent).toHaveBeenCalledWith(
            { x: mockRowIndex, y: mockColIndex } as Position,
            playerServiceMock.player.id,
            mockGrid,
        );
    });

    it('should call activeGridService.handleHovered with the correct position', () => {
        const mockPosition = { x: 1, y: 2 } as Position;

        component.onTileHovered(mockPosition);

        expect(activeGridServiceMock.handleHovered).toHaveBeenCalledWith(mockPosition);
    });

    it('should call activeGridService.handleUnhovered with the event if provided', () => {
        component.onTileUnhovered();

        expect(activeGridServiceMock.handleUnhovered).toHaveBeenCalledWith();
    });

    it("should return true if it is the player's turn", () => {
        turnServiceMock.isMyTurn.and.returnValue(true);
        expect(component.isMyTurn()).toBeTrue();
    });

    it("should return false if it is not the player's turn", () => {
        turnServiceMock.isMyTurn.and.returnValue(false);
        expect(component.isMyTurn()).toBeFalse();
    });

    it('should return true if combatService.isActionClicked is true', () => {
        actionServiceMock.isActionClicked = true;
        expect(component.getIsAction()).toBeTrue();
    });

    it('should return false if combatService.isActionClicked is false', () => {
        actionServiceMock.isActionClicked = false;
        expect(component.getIsAction()).toBeFalse();
    });

    it("should return the player's last direction if it exists", () => {
        const mockPlayer = { lastDirection: Directions.Left } as Player;
        const mockGrid = {
            board: [[null, { player: mockPlayer }]],
        } as Grid;

        component['_grid'] = mockGrid;
        expect(component.getPlayerLastDirection(0, 1)).toBe(Directions.Left);
    });

    /* eslint-disable max-lines */
    it('should return Directions.Right if player or lastDirection does not exist', () => {
        const mockCell = { tile: TileTypes.Default };
        const mockGrid = {
            board: [[mockCell]],
        } as Grid;

        component['_grid'] = mockGrid;
        expect(component.getPlayerLastDirection(0, 0)).toBe(Directions.Right);
    });

    it('should return true if combatService.hasActionLeft is true', () => {
        actionServiceMock.hasActionLeft = true;
        expect(component.hasActionsLeft()).toBeTrue();
    });

    it('should return false if combatService.hasActionLeft is false', () => {
        actionServiceMock.hasActionLeft = false;
        expect(component.hasActionsLeft()).toBeFalse();
    });

    it('should call processTurnEnd if all conditions are met', () => {
        actionServiceMock.isCombat = false;
        turnServiceMock.isBlocking = false;
        turnServiceMock.isMyTurn.and.returnValue(true);
        activeGridServiceMock.getIsIceAdjacent.and.returnValue(false);
        turnServiceMock.timeLeft = 10;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'processTurnEnd');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).checkAndProcessTurnEnd(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).processTurnEnd).toHaveBeenCalled();
    });

    it('should not call processTurnEnd if any condition is not met', () => {
        actionServiceMock.isCombat = true;
        turnServiceMock.isBlocking = false;
        turnServiceMock.isMyTurn.and.returnValue(true);
        activeGridServiceMock.getIsIceAdjacent.and.returnValue(false);
        turnServiceMock.timeLeft = 10;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'processTurnEnd');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).checkAndProcessTurnEnd(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).processTurnEnd).not.toHaveBeenCalled();
    });

    it('should update state and reset hasBeenCalled after debounce time', fakeAsync(() => {
        spyOn(activeGridServiceMock.canStillMove, 'next');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).processTurnEnd();

        expect(actionServiceMock.resetActions).toHaveBeenCalled();
        expect(turnServiceMock.nextTurn).toHaveBeenCalled();
        expect(activeGridServiceMock.canStillMove.next).toHaveBeenCalledWith(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).hasBeenCalled).toBeTrue();

        tick(DEBOUNCE_TIME);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).hasBeenCalled).toBeFalse();
    }));

    it('should not update state if hasBeenCalled is true', fakeAsync(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).hasBeenCalled = true;

        spyOn(activeGridServiceMock.canStillMove, 'next');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).processTurnEnd();

        expect(actionServiceMock.resetActions).not.toHaveBeenCalled();
        expect(turnServiceMock.nextTurn).not.toHaveBeenCalled();
        expect(activeGridServiceMock.canStillMove.next).not.toHaveBeenCalled();
    }));

    it('should call alertService.tileInfo with the correct data and event', () => {
        const mockData = 'test data';
        const mockEvent = { clientX: 100, clientY: 200 } as MouseEvent;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).openInfo(mockData, mockEvent);

        expect(alertServiceMock.tileInfo).toHaveBeenCalledWith(mockData, mockEvent);
    });

    it('should call openInfo if data is returned and isDebug is false', () => {
        const mockEvent = { preventDefault: jasmine.createSpy() } as unknown as MouseEvent;
        const mockPosition = { x: 1, y: 2 } as Position;
        const mockPlayer = { id: 'player1', avatar: AVATARS[0].name } as Player;
        const mockItem = { name: 'flag', description: 'flag' } as ItemCell;
        const mockData = { player: mockPlayer, tile: TileTypes.Default, item: mockItem };

        spyOn(component, 'tileClick').and.returnValue(mockData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'openInfo');
        activeGridServiceMock.isDebug = false;

        component.onRightClick(mockEvent, mockPosition);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(component.tileClick).toHaveBeenCalledWith(mockEvent, mockPosition);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).openInfo).toHaveBeenCalledWith(mockData, mockEvent);
    });

    it('should not call openInfo if data is not returned', () => {
        const mockEvent = { preventDefault: jasmine.createSpy() } as unknown as MouseEvent;
        const mockPosition = { x: 1, y: 2 } as Position;

        spyOn(component, 'tileClick').and.returnValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'openInfo');
        activeGridServiceMock.isDebug = false;

        component.onRightClick(mockEvent, mockPosition);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(component.tileClick).toHaveBeenCalledWith(mockEvent, mockPosition);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).openInfo).not.toHaveBeenCalled();
    });

    it('should call openInfo in debug mode when tileClick returns data (teleportation did not occur)', () => {
        const mockEvent = { preventDefault: jasmine.createSpy() } as unknown as MouseEvent;
        const mockPosition = { x: 1, y: 2 } as Position;
        const mockPlayer = { id: 'player1', avatar: AVATARS[0].name } as Player;
        const mockItem = { name: 'flag', description: 'flag' } as ItemCell;
        const mockData = { player: mockPlayer, tile: TileTypes.Default, item: mockItem };

        spyOn(component, 'tileClick').and.returnValue(mockData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(component as any, 'openInfo');
        activeGridServiceMock.isDebug = true;

        component.onRightClick(mockEvent, mockPosition);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(component.tileClick).toHaveBeenCalledWith(mockEvent, mockPosition);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).openInfo).toHaveBeenCalledWith(mockData, mockEvent);
    });

    it('should return true if canCombat is true and all conditions are met', () => {
        const mockRowIndex = 1;
        const mockColIndex = 2;
        const mockCell = { canCombat: true, player: { id: 'player2' } };
        const mockGrid = {
            board: [[], [null, null, mockCell]],
        } as Grid;

        component['_grid'] = mockGrid;
        spyOn(component, 'isMyTurn').and.returnValue(true);
        spyOn(component, 'getIsAction').and.returnValue(true);
        spyOn(component, 'getAdjacentPlayers').and.returnValue(true);
        spyOn(component, 'hasActionsLeft').and.returnValue(true);

        const result = component.canCombat(mockRowIndex, mockColIndex);

        expect(result).toBeTrue();
    });

    it('should return the value of combatService.isActionClicked', () => {
        actionServiceMock.isActionClicked = true;
        expect(component.isActionClicked).toBeTrue();

        actionServiceMock.isActionClicked = false;
        expect(component.isActionClicked).toBeFalse();
    });

    describe('isTeamMember', () => {
        it('should return false if there is no player at the given position', () => {
            component['_grid'] = {
                board: [[{ tile: TileTypes.Default }]],
            } as Grid;
            gameModeServiceMock.isTeamGameMode.and.returnValue(true);

            expect(component.isTeamMember(0, 0)).toBeFalse();
        });

        it('should return false if game mode is not CTF', () => {
            const mockPlayer = { id: 'player1' };
            component['_grid'] = {
                board: [[{ tile: TileTypes.Default, player: mockPlayer }]],
            } as Grid;
            gameModeServiceMock.isTeamGameMode.and.returnValue(false);

            expect(component.isTeamMember(0, 0)).toBeFalse();
        });

        it('should return true if player is part of own team in CTF mode', () => {
            const mockPlayer = { id: 'player1' };
            component['_grid'] = {
                board: [[{ tile: TileTypes.Default, player: mockPlayer }]],
            } as Grid;
            gameModeServiceMock.isTeamGameMode.and.returnValue(true);
            gameModeServiceMock.isPartOfOwnTeam.and.returnValue(true);

            expect(component.isTeamMember(0, 0)).toBeTrue();
        });

        it('should return false if player is not part of own team in CTF mode', () => {
            const mockPlayer = { id: 'player2' };
            component['_grid'] = {
                board: [[{ tile: TileTypes.Default, player: mockPlayer }]],
            } as Grid;
            gameModeServiceMock.isTeamGameMode.and.returnValue(true);
            gameModeServiceMock.isPartOfOwnTeam.and.returnValue(false);

            expect(component.isTeamMember(0, 0)).toBeFalse();
        });
    });

    describe('showFlagHolder', () => {
        it('should call gameModeService.showFlagHolder with the player and return its value', () => {
            const mockPlayer = { id: 'player1', avatar: 'avatar1' } as Player;
            const expectedResult = true;

            gameModeServiceMock.showFlagHolder.and.returnValue(expectedResult);

            const result = component.showFlagHolder(mockPlayer);

            expect(gameModeServiceMock.showFlagHolder).toHaveBeenCalledWith(mockPlayer);
            expect(result).toBe(expectedResult);
        });

        it('should handle undefined player input', () => {
            const expectedResult = false;

            gameModeServiceMock.showFlagHolder.and.returnValue(expectedResult);

            const result = component.showFlagHolder(undefined);

            expect(gameModeServiceMock.showFlagHolder).toHaveBeenCalledWith(undefined);
            expect(result).toBe(expectedResult);
        });
    });
});
