/* eslint-disable max-lines */
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActiveClick } from '@app/interfaces/active-grid-interfaces';
import { AlertService } from '@app/services/alert/alert.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerMovementService } from '@app/services/player-mouvement/player-movement.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { GAME_DATA, MOCK_PLAYERS } from '@common/constants.spec';
import { ItemTypes, TileTypes } from '@common/enums';
import { ActiveGameEvents, DebugEvents } from '@common/gateway-events';
import { BoardCell, DebugResponse, Grid, Path, Player, PlayerNextPosition, Stats } from '@common/interfaces';
import { Position } from '@common/types';
import { BehaviorSubject, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { ActiveGridService } from './active-grid.service';

describe('ActiveGridService', () => {
    let service: ActiveGridService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;
    let playerMovementServiceMock: jasmine.SpyObj<PlayerMovementService>;
    let routerMock: jasmine.SpyObj<Router>;
    let turnServiceMock: jasmine.SpyObj<TurnService>;
    let gameModeServiceMock: jasmine.SpyObj<GameModeService>;
    let mockGrid: Grid = JSON.parse(JSON.stringify(GAME_DATA)) as Grid;
    const mockPlayer = JSON.parse(JSON.stringify(MOCK_PLAYERS[0]));
    const mockSpeed = 5;
    const iceMockTile = TileTypes.Ice;

    beforeEach(() => {
        const socketSpy = jasmine.createSpyObj('SocketService', ['sendMessage', 'on', 'off', 'disconnect', 'isConnected', 'getSocketId']);
        socketSpy.isConnected.and.returnValue(new BehaviorSubject(true));

        const playerMovementSpy = jasmine.createSpyObj('PlayerMovementService', [
            'getShortestPath',
            'isValidMove',
            'getReachableTiles',
            'movePlayer',
            'getIsIceAdjacent',
        ]);
        const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'getCurrentNavigation']);
        const turnServiceSpy = jasmine.createSpyObj('TurnService', ['init', 'ngOnDestroy', 'alert', 'isMyTurn', 'getQuittingPlayerId']);
        const alertServiceSpy = jasmine.createSpyObj('AlertService', ['alert', 'notify']);
        const gameModeServiceSpy = jasmine.createSpyObj('GameModeService', [
            'showFlagHolder',
            'makeStartingPointGlow',
            'onReset',
            'isCtf',
            'isPartOfOwnTeam',
            'sendMap',
        ]);

        Object.defineProperty(turnServiceSpy, 'playerId', {
            value: 'player1',
            writable: true,
            configurable: true,
        });
        Object.defineProperty(turnServiceSpy, 'blockPlaying', {
            value: false,
            writable: true,
            configurable: true,
        });

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                ActiveGridService,
                { provide: SocketService, useValue: socketSpy },
                { provide: PlayerMovementService, useValue: playerMovementSpy },
                { provide: Router, useValue: routerSpy },
                { provide: TurnService, useValue: turnServiceSpy },
                { provide: AlertService, useValue: alertServiceSpy },
                { provide: GameModeService, useValue: gameModeServiceSpy },
            ],
        });

        service = TestBed.inject(ActiveGridService);
        socketServiceMock = TestBed.inject(SocketService) as jasmine.SpyObj<SocketService>;
        playerMovementServiceMock = TestBed.inject(PlayerMovementService) as jasmine.SpyObj<PlayerMovementService>;
        routerMock = TestBed.inject(Router) as jasmine.SpyObj<Router>;
        turnServiceMock = TestBed.inject(TurnService) as jasmine.SpyObj<TurnService>;
        gameModeServiceMock = TestBed.inject(GameModeService) as jasmine.SpyObj<GameModeService>;

        service['_roomId'] = 'test-room';
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('init', () => {
        it('should call the init method of TurnService', () => {
            if (!Object.prototype.hasOwnProperty.call(turnServiceMock.init, 'and')) {
                spyOn(turnServiceMock, 'init');
            }
            service.init();
            expect(turnServiceMock.init).toHaveBeenCalled();
        });
    });

    describe('ActiveGridService Properties', () => {
        it('should return the correct value for isDebug getter', () => {
            service['_isDebug'] = true;
            expect(service.isDebug).toBeTrue();
        });

        it('should return the correct value for canStillMove getter', () => {
            service['_canStillMove'].next(false);
            expect(service.canStillMove.value).toBeFalse();
        });

        it('should set the _isDebug property correctly using the isDebug setter', () => {
            service.isDebug = true;
            expect(service['_isDebug']).toBeTrue();
        });
    });

    describe('roomId getter', () => {
        it('should return the current roomId', () => {
            const testRoomId = 'test-room-123';
            service['_roomId'] = testRoomId;

            const result = service.roomId;

            expect(result).toBe(testRoomId);
        });
    });

    describe('isCTF', () => {
        it('should return true when gameModeService.isCtf() returns true', () => {
            gameModeServiceMock.isCtf.and.returnValue(true);

            const result = service.isCTF();

            expect(result).toBeTrue();
            expect(gameModeServiceMock.isCtf).toHaveBeenCalled();
        });

        it('should return false when gameModeService.isCtf() returns false', () => {
            gameModeServiceMock.isCtf.and.returnValue(false);

            const result = service.isCTF();

            expect(result).toBeFalse();
            expect(gameModeServiceMock.isCtf).toHaveBeenCalled();
        });

        it('should reflect changes in game mode service', () => {
            gameModeServiceMock.isCtf.and.returnValue(false);
            expect(service.isCTF()).toBeFalse();

            gameModeServiceMock.isCtf.and.returnValue(true);
            expect(service.isCTF()).toBeTrue();

            expect(gameModeServiceMock.isCtf).toHaveBeenCalledTimes(2);
        });
    });

    it('should handle hover events correctly', () => {
        const mockPosition: Position = { x: 0, y: 0 };
        const mockPath: Path = { positions: [mockPosition], cost: 0, turns: 0 };

        service['_gridSubject'].next(mockGrid);
        service['_selectedPlayer'] = mockPlayer;
        service['_isMoving'] = false;

        playerMovementServiceMock.getShortestPath.and.returnValue(mockPath);
        playerMovementServiceMock.highlightedPath = mockPath;
        service.handleHovered(mockPosition);
        expect(playerMovementServiceMock.getShortestPath).toHaveBeenCalledWith(service['_gridSubject'], mockPlayer, mockPosition);
        expect(playerMovementServiceMock.highlightedPath).toEqual(mockPath);

        service.handleUnhovered();
        expect(playerMovementServiceMock.highlightedPath).toEqual({ positions: [], cost: 0, turns: 0 });

        service['_isMoving'] = true;
        playerMovementServiceMock.highlightedPath = mockPath;
        service.handleUnhovered();
        expect(playerMovementServiceMock.highlightedPath).toEqual(mockPath);
    });

    it('should deselect player correctly', () => {
        service['_selectedPlayer'] = mockPlayer;
        service['_selectedPosition'] = { x: 0, y: 0 };

        service.deselectPlayer();
        expect(service['_selectedPlayer']).toBeUndefined();
        expect(service['_selectedPosition']).toBeUndefined();
        expect(playerMovementServiceMock.reachableTiles).toEqual([]);
        expect(playerMovementServiceMock.highlightedPath).toEqual({ positions: [], cost: 0, turns: 0 });
    });

    it('should reset the service correctly', () => {
        service['_gridSubject'].next(mockGrid);
        service['_selectedPlayer'] = MOCK_PLAYERS[0];
        service['_selectedPosition'] = { x: 0, y: 0 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        routerMock.getCurrentNavigation.and.returnValue({ finalUrl: { toString: () => '/loading/' } } as any);

        service.reset();
        expect(service['_gridSubject'].value).toBeUndefined();
        expect(service['_selectedPlayer']).toBeUndefined();
        expect(service['_selectedPosition']).toBeUndefined();
        expect(socketServiceMock.disconnect).toHaveBeenCalled();
        expect(turnServiceMock.ngOnDestroy).toHaveBeenCalled();
    });

    it('should remove listeners on destroy', () => {
        service.ngOnDestroy();
        expect(socketServiceMock.off).toHaveBeenCalledWith(ActiveGameEvents.PlayerStartedMoving);
        expect(socketServiceMock.off).toHaveBeenCalledWith(ActiveGameEvents.PlayerNextPosition);
        expect(socketServiceMock.off).toHaveBeenCalledWith(ActiveGameEvents.PlayerStoppedMoving);
        expect(socketServiceMock.off).toHaveBeenCalledWith(DebugEvents.ToggleDebug);
    });

    describe('grid$ getter', () => {
        it('should return the observable for the grid', (done) => {
            service['_gridSubject'].next(mockGrid);

            service.grid$.pipe(take(1)).subscribe((grid) => {
                expect(grid).toEqual(mockGrid);
                done();
            });
        });
    });

    describe('moveSelectedPlayer', () => {
        beforeEach(() => {
            service['_roomId'] = 'test-room';
            service['_gridSubject'].next(mockGrid);
            service['_selectedPlayer'] = mockPlayer;
            service['_selectedPosition'] = { x: 0, y: 0 };
        });

        it('should send move message when both selectedPlayer and selectedPosition are defined', () => {
            const mockPath: Path = { positions: [{ x: 0, y: 0 }], cost: 0, turns: 0 };

            service.moveSelectedPlayer(mockPath);

            expect(socketServiceMock.sendMessage).toHaveBeenCalledWith(
                ActiveGameEvents.MovePlayer,
                jasmine.objectContaining({
                    roomId: 'test-room',
                    grid: mockGrid,
                    player: mockPlayer,
                    path: mockPath,
                }),
            );
        });

        it('should return early when _selectedPlayer is undefined', () => {
            service['_selectedPlayer'] = undefined;
            const mockPath: Path = { positions: [{ x: 0, y: 0 }], cost: 0, turns: 0 };

            service.moveSelectedPlayer(mockPath);

            expect(socketServiceMock.sendMessage).not.toHaveBeenCalled();
        });

        it('should return early when _selectedPosition is undefined', () => {
            service['_selectedPosition'] = undefined;
            const mockPath: Path = { positions: [{ x: 0, y: 0 }], cost: 0, turns: 0 };

            service.moveSelectedPlayer(mockPath);

            expect(socketServiceMock.sendMessage).not.toHaveBeenCalled();
        });

        it('should return early when both _selectedPlayer and _selectedPosition are undefined', () => {
            service['_selectedPlayer'] = undefined;
            service['_selectedPosition'] = undefined;
            const mockPath: Path = { positions: [{ x: 0, y: 0 }], cost: 0, turns: 0 };

            service.moveSelectedPlayer(mockPath);

            expect(socketServiceMock.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('handleClick', () => {
        beforeEach(() => {
            service['_roomId'] = 'test-room';
            service['_gridSubject'].next(mockGrid);
            service['_selectedPlayer'] = mockPlayer;
            service['_selectedPosition'] = { x: 0, y: 0 };
        });

        it('should handle left-click events correctly', () => {
            const mockPosition: Position = { x: 0, y: 0 };
            const mockPath: Path = { positions: [mockPosition], cost: 0, turns: 0 };

            playerMovementServiceMock.getShortestPath.and.returnValue(mockPath);

            const activeClick: ActiveClick = {
                grid: mockGrid,
                position: mockPosition,
                event: { button: 0 } as MouseEvent,
            };

            service.handleClick(activeClick);

            expect(playerMovementServiceMock.getShortestPath).toHaveBeenCalledWith(service['_gridSubject'], mockPlayer, mockPosition);

            expect(socketServiceMock.sendMessage).toHaveBeenCalledWith(
                ActiveGameEvents.MovePlayer,
                jasmine.objectContaining({
                    roomId: 'test-room',
                    grid: mockGrid,
                    player: mockPlayer,
                    path: mockPath,
                }),
            );
        });

        it('should handle debug right-click events correctly', () => {
            const mockPosition: Position = { x: 0, y: 0 };
            const mockPath: Path = { positions: [mockPosition], cost: 0, turns: 0 };

            service['_isDebug'] = true;
            playerMovementServiceMock.isValidMove.and.returnValue(true);
            playerMovementServiceMock.getShortestPath.and.returnValue(mockPath);

            const activeClick: ActiveClick = {
                grid: mockGrid,
                position: mockPosition,
                event: { button: 2, stopPropagation: jasmine.createSpy() } as unknown as MouseEvent,
            };

            service.handleClick(activeClick);

            expect(socketServiceMock.sendMessage).toHaveBeenCalledWith(
                ActiveGameEvents.MovePlayer,
                jasmine.objectContaining({
                    roomId: 'test-room',
                    grid: mockGrid,
                    player: mockPlayer,
                    path: mockPath,
                    isRightClick: true,
                }),
            );
        });

        it('should return the player on right-click if the cell contains a player', () => {
            const position: Position = { x: 0, y: 0 };
            mockGrid.board[position.x][position.y].tile = TileTypes.Default;
            mockGrid.board[position.x][position.y].player = mockPlayer;
            const item = mockGrid.board[position.x][position.y].item;

            const activeClick: ActiveClick = {
                grid: mockGrid,
                position,
                event: { button: 2 } as MouseEvent,
            };

            const result = service.handleClick(activeClick);
            expect(result).toEqual({
                player: mockPlayer,
                tile: TileTypes.Default,
                item,
            });
        });

        it('should return the tile on right-click if the cell contains a tile', () => {
            const position: Position = { x: 1, y: 1 };
            mockGrid.board[position.x][position.y].tile = iceMockTile;
            const item = mockGrid.board[position.x][position.y].item;

            const activeClick: ActiveClick = {
                grid: mockGrid,
                position,
                event: { button: 2 } as MouseEvent,
            };

            const result = service.handleClick(activeClick);
            expect(result).toEqual({
                player: undefined,
                tile: iceMockTile,
                item,
            });
        });

        it('should return Default TileType on right-click if the cell is empty', () => {
            const position: Position = { x: 1, y: 1 };
            mockGrid.board[position.x][position.y].player = undefined;
            mockGrid.board[position.x][position.y].tile = TileTypes.Default;
            const item = mockGrid.board[position.x][position.y].item;

            const activeClick: ActiveClick = {
                grid: mockGrid,
                position,
                event: { button: 2 } as MouseEvent,
            };

            const result = service.handleClick(activeClick);
            expect(result).toEqual({
                tile: TileTypes.Default,
                player: undefined,
                item,
            });
        });
    });

    describe('getReachableTile', () => {
        it('should return the reachable tile if it exists at the specified position', () => {
            const position: Position = { x: 1, y: 1 };
            const mockReachableTile: Position = { x: 1, y: 1 };
            playerMovementServiceMock.reachableTiles = [mockReachableTile];
            const result = service.getReachableTile(position);
            expect(result).toEqual(mockReachableTile);
        });

        it('should return undefined if no reachable tile exists at the specified position', () => {
            const position: Position = { x: 2, y: 2 };
            playerMovementServiceMock.reachableTiles = [{ x: 1, y: 1 }];
            const result = service.getReachableTile(position);
            expect(result).toBeUndefined();
        });
    });

    describe('getHighlightedTile', () => {
        it('should return the highlighted tile if it exists at the specified position', () => {
            const position: Position = { x: 1, y: 1 };
            const mockHighlightedTile: Position = { x: 1, y: 1 };
            playerMovementServiceMock.highlightedPath = {
                positions: [mockHighlightedTile],
                cost: 0,
                turns: 0,
            };
            const result = service.getHighlightedTile(position);
            expect(result).toEqual(mockHighlightedTile);
        });

        it('should return undefined if no highlighted tile exists at the specified position', () => {
            const position: Position = { x: 2, y: 2 };
            playerMovementServiceMock.highlightedPath = {
                positions: [{ x: 1, y: 1 }],
                cost: 0,
                turns: 0,
            };
            const result = service.getHighlightedTile(position);
            expect(result).toBeUndefined();
        });
    });

    describe('getIsIceAdjacent', () => {
        it('should call getIsIceAdjacent on PlayerMovementService and return the result', () => {
            const mockPlayerLastPosition: Position = { x: 1, y: 1 };
            const mockIsIceAdjacent = true;

            service['_gridSubject'].next(mockGrid);
            Object.defineProperty(turnServiceMock, 'playerLastPosition', {
                get: () => mockPlayerLastPosition,
            });
            playerMovementServiceMock.getIsIceAdjacent.and.returnValue(mockIsIceAdjacent);
            const result = service.getIsIceAdjacent();
            expect(playerMovementServiceMock.getIsIceAdjacent).toHaveBeenCalledWith(service['_gridSubject'], mockPlayerLastPosition);
            expect(result).toBe(mockIsIceAdjacent);
        });
    });

    describe('isOpposingPlayer', () => {
        it('should return true if the player at the position is an opposing player', () => {
            const position: Position = { x: 0, y: 0 };
            mockGrid.board[position.x][position.y].player = mockPlayer;
            service['_gridSubject'].next(mockGrid);
            Object.defineProperty(turnServiceMock, 'playerId', {
                get: () => 'otherId',
                configurable: true,
            });
            const result = service.isOpposingPlayer(position);
            expect(result).toBeTrue();
        });

        it('should return false if the player at the position is the current player', () => {
            const position: Position = { x: 0, y: 0 };
            mockGrid.board[position.x][position.y].player = mockPlayer;
            service['_gridSubject'].next(mockGrid);
            Object.defineProperty(turnServiceMock, 'playerId', {
                get: () => mockPlayer.id,
                configurable: true,
            });
            const result = service.isOpposingPlayer(position);
            expect(result).toBeFalse();
        });

        it('should return false if there is no player at the position', () => {
            const position: Position = { x: 0, y: 0 };
            mockGrid.board[position.x][position.y].player = undefined;
            service['_gridSubject'].next(mockGrid);
            const result = service.isOpposingPlayer(position);
            expect(result).toBeUndefined();
        });
    });

    describe('setUpMovementListeners', () => {
        let findAndSelectPlayerSpy: jasmine.Spy;
        let playerStartedMovingCallback: (data: unknown) => void;
        let playerNextPositionCallback: (data: PlayerNextPosition) => void;
        let playerStoppedMovingCallback: (data: unknown) => void;

        beforeEach(() => {
            service['_isMoving'] = false;

            service['_gridSubject'].next(mockGrid);

            playerMovementServiceMock.movePlayer.and.returnValue(undefined);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            findAndSelectPlayerSpy = spyOn(service as any, 'findAndSelectPlayer');

            socketServiceMock.on.and.callFake(<T>(eventName: string, callback: (data: T) => void) => {
                if (eventName === ActiveGameEvents.PlayerStartedMoving) {
                    playerStartedMovingCallback = callback as () => void;
                } else if (eventName === ActiveGameEvents.PlayerNextPosition) {
                    playerNextPositionCallback = callback as (data: PlayerNextPosition) => void;
                } else if (eventName === ActiveGameEvents.PlayerStoppedMoving) {
                    playerStoppedMovingCallback = callback as () => void;
                }
                return socketServiceMock;
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).setUpMovementListeners();
        });

        it('should set _isMoving to true when PlayerStartedMoving event is triggered', () => {
            playerStartedMovingCallback({});
            expect(service['_isMoving']).toBeTrue();
        });

        it('should call movePlayer and update _canStillMove when PlayerNextPosition event is triggered', async () => {
            const mockNextPosition: Position = { x: 1, y: 1 };
            const mockData: PlayerNextPosition = {
                player: mockPlayer,
                nextPosition: mockNextPosition,
            };

            mockGrid.board[0][0].player = mockPlayer;
            service['_gridSubject'].next(mockGrid);

            service['_selectedPlayer'] = mockPlayer;

            playerMovementServiceMock.movePlayer.and.returnValue(undefined);

            playerMovementServiceMock.reachableTiles = [
                { x: 1, y: 1 },
                { x: 0, y: 1 },
            ];

            mockPlayer.stats = { speed: 1, maxSpeed: 2 } as Stats;

            playerNextPositionCallback(mockData);

            expect(playerMovementServiceMock.movePlayer).toHaveBeenCalledWith(service['_gridSubject'], mockPlayer, mockNextPosition);

            await Promise.resolve();

            expect(service['_canStillMove'].value).toBeTrue();
        });

        describe('PlayerStoppedMoving event', () => {
            it("should call handleHovered with _hoveredPosition when it's defined and player's turn", () => {
                const mockHoveredPosition = { x: 2, y: 3 };
                service['_hoveredPosition'] = mockHoveredPosition;
                service['_isMoving'] = true;
                turnServiceMock.isMyTurn.and.returnValue(true);
                const handleHoveredSpy = spyOn(service, 'handleHovered');

                playerStoppedMovingCallback({});

                expect(service['_isMoving']).toBeFalse();
                expect(findAndSelectPlayerSpy).toHaveBeenCalled();
                expect(handleHoveredSpy).toHaveBeenCalledWith(mockHoveredPosition);
            });

            it('should not call handleHovered when _hoveredPosition is undefined', () => {
                service['_hoveredPosition'] = undefined;
                service['_isMoving'] = true;
                turnServiceMock.isMyTurn.and.returnValue(true);
                const handleHoveredSpy = spyOn(service, 'handleHovered');

                playerStoppedMovingCallback({});

                expect(service['_isMoving']).toBeFalse();
                expect(findAndSelectPlayerSpy).toHaveBeenCalled();
                expect(handleHoveredSpy).not.toHaveBeenCalled();
            });

            it("should not call handleHovered when not player's turn", () => {
                const mockHoveredPosition = { x: 2, y: 3 };
                service['_hoveredPosition'] = mockHoveredPosition;
                service['_isMoving'] = true;
                turnServiceMock.isMyTurn.and.returnValue(false);
                const handleHoveredSpy = spyOn(service, 'handleHovered');

                playerStoppedMovingCallback({});

                expect(service['_isMoving']).toBeFalse();
                expect(findAndSelectPlayerSpy).not.toHaveBeenCalled();
                expect(handleHoveredSpy).not.toHaveBeenCalled();
            });

            it("should toggle _isMoving and call findAndSelectPlayer when PlayerStoppedMoving event triggered and is player's turn", () => {
                service['_isMoving'] = true;
                turnServiceMock.isMyTurn.and.returnValue(true);

                playerStoppedMovingCallback({});

                expect(service['_isMoving']).toBeFalse();
                expect(findAndSelectPlayerSpy).toHaveBeenCalled();
            });

            it("should not call findAndSelectPlayer when PlayerStoppedMoving event is triggered and it is not the player's turn", () => {
                service['_isMoving'] = true;
                turnServiceMock.isMyTurn.and.returnValue(false);

                playerStoppedMovingCallback({});

                expect(service['_isMoving']).toBeFalse();
                expect(findAndSelectPlayerSpy).not.toHaveBeenCalled();
            });
        });

        describe('PlayerNextPosition _canStillMove logic', () => {
            const mockNextPosition: Position = { x: 1, y: 1 };
            const mockData: PlayerNextPosition = {
                player: mockPlayer,
                nextPosition: mockNextPosition,
            };

            beforeEach(() => {
                mockGrid.board[0][0].player = mockPlayer;
                service['_gridSubject'].next(mockGrid);

                mockPlayer.id = 'current-player';
                Object.defineProperty(turnServiceMock, 'playerId', {
                    get: () => 'current-player',
                });

                playerMovementServiceMock.movePlayer.and.returnValue(undefined);

                socketServiceMock.on.and.callFake(<T>(eventName: string, callback: (data: T) => void) => {
                    if (eventName === ActiveGameEvents.PlayerNextPosition) {
                        playerNextPositionCallback = callback as (data: PlayerNextPosition) => void;
                    }
                    return socketServiceMock;
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (service as any).setUpMovementListeners();
            });

            it('should set _canStillMove to true when player has speed remaining', async () => {
                mockPlayer.stats = { speed: 1 } as Stats;
                playerMovementServiceMock.reachableTiles = [];

                playerNextPositionCallback(mockData);
                await Promise.resolve();

                expect(service['_canStillMove'].value).toBeTrue();
            });

            it('should set _canStillMove to true when player has exactly one reachable tile that is not current position', async () => {
                mockPlayer.stats = { speed: 0 } as Stats;
                playerMovementServiceMock.reachableTiles = [{ x: 1, y: 1 }];
                spyOn(service, 'getPlayerPosition').and.returnValue({ x: 0, y: 0 });

                playerNextPositionCallback(mockData);
                await Promise.resolve();

                expect(service['_canStillMove'].value).toBeTrue();
            });

            it('should set _canStillMove to false when player has no speed and no reachable tiles', async () => {
                mockPlayer.stats = { speed: 0 } as Stats;
                playerMovementServiceMock.reachableTiles = [];

                playerNextPositionCallback(mockData);
                await Promise.resolve();

                expect(service['_canStillMove'].value).toBeFalse();
            });

            it('should set _canStillMove to false when only reachable tile is current position', async () => {
                mockPlayer.stats = { speed: 0 } as Stats;

                const currentPosition = { x: 0, y: 0 };
                playerMovementServiceMock.reachableTiles = [currentPosition];

                spyOn(service, 'getPlayerPosition').and.returnValue(currentPosition);

                service['_canStillMove'].next(true);

                playerNextPositionCallback(mockData);
                await Promise.resolve();

                expect(service['_canStillMove'].value).toBeFalse();
            });

            it('should not update _canStillMove when player is not current player', async () => {
                mockPlayer.id = 'other-player1';
                const initialValue = false;
                service['_canStillMove'].next(initialValue);

                playerNextPositionCallback(mockData);
                await Promise.resolve();

                expect(service['_canStillMove'].value).toBe(initialValue);
            });
        });
    });

    describe('findAndSelectPlayer', () => {
        // eslint-disable-next-line max-lines
        beforeEach(() => {
            mockGrid = JSON.parse(JSON.stringify(GAME_DATA));
            service['_gridSubject'].next(mockGrid);
            Object.defineProperty(turnServiceMock, 'playerId', {
                value: mockPlayer.id,
                writable: true,
            });
        });

        it('should do nothing if the grid is null or undefined', () => {
            service['_gridSubject'].next(undefined);
            service.findAndSelectPlayer();

            expect(service['_selectedPlayer']).toBeUndefined();
            expect(service['_selectedPosition']).toBeUndefined();
        });

        it('should call selectPlayer with the correct position if the player is found on the grid', () => {
            mockGrid.board[0][0].player = mockPlayer;
            service['_gridSubject'].next(mockGrid);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const selectPlayerSpy = spyOn(service as any, 'selectPlayer');
            service.findAndSelectPlayer();

            expect(selectPlayerSpy).toHaveBeenCalledWith({ x: 0, y: 0 });
        });

        it('should do nothing if the player is not found on the grid', () => {
            mockGrid.board.forEach((row) => row.forEach((cell) => (cell.player = undefined)));
            service['_gridSubject'].next(mockGrid);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const selectPlayerSpy = spyOn(service as any, 'selectPlayer');
            service.findAndSelectPlayer();

            expect(selectPlayerSpy).not.toHaveBeenCalled();
        });

        it('should set maxSpeed, reset speed on first move, and call getReachableTiles', () => {
            const player = {
                ...mockPlayer,
                stats: { speed: mockSpeed, maxSpeed: undefined } as Stats,
            } as Player;

            const emptyCell = { tile: TileTypes.Default, player: undefined };

            const playerCell = {
                tile: TileTypes.Default,
                player,
            } as BoardCell;

            const grid = {
                ...mockGrid,
                board: [
                    [playerCell, emptyCell],
                    [emptyCell, emptyCell],
                ],
            } as Grid;

            Object.defineProperty(service, '_gridSubject', { value: new BehaviorSubject<Grid | undefined>(grid), writable: true });

            playerMovementServiceMock.getReachableTiles.and.returnValue(undefined);

            service['selectPlayer']({ x: 0, y: 0 });

            if (player.stats) {
                expect(player.stats.maxSpeed).toBe(mockSpeed);
                expect(player.stats.speed).toBe(mockSpeed);
            }

            expect(service['_selectedPlayer']).toBe(player);
            expect(service['_selectedPosition']).toEqual({ x: 0, y: 0 });

            expect(playerMovementServiceMock.getReachableTiles).toHaveBeenCalledWith(service['_gridSubject'], player);
        });

        it('should not reset speed if it is not the first move', () => {
            const player = {
                ...mockPlayer,
                stats: { speed: mockSpeed, maxSpeed: 6 } as Stats,
            } as Player;

            const emptyCell = { tile: TileTypes.Default, player: undefined };

            const playerCell = {
                tile: TileTypes.Default,
                player,
            } as BoardCell;

            const grid = {
                ...mockGrid,
                board: [
                    [playerCell, emptyCell],
                    [emptyCell, emptyCell],
                ],
            } as Grid;

            Object.defineProperty(service, '_gridSubject', { value: new BehaviorSubject<Grid | undefined>(grid), writable: true });

            playerMovementServiceMock.getReachableTiles.and.returnValue(undefined);

            service['isFirstMove'] = false;

            service['selectPlayer']({ x: 0, y: 0 });

            if (player.stats) expect(player.stats.speed).toBe(mockSpeed);

            expect(service['_selectedPlayer']).toBe(player);
            expect(service['_selectedPosition']).toEqual({ x: 0, y: 0 });

            expect(playerMovementServiceMock.getReachableTiles).toHaveBeenCalledWith(service['_gridSubject'], player);
        });
    });

    describe('selectPlayer', () => {
        const mockPosition: Position = { x: 0, y: 0 };

        beforeEach(() => {
            mockGrid = JSON.parse(JSON.stringify(GAME_DATA));
            mockGrid.board[0][0].player = mockPlayer;

            service['_gridSubject'].next(mockGrid);

            service['_selectedPlayer'] = undefined;
            service['_selectedPosition'] = undefined;
        });

        it('should do nothing if the grid is null or undefined', () => {
            service['_gridSubject'].next(undefined);

            service['selectPlayer'](mockPosition);

            expect(service['_selectedPlayer']).toBeUndefined();
            expect(service['_selectedPosition']).toBeUndefined();
            expect(playerMovementServiceMock.getReachableTiles).not.toHaveBeenCalled();
        });

        it('should do nothing if the cell does not have a player', () => {
            mockGrid.board[0][0].player = undefined;
            service['_gridSubject'].next(mockGrid);

            service['selectPlayer'](mockPosition);

            expect(service['_selectedPlayer']).toBeUndefined();
            expect(service['_selectedPosition']).toBeUndefined();
            expect(playerMovementServiceMock.getReachableTiles).not.toHaveBeenCalled();
        });

        it('should do nothing if the cell has a player but no stats', () => {
            mockGrid.board[0][0].player = { id: 'player1' } as Player;
            service['_gridSubject'].next(mockGrid);

            service['selectPlayer'](mockPosition);

            expect(service['_selectedPlayer']).toBeUndefined();
            expect(service['_selectedPosition']).toBeUndefined();
            expect(playerMovementServiceMock.getReachableTiles).not.toHaveBeenCalled();
        });

        it('should do nothing if _selectedPosition is already set', () => {
            service['_selectedPosition'] = { x: 1, y: 1 };

            service['selectPlayer'](mockPosition);

            expect(service['_selectedPlayer']).toBeUndefined();
            expect(service['_selectedPosition']).toEqual({ x: 1, y: 1 });
            expect(playerMovementServiceMock.getReachableTiles).not.toHaveBeenCalled();
        });
    });

    describe('removeStartingPoint', () => {
        const mockPlayerId = 'player1';
        const mockPlayerTest = { id: mockPlayerId, startingPoint: { x: 0, y: 0 } } as Player;

        beforeEach(() => {
            mockGrid = JSON.parse(JSON.stringify(GAME_DATA));
            service['_gridSubject'].next(mockGrid);
        });

        it('should do nothing if playerId is not provided', () => {
            const gridSpy = spyOn(service['_gridSubject'], 'next');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).removeStartingPoint('');

            expect(gridSpy).not.toHaveBeenCalled();
        });

        it('should do nothing if the grid is null or undefined', () => {
            service['_gridSubject'].next(undefined);
            const gridSpy = spyOn(service['_gridSubject'], 'next');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).removeStartingPoint(mockPlayerId);

            expect(gridSpy).not.toHaveBeenCalled();
        });

        it('should clear the starting point and remove the player if the player is found and has a starting point', () => {
            mockGrid.board[0][0].player = mockPlayerTest;
            mockGrid.board[0][0].item = { name: 'Starting Point', description: 'Player starting position' };
            service['_gridSubject'].next(mockGrid);

            const gridSpy = spyOn(service['_gridSubject'], 'next');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).removeStartingPoint(mockPlayerId);

            expect(mockGrid.board[0][0].item.name).toBe(ItemTypes.UnusedStartingPoint);
            expect(mockGrid.board[0][0].item.description).toBe('');

            expect(mockGrid.board[0][0].player).toBeUndefined();

            expect(gridSpy).toHaveBeenCalledWith(mockGrid);
            expect(gameModeServiceMock.sendMap).toHaveBeenCalledWith(mockGrid.board);
        });

        it('should remove the player from the grid even when startingPoint is missing (drop-out cleanup)', () => {
            const originalItem = { ...mockGrid.board[0][0].item };
            mockGrid.board[0][0].player = { id: mockPlayerId } as Player;
            service['_gridSubject'].next(mockGrid);

            const gridSpy = spyOn(service['_gridSubject'], 'next');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).removeStartingPoint(mockPlayerId);

            expect(mockGrid.board[0][0].player).toBeUndefined();
            expect(mockGrid.board[0][0].item).toEqual(originalItem);
            expect(gridSpy).toHaveBeenCalledWith(mockGrid);
            expect(gameModeServiceMock.sendMap).toHaveBeenCalledWith(mockGrid.board);
        });

        it('should do nothing if the player is not found on the grid', () => {
            mockGrid.board.forEach((row) => row.forEach((cell) => (cell.player = undefined)));
            service['_gridSubject'].next(mockGrid);

            const gridSpy = spyOn(service['_gridSubject'], 'next');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).removeStartingPoint(mockPlayerId);

            expect(gridSpy).not.toHaveBeenCalled();
        });
    });

    describe('checkPlayerPosition', () => {
        it('should return the correct player position when the player is on the grid', () => {
            const emptyCell = { tile: TileTypes.Default, player: undefined } as BoardCell;
            const playerCell = {
                tile: TileTypes.Default,
                player: { id: 'player1', name: 'Player 1', stats: {} as Stats } as Player,
            } as BoardCell;

            const mockGridWithPlayer = {
                board: [
                    [emptyCell, emptyCell],
                    [emptyCell, playerCell],
                ],
            } as Grid;

            Object.defineProperty(service, '_gridSubject', { value: new BehaviorSubject<Grid | undefined>(mockGridWithPlayer), writable: true });

            const playerPosition = service.getPlayerPosition();

            expect(playerPosition).toEqual({ x: 1, y: 1 });
        });

        it('should return { x: -1, y: -1 } when the player is not on the grid', () => {
            const emptyTile = { tile: TileTypes.Default, player: undefined } as BoardCell;
            const mockGridWithoutPlayer: Grid = {
                ...mockGrid,
                board: [
                    [emptyTile, emptyTile],
                    [emptyTile, emptyTile],
                ],
            };

            Object.defineProperty(service, '_gridSubject', { value: new BehaviorSubject<Grid | undefined>(mockGridWithoutPlayer), writable: true });

            const playerPosition = service.getPlayerPosition();

            expect(playerPosition).toEqual({ x: -1, y: -1 });
        });

        it('should return { x: -1, y: -1 } when the grid is null', () => {
            Object.defineProperty(service, '_gridSubject', { value: new BehaviorSubject<Grid | undefined>(undefined), writable: true });

            const playerPosition = service.getPlayerPosition();

            expect(playerPosition).toEqual({ x: -1, y: -1 });
        });
    });

    describe('setLogicListeners', () => {
        let blockPlayingSubject: BehaviorSubject<boolean>;
        let quittingPlayerIdSubject: Subject<string>;
        let toggleDebugCallback: (response: DebugResponse) => void;
        let sendMapListenerCallback: () => void;
        let handleHoveredSpy: jasmine.Spy;

        beforeEach(() => {
            blockPlayingSubject = new BehaviorSubject<boolean>(false);
            Object.defineProperty(turnServiceMock, 'blockPlaying', {
                value: blockPlayingSubject,
                writable: true,
            });

            quittingPlayerIdSubject = new Subject<string>();
            turnServiceMock.getQuittingPlayerId.and.returnValue(quittingPlayerIdSubject);

            socketServiceMock.on.and.callFake(<T>(eventName: string, callback: (data: T) => void) => {
                if (eventName === DebugEvents.ToggleDebug) {
                    toggleDebugCallback = callback as (response: DebugResponse) => void;
                } else if (eventName === ActiveGameEvents.MapRequest) {
                    sendMapListenerCallback = callback as () => void;
                }
                return socketServiceMock;
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'findAndSelectPlayer');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'deselectPlayer');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(service as any, 'removeStartingPoint');
            handleHoveredSpy = spyOn(service, 'handleHovered');

            // setLogicListeners calls this.injector.get(ActionService) which instantiates
            // the real ActionService. Its constructor calls listenForTurnChanges which
            // calls .subscribe() on TurnService.blockPlaying — undefined in this test env.
            // Stub the injector to return a minimal ActionService-like object instead.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockActionService = { onActionConsumed: new Subject<void>() };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn((service as any).injector, 'get').and.returnValue(mockActionService);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (service as any).setLogicListeners();
        });

        it("should set isFirstMove and call findAndSelectPlayer when blockPlaying emits false and it's player's turn", () => {
            turnServiceMock.isMyTurn.and.returnValue(true);
            blockPlayingSubject.next(false);

            expect(service['isFirstMove']).toBeTrue();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).findAndSelectPlayer).toHaveBeenCalled();
        });

        it('should call deselectPlayer when blockPlaying emits true and player is not moving', () => {
            service['_isMoving'] = false;
            blockPlayingSubject.next(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).deselectPlayer).toHaveBeenCalled();
        });

        it('should not call deselectPlayer when blockPlaying emits true and player is moving', () => {
            service['_isMoving'] = true;
            blockPlayingSubject.next(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).deselectPlayer).not.toHaveBeenCalled();
        });

        it('should update _isDebug when ToggleDebug event is triggered', () => {
            const mockResponse: DebugResponse = { isDebug: true };

            toggleDebugCallback(mockResponse);

            expect(service['_isDebug']).toBeTrue();
        });

        it('should call removeStartingPoint when a player quits', () => {
            const mockPlayerId = 'player1';
            quittingPlayerIdSubject.next(mockPlayerId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((service as any).removeStartingPoint).toHaveBeenCalledWith(mockPlayerId);
        });

        it('should call gameModeService.sendMap when MapRequest event is triggered', () => {
            service['_gridSubject'].next(mockGrid);

            sendMapListenerCallback();

            expect(service['gameModeService'].sendMap).toHaveBeenCalledWith(mockGrid.board);
        });

        describe('hover position handling', () => {
            it('should call handleHovered when _hoveredPosition is defined and blockPlaying emits false', () => {
                const mockHoveredPosition = { x: 2, y: 3 };
                service['_hoveredPosition'] = mockHoveredPosition;
                turnServiceMock.isMyTurn.and.returnValue(true);

                blockPlayingSubject.next(false);

                expect(handleHoveredSpy).toHaveBeenCalledWith(mockHoveredPosition);
            });

            it('should not call handleHovered when _hoveredPosition is undefined', () => {
                service['_hoveredPosition'] = undefined;
                turnServiceMock.isMyTurn.and.returnValue(true);

                blockPlayingSubject.next(false);

                expect(handleHoveredSpy).not.toHaveBeenCalled();
            });

            it("should not call handleHovered when not player's turn", () => {
                const mockHoveredPosition = { x: 2, y: 3 };
                service['_hoveredPosition'] = mockHoveredPosition;
                turnServiceMock.isMyTurn.and.returnValue(false);

                blockPlayingSubject.next(false);

                expect(handleHoveredSpy).not.toHaveBeenCalled();
            });
        });
    });
});
