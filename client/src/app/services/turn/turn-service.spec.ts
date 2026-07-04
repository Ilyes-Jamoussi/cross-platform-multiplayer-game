import { TestBed } from '@angular/core/testing';
import { AlertService } from '@app/services/alert/alert.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TimeService } from '@app/services/time/time.service';
import { TURN_DELAY, TURN_TIME } from '@common/constants';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { PlayerState } from '@common/enums';
import { ActiveGameEvents, TimerEvents } from '@common/gateway-events';
import { Player } from '@common/interfaces';
import { BehaviorSubject, of } from 'rxjs';
import { TurnService } from './turn-service';

describe('TurnService', () => {
    let turnService: TurnService;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;
    let mockAlertService: jasmine.SpyObj<AlertService>;
    let mockTimeService: jasmine.SpyObj<TimeService>;
    let mockGameMode: jasmine.SpyObj<GameModeService>;
    let timeSubject: BehaviorSubject<number>;

    const mockPlayer: Player = MOCK_PLAYERS[0];
    const mockRoomId = 'room1';

    const setupMocks = () => {
        mockSocketService = jasmine.createSpyObj('SocketService', ['on', 'sendMessage', 'off']);
        mockPlayerService = jasmine.createSpyObj('PlayerService', [], {
            player: MOCK_PLAYERS[0],
            roomId: mockRoomId,
            avatar: '',
        });
        mockAlertService = jasmine.createSpyObj('AlertService', ['alert', 'notify']);

        timeSubject = new BehaviorSubject<number>(TURN_DELAY);
        mockTimeService = jasmine.createSpyObj('TimeService', ['stopTimer', 'init', 'resetTimer', 'getTimeObservable']);
        mockTimeService.getTimeObservable.and.returnValue(timeSubject.asObservable());
        mockGameMode = jasmine.createSpyObj('GameModeService', ['isPartOfOwnTeam', 'isCtf']);
    };

    const setupService = () => {
        TestBed.configureTestingModule({
            providers: [
                TurnService,
                { provide: SocketService, useValue: mockSocketService },
                { provide: PlayerService, useValue: mockPlayerService },
                { provide: AlertService, useValue: mockAlertService },
                { provide: TimeService, useValue: mockTimeService },
                { provide: GameModeService, useValue: mockGameMode },
            ],
        });
        turnService = TestBed.inject(TurnService);
        turnService.init();
    };

    const triggerTurnUpdate = (player: Player) => {
        const handler = mockSocketService.on.calls.allArgs().find((args) => args[0] === ActiveGameEvents.TurnUpdate)?.[1];
        if (handler) handler({ player });
    };

    const triggerPlayerDisconnect = (quittingPlayerId: string) => {
        const handler = mockSocketService.on.calls.allArgs().find((args) => args[0] === ActiveGameEvents.PlayerDisconnect)?.[1];
        if (handler) handler({ playerId: quittingPlayerId });
    };

    const triggerTimerEnd = (payload: unknown) => {
        const handler = mockSocketService.on.calls.allArgs().find((args) => args[0] === TimerEvents.TimerEnd)?.[1];
        if (handler) handler(payload);
    };

    beforeEach(() => {
        setupMocks();
        setupService();
        turnService['_currentTurn$'].next(MOCK_PLAYERS[0]);
    });

    it('should initially have blockPlaying as false', (done) => {
        turnService.blockPlaying.subscribe((blockPlaying) => {
            expect(blockPlaying).toBe(false);
            done();
        });
    });

    it('should create the TurnService and setup listeners', () => {
        expect(turnService).toBeTruthy();
        expect(mockSocketService.on).toHaveBeenCalledWith(ActiveGameEvents.TurnUpdate, jasmine.any(Function));
        expect(mockSocketService.on).toHaveBeenCalledWith(TimerEvents.TimerEnd, jasmine.any(Function));
    });

    it("should send NextTurn event when nextTurn is called and it is the player's turn", () => {
        triggerTurnUpdate(mockPlayer);
        timeSubject.next(0);
        timeSubject.next(0);
        turnService.nextTurn();
        expect(mockSocketService.sendMessage).toHaveBeenCalledWith(ActiveGameEvents.NextTurn, { roomId: mockRoomId });
    });

    it('should wait for the player to stop moving before sending the NextTurn event', () => {
        turnService['_isPlayerMoving'].next(true);
        const roomId = mockRoomId;

        turnService.nextTurn();

        expect(mockSocketService.sendMessage).not.toHaveBeenCalledWith(ActiveGameEvents.NextTurn, { roomId });

        turnService['_isPlayerMoving'].next(false);

        expect(mockSocketService.sendMessage).toHaveBeenCalledWith(ActiveGameEvents.NextTurn, { roomId });
    });

    it("should not send NextTurn event if it is not the current player's turn", () => {
        turnService['_currentTurn$'].next(MOCK_PLAYERS[1]);

        turnService.nextTurn();
        expect(mockSocketService.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send NextTurn event when current player is spectator', () => {
        Object.defineProperty(mockPlayerService, 'player', {
            get: () => ({ ...MOCK_PLAYERS[0], state: PlayerState.ELIMINATED, isSpectator: true }),
        });
        turnService['_currentTurn$'].next({ ...MOCK_PLAYERS[0] });

        turnService.nextTurn();

        expect(mockSocketService.sendMessage).not.toHaveBeenCalled();
    });

    it("should call nextTurn when TimerEnd event with turnEnd=true is received and it is player's turn", () => {
        triggerTurnUpdate(mockPlayer);
        timeSubject.next(0);
        timeSubject.next(0);

        triggerTimerEnd({ message: 'Time ended', turnEnd: true, roomId: mockRoomId });
        expect(mockSocketService.sendMessage).toHaveBeenCalledWith(ActiveGameEvents.NextTurn, { roomId: mockRoomId });
    });

    it("should not call nextTurn if it is not the current player's turn when TimerEnd is received", () => {
        turnService['_currentTurn$'].next(MOCK_PLAYERS[1]);
        triggerTurnUpdate(MOCK_PLAYERS[1]);
        timeSubject.next(0);
        timeSubject.next(0);

        triggerTimerEnd({ message: 'Time ended', turnEnd: true, roomId: mockRoomId });
        expect(mockSocketService.sendMessage).not.toHaveBeenCalled();
    });

    it('should return the current turn correctly with getCurrentTurn()', (done) => {
        triggerTurnUpdate(MOCK_PLAYERS[1]);
        timeSubject.next(0);
        timeSubject.next(0);

        turnService.getCurrentTurn().subscribe((player) => {
            if (player) {
                expect(player).toEqual(MOCK_PLAYERS[1]);
                done();
            }
        });
    });

    it("should correctly check if it's the current player's turn", () => {
        expect(turnService.isMyTurn()).toBe(true);
    });

    it('should return the blockPlaying observable correctly', (done) => {
        turnService.blockPlaying.subscribe((isBlocked) => {
            expect(isBlocked).toBe(false);
            done();
        });
    });

    it('should unsubscribe from currentTimerSubscription in ngOnDestroy', () => {
        triggerTurnUpdate(MOCK_PLAYERS[1]);

        const unsubscribeSpy = spyOn(turnService['_currentTimerSubscription'], 'unsubscribe');

        turnService.ngOnDestroy();
        expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should return the current player with getPlayer()', () => {
        Object.defineProperty(mockPlayerService, 'player', {
            get: () => mockPlayer,
        });
        Object.defineProperty(mockPlayerService, 'avatar', {
            get: () => mockPlayer.avatar,
        });
        const player = turnService.getPlayer() as Player;
        expect(player).toEqual(mockPlayer);
    });

    it('should reset the timer with TURN_TIME after delay completes', () => {
        triggerTurnUpdate(MOCK_PLAYERS[1]);

        expect(mockTimeService.resetTimer).toHaveBeenCalledWith(TURN_DELAY);

        mockTimeService.resetTimer.calls.reset();

        timeSubject.next(0);
        timeSubject.next(0);

        expect(mockTimeService.resetTimer).toHaveBeenCalledWith(TURN_TIME);
    });

    it('should update quittingPlayerId when a PlayerDisconnect event is received', (done) => {
        triggerPlayerDisconnect(MOCK_PLAYERS[0].id);

        turnService.getQuittingPlayerId().subscribe((id) => {
            if (id) {
                expect(id).toEqual(MOCK_PLAYERS[0].id);
                done();
            }
        });
    });

    it('should call stopTimer on TimeService when freezeTurn is called', () => {
        mockTimeService.stopTimer = jasmine.createSpy('stopTimer');
        turnService.freezeTurn();
        expect(mockTimeService.stopTimer).toHaveBeenCalled();
    });

    it('should start timer with 1 if timeLeft is 0', () => {
        mockTimeService.getTimeObservable.and.returnValue(of(0));
        mockTimeService.startTimer = jasmine.createSpy('startTimer');

        turnService.unfreezeTurn(true);

        expect(mockTimeService.startTimer).toHaveBeenCalledWith(1, true, true);
    });

    it('should call startTimer when unFreezeTurn is called', () => {
        mockTimeService.startTimer = jasmine.createSpy('startTimer');
        turnService.unfreezeTurn(true);
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(mockTimeService.startTimer).toHaveBeenCalledWith(3, true, true);
    });

    it('should set _isPlayerMoving to true when PlayerStartedMoving event is received', () => {
        const handler = mockSocketService.on.calls.allArgs().find((args) => args[0] === ActiveGameEvents.PlayerStartedMoving)?.[1];
        if (handler) {
            handler({});
        }
        expect(turnService['_isPlayerMoving'].value).toBe(true);
    });

    it('should set _isPlayerMoving to false when PlayerStoppedMoving event is received', () => {
        turnService['_isPlayerMoving'].next(true);

        const handler = mockSocketService.on.calls.allArgs().find((args) => args[0] === ActiveGameEvents.PlayerStoppedMoving)?.[1];
        if (handler) {
            handler({});
        }

        expect(turnService['_isPlayerMoving'].value).toBe(false);
    });

    it('should return the current value of _blockPlaying$ with isBlocking', () => {
        turnService['_blockPlaying$'].next(true);
        expect(turnService.isBlocking).toBe(true);

        turnService['_blockPlaying$'].next(false);
        expect(turnService.isBlocking).toBe(false);
    });

    it('should return the current value of _playerLastPosition with playerLastPosition', () => {
        const mockPosition = { x: 10, y: 20 };
        turnService['_playerLastPosition'] = mockPosition;
        expect(turnService.playerLastPosition).toEqual(mockPosition);
    });

    it('should return the player ID from the player service with playerId', () => {
        mockPlayerService.player = { ...MOCK_PLAYERS[0] };
        expect(turnService.playerId).toBe(MOCK_PLAYERS[0].id);
    });

    it('should return the time left from the timeService with timeLeft', () => {
        const mockTime = 30;
        mockTimeService.getTimeObservable.and.returnValue(of(mockTime));
        expect(turnService.timeLeft).toBe(mockTime);
    });

    it('should update _playerLastPosition when PlayerNextPosition event is received', () => {
        const mockNextPosition = { x: 10, y: 20 };
        const mockEventData = { nextPosition: mockNextPosition };
        const handler = mockSocketService.on.calls.allArgs().find((args) => args[0] === ActiveGameEvents.PlayerNextPosition)?.[1];
        if (handler) handler(mockEventData);
        expect(turnService['_playerLastPosition']).toEqual(mockNextPosition);
    });
    it('should return not part of team', () => {
        mockGameMode['isCtf'] = jasmine.createSpy('isCtf').and.returnValue(true);
        mockGameMode['isPartOfOwnTeam'] = jasmine.createSpy('isPartOfOwnTeam').and.returnValue(false);
        expect(turnService.isPartOfOwnTeam(MOCK_PLAYERS[1])).toBeFalse();
    });
    it('should return false if not in CTF', () => {
        mockGameMode.isPartOfOwnTeam.and.returnValue(false);
        expect(turnService.isPartOfOwnTeam(MOCK_PLAYERS[1])).toBeFalse();
    });
});
