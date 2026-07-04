import { TestBed } from '@angular/core/testing';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { GameModes, TileTypes } from '@common/enums';
import { ActiveGameEvents, CTFEvents, GameRoomEvents } from '@common/gateway-events';
import { BoardCell, FlagCapturedPayload, FlagHolderPayload, Player, Team } from '@common/interfaces';
import { BehaviorSubject } from 'rxjs';
import { GameModeService } from './game-mode.service';

describe('GameModeService', () => {
    let service: GameModeService;
    let socketServiceSpy: jasmine.SpyObj<SocketService>;
    let playerServiceSpy: jasmine.SpyObj<PlayerService>;

    const mockPlayer: Player = MOCK_PLAYERS[0];
    const mockPlayer2: Player = MOCK_PLAYERS[1];

    const mockTeams: Team[] = [
        { players: [mockPlayer], isOwnTeam: false, id: '1', color: '#ef4444', icon: '🔥' },
        { players: [mockPlayer2], isOwnTeam: false, id: '2', color: '#3b82f6', icon: '❄️' },
    ];

    beforeEach(() => {
        playerServiceSpy = jasmine.createSpyObj('PlayerService', [], {
            player: mockPlayer,
            roomId: 'test-room',
        });
        socketServiceSpy = jasmine.createSpyObj('SocketService', ['on', 'off', 'sendMessage']);

        TestBed.configureTestingModule({
            providers: [
                GameModeService,
                { provide: PlayerService, useValue: playerServiceSpy },
                { provide: SocketService, useValue: socketServiceSpy },
            ],
        });

        service = TestBed.inject(GameModeService);
        socketServiceSpy = TestBed.inject(SocketService) as jasmine.SpyObj<SocketService>;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Properties', () => {
        it('should have default properties', () => {
            expect(service.gameMode).toBeUndefined();
            expect(service.teams).toEqual([]);
            expect(service.flagHolder).toBeUndefined();
        });

        it('should set and get gameMode', () => {
            service.gameMode = GameModes.CTF;
            expect(service.gameMode).toBe(GameModes.CTF);
        });

        it('should set and get flagHolder', () => {
            service.flagHolder = mockPlayer;
            expect(service.flagHolder).toEqual(mockPlayer);
        });
    });

    describe('setTeams', () => {
        it('should set teams correctly', () => {
            service.setTeams(mockTeams);
            expect(service.teams.length).toBe(mockTeams.length);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(service.teams[0].isOwnTeam).toBeTrue();
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(service.teams[1].isOwnTeam).toBeFalse();
        });
    });

    describe('isPartOfOwnTeam', () => {
        beforeEach(() => {
            service.setTeams(mockTeams);
        });

        it('should return true for player in own team', () => {
            expect(service.isPartOfOwnTeam(mockPlayer.id)).toBeTrue();
        });

        it('should return false for player in other team', () => {
            expect(service.isPartOfOwnTeam(mockPlayer2.id)).toBeFalse();
        });
    });

    describe('makeStartingPointGlow', () => {
        it('should return false when flag is not taken', () => {
            service['_isFlagTaken'] = false;
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            for (let x = 1; x < 11; x += 1) {
                // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                for (let y = 1; y < 11; y += 1) {
                    expect(service.makeStartingPointGlow(x, y)).toBeFalse();
                }
            }
        });

        it('should return true when coordinates match flag goal', () => {
            service['_isFlagTaken'] = true;
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            service['_flagGoal'] = { x: 1, y: 1 };
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(service.makeStartingPointGlow(1, 1)).toBeTrue();
        });

        it('should return false when coordinates do not match flag goal', () => {
            service['_isFlagTaken'] = true;
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            service['_flagGoal'] = { x: 1, y: 1 };
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(service.makeStartingPointGlow(2, 2)).toBeFalse();
        });
    });

    describe('showFlagHolder', () => {
        it('should return false when player is undefined', () => {
            expect(service.showFlagHolder(undefined)).toBeFalse();
        });

        it('should return false when flag holder is not set', () => {
            expect(service.showFlagHolder(mockPlayer)).toBeFalse();
        });

        it('should return true when player is flag holder', () => {
            service.flagHolder = mockPlayer;
            expect(service.showFlagHolder(mockPlayer)).toBeTrue();
        });

        it('should return false when player is not flag holder', () => {
            service.flagHolder = { ...mockPlayer, id: 'otherPlayer' };
            expect(service.showFlagHolder(mockPlayer)).toBeFalse();
        });
    });

    describe('isCtf', () => {
        it('should return false when game mode is not CTF', () => {
            service.gameMode = GameModes.Classic;
            expect(service.isCtf()).toBeFalse();
        });

        it('should return true when game mode is CTF and teams are set', () => {
            service.gameMode = GameModes.CTF;
            service.setTeams(mockTeams);
            expect(service.isCtf()).toBeTrue();
        });
    });

    describe('onInit', () => {
        it('should set up CTF listeners when game mode is CTF', () => {
            service.gameMode = GameModes.CTF;
            service.onInit();
            expect(socketServiceSpy.on).toHaveBeenCalledWith(CTFEvents.FlagTaken, jasmine.any(Function));
            expect(socketServiceSpy.on).toHaveBeenCalledWith(CTFEvents.FlagDropped, jasmine.any(Function));
            expect(socketServiceSpy.on).toHaveBeenCalledWith(CTFEvents.FlagCaptured, jasmine.any(Function));
            expect(service['_isInitialised']).toBeTrue();
        });

        it('should always register the UpdateTeams listener regardless of game mode', () => {
            service.gameMode = GameModes.Classic;
            service.onInit();
            expect(socketServiceSpy.on).toHaveBeenCalledWith(GameRoomEvents.UpdateTeams, jasmine.any(Function));
        });

        it('should not set up CTF listeners when game mode is not CTF', () => {
            service.gameMode = GameModes.Classic;
            service.onInit();
            expect(socketServiceSpy.on).not.toHaveBeenCalledWith(CTFEvents.FlagTaken, jasmine.any(Function));
            expect(socketServiceSpy.on).not.toHaveBeenCalledWith(CTFEvents.FlagDropped, jasmine.any(Function));
            expect(socketServiceSpy.on).not.toHaveBeenCalledWith(CTFEvents.FlagCaptured, jasmine.any(Function));
        });

        it('should not set up CTF listeners when already initialized', () => {
            service.gameMode = GameModes.CTF;
            service['_isInitialised'] = true;
            socketServiceSpy.on.calls.reset();
            service.onInit();
            expect(socketServiceSpy.on).not.toHaveBeenCalledWith(CTFEvents.FlagTaken, jasmine.any(Function));
            expect(socketServiceSpy.on).not.toHaveBeenCalledWith(CTFEvents.FlagDropped, jasmine.any(Function));
            expect(socketServiceSpy.on).not.toHaveBeenCalledWith(CTFEvents.FlagCaptured, jasmine.any(Function));
        });
    });

    describe('CTF Event Listeners', () => {
        function getCallback<T>(eventName: string): (data: T) => void {
            const call = socketServiceSpy.on.calls.all().find((c) => c.args[0] === eventName);
            if (!call) throw new Error(`No listener registered for ${eventName}`);
            return call.args[1] as (data: T) => void;
        }

        beforeEach(() => {
            service.gameMode = GameModes.CTF;
            service.onInit();
        });

        it('should handle FlagTaken event', () => {
            const flagHolderPayload: FlagHolderPayload = { flagHolder: mockPlayer };
            const callback = getCallback<FlagHolderPayload>(CTFEvents.FlagTaken);
            callback(flagHolderPayload);

            expect(service['_isFlagTaken']).toBeTrue();
            expect(service['_flagGoal']).toEqual(mockPlayer.startingPoint);
            expect(service['_flagHolder']).toEqual(mockPlayer);
        });

        it('should handle FlagDropped event', () => {
            service['_isFlagTaken'] = true;
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            service['_flagGoal'] = { x: 1, y: 1 };
            service['_flagHolder'] = mockPlayer;

            const callback = getCallback<void>(CTFEvents.FlagDropped);
            callback(undefined as unknown as void);

            expect(service['_isFlagTaken']).toBeFalse();
            expect(service['_flagGoal']).toBeUndefined();
            expect(service['_flagHolder']).toBeUndefined();
        });

        it('should handle FlagCaptured event', () => {
            const flagCapturedPayload: FlagCapturedPayload = { winningTeam: [mockPlayer] };
            const callback = getCallback<FlagCapturedPayload>(CTFEvents.FlagCaptured);
            callback(flagCapturedPayload);

            expect(service['_isFlagTaken']).toBeFalse();
            expect(service['_winningTeamSubject'].value).toEqual([mockPlayer]);
        });
    });

    describe('onReset', () => {
        beforeEach(() => {
            service.gameMode = GameModes.CTF;
            service.setTeams(mockTeams);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            service['_flagGoal'] = { x: 1, y: 1 };
            service['_flagHolder'] = mockPlayer;
            service['_isFlagTaken'] = true;
            service['_isInitialised'] = true;
            service['_winningTeamSubject'].next([mockPlayer]);
        });

        it('should reset all properties', () => {
            service.onReset();

            expect(service['_teams']).toEqual([]);
            expect(service['_flagGoal']).toBeUndefined();
            expect(service['_flagHolder']).toBeUndefined();
            expect(service['_isFlagTaken']).toBeFalse();
            expect(service['_isInitialised']).toBeFalse();
            expect(service['_winningTeamSubject'].value).toEqual([]);
            expect(socketServiceSpy.off).toHaveBeenCalledWith(CTFEvents.FlagTaken);
            expect(socketServiceSpy.off).toHaveBeenCalledWith(CTFEvents.FlagDropped);
            expect(socketServiceSpy.off).toHaveBeenCalledWith(CTFEvents.FlagCaptured);
        });
    });

    describe('winningTeamSubject', () => {
        it('should return the winning team BehaviorSubject', () => {
            const mockWinningTeam: Player[] = [mockPlayer];
            service['_winningTeamSubject'].next(mockWinningTeam);

            const winningTeamSubject = service.winningTeamSubject;
            expect(winningTeamSubject).toBeInstanceOf(BehaviorSubject);
            expect(winningTeamSubject.value).toEqual(mockWinningTeam);
        });
    });

    describe('sendMap', () => {
        const mockBoard: BoardCell[][] = [
            [
                {
                    tile: TileTypes.Water,
                    item: { name: 'item1', description: 'description1' },
                },
            ],
        ];

        beforeEach(() => {
            (Object.getOwnPropertyDescriptor(playerServiceSpy, 'roomId')?.get as jasmine.Spy).and.returnValue('test-room');
        });

        it('should send map with current roomId and correct event type', () => {
            service.sendMap(mockBoard);

            expect(socketServiceSpy.sendMessage).toHaveBeenCalledWith(ActiveGameEvents.MapRequest, {
                roomId: 'test-room',
                map: mockBoard,
            });
        });

        it('should send the exact map data provided', () => {
            const customMap: BoardCell[][] = [
                [
                    {
                        tile: TileTypes.Default,
                        item: { name: 'special-item', description: 'special-desc' },
                    },
                ],
            ];

            service.sendMap(customMap);

            const sentData = socketServiceSpy.sendMessage.calls.mostRecent().args[1] as { roomId: string; map: BoardCell[][] };
            expect(sentData.map).toBe(customMap);
            expect(sentData.map[0][0].item.name).toBe('special-item');
        });

        it('should use the current roomId from playerService', () => {
            (Object.getOwnPropertyDescriptor(playerServiceSpy, 'roomId')?.get as jasmine.Spy).and.returnValue('different-room');

            service.sendMap(mockBoard);

            const sentData = socketServiceSpy.sendMessage.calls.mostRecent().args[1] as { roomId: string; map: BoardCell[][] };
            expect(sentData.roomId).toBe('different-room');
        });
    });
});
