import { EventEmitter, Injector } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActionService } from '@app/services/action/action.service';
import { AlertService } from '@app/services/alert/alert.service';
import { PlayerService } from '@app/services/player/player.service';
import { SocketService } from '@app/services/socket/socket.service';
import { TurnService } from '@app/services/turn/turn-service';
import { MOCK_COMBAT_UPDATE, MOCK_PLAYERS, PLAYER_1, PLAYER_2 } from '@common/constants.spec';
import { Actions, CombatResults } from '@common/enums';
import { ActiveGameEvents } from '@common/gateway-events';
import { CombatUpdate, GameDisconnect, Stats } from '@common/interfaces';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { CombatService } from './combat.service';
/* eslint-disable max-lines */

// no-non-null-assertion is disabled for lines that use gameStats, since gameState is
// defined in the main beforeEach with GAME_DATA. The same applies to the turn attribute.
describe('CombatService', () => {
    let combatService: CombatService;
    let playerService: jasmine.SpyObj<PlayerService>;
    let socketService: jasmine.SpyObj<SocketService>;
    let turnService: jasmine.SpyObj<TurnService>;
    let alertService: jasmine.SpyObj<AlertService>;
    let actionService: jasmine.SpyObj<ActionService>;
    let injector: jasmine.SpyObj<Injector>;

    let mockPlayer = MOCK_PLAYERS[0];
    let mockCombatUpdate = MOCK_COMBAT_UPDATE;

    beforeEach(() => {
        mockPlayer = JSON.parse(JSON.stringify(MOCK_PLAYERS[0]));
        mockCombatUpdate = JSON.parse(JSON.stringify(MOCK_COMBAT_UPDATE));

        playerService = jasmine.createSpyObj('PlayerService', ['getPlayers'], {
            player: mockPlayer,
        });
        playerService.getPlayers.and.returnValue(of([mockPlayer]));

        socketService = jasmine.createSpyObj('SocketService', ['sendMessage', 'on', 'off']);

        turnService = jasmine.createSpyObj('TurnService', ['getCurrentTurn', 'isMyTurn', 'nextTurn', 'unfreezeTurn'], {
            onNewTurn: new BehaviorSubject<void>(undefined),
        });
        turnService.getCurrentTurn.and.returnValue(of(mockPlayer));
        turnService.isMyTurn.and.returnValue(true);

        alertService = jasmine.createSpyObj('AlertService', ['announceWinner']);

        actionService = jasmine.createSpyObj('ActionService', ['consumeAction', 'resetActions'], {
            onCombatStart: new EventEmitter<void>(),
            onCombatEnded: new EventEmitter<void>(),
            hasActionLeftSubject: new BehaviorSubject<number>(0),
        });
        actionService.consumeAction.and.callFake(() => {
            const current = actionService.hasActionLeftSubject.getValue();
            if (current > 0) {
                actionService.hasActionLeftSubject.next(current - 1);
            }
        });

        injector = jasmine.createSpyObj('Injector', ['get']);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        injector.get.and.callFake((token: any) => {
            if (token === ActionService) return actionService;
            throw new Error(`Unknown provider: ${token}`);
        });

        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                CombatService,
                { provide: PlayerService, useValue: playerService },
                { provide: SocketService, useValue: socketService },
                { provide: TurnService, useValue: turnService },
                { provide: AlertService, useValue: alertService },
                { provide: Injector, useValue: injector },
            ],
        });

        combatService = TestBed.inject(CombatService);
    });

    it('should be created', () => {
        expect(combatService).toBeTruthy();
    });

    it('should send combat action', () => {
        combatService.sendCombatAction('room1', mockPlayer, Actions.Attack);
        expect(socketService.sendMessage).toHaveBeenCalledWith('combatAction', {
            playerId: mockPlayer.id,
            action: Actions.Attack,
            roomId: 'room1',
        });
    });

    it('should send combat init', () => {
        combatService['attackedPlayer'] = MOCK_PLAYERS[0];
        combatService.sendCombatInit('room1', MOCK_PLAYERS[0], Actions.Attack);
        expect(socketService.sendMessage).toHaveBeenCalledWith('combatStarted', {
            playerId: MOCK_PLAYERS[0].id,
            action: Actions.Attack,
            roomId: 'room1',
            target: MOCK_PLAYERS[0],
        });
    });

    describe('updateEscapeAttempts', () => {
        it('should emit escapeAttemptsUpdated event with the correct playerId', () => {
            const playerId = 'player1';
            spyOn(combatService.escapeAttemptsUpdated, 'emit');

            combatService.updateEscapeAttempts(playerId);

            expect(combatService.escapeAttemptsUpdated.emit).toHaveBeenCalledWith({ playerId });
        });

        it('should not emit escapeAttemptsUpdated event if playerId is undefined', () => {
            spyOn(combatService.escapeAttemptsUpdated, 'emit');

            combatService.updateEscapeAttempts(undefined);

            expect(combatService.escapeAttemptsUpdated.emit).not.toHaveBeenCalled();
        });
    });

    describe('getCombatWinner', () => {
        it('should return an observable of the combat winner', () => {
            const mockWinnerId = 'player1';
            combatService['_combatWinner'].next(mockWinnerId);

            let result: string | undefined;
            combatService.getCombatWinner().subscribe((winnerId) => {
                result = winnerId;
            });

            expect(result).toEqual(mockWinnerId);
        });
    });

    it('should get combatInitiator', () => {
        const mock = MOCK_PLAYERS[1];
        combatService['combatInitiator'] = mock;
        expect(combatService.combatInitiator).toEqual(mock);
    });

    it('should get attackedPlayer', () => {
        const mock = MOCK_PLAYERS[0];
        combatService['attackedPlayer'] = mock;
        expect(combatService.attackedPlayer).toEqual(mock);
    });

    describe('onCombatUpdate', () => {
        let mockCombatUpdateData: CombatUpdate;

        beforeEach(() => {
            mockCombatUpdateData = {
                gameState: {
                    combat: {
                        attacker: 'attackerId',
                        defender: 'defenderId',
                        turn: 'currentPlayerId',
                        initialStats: { attacker: { ...PLAYER_1.stats } as Stats, defender: { ...PLAYER_2.stats } as Stats },
                    },
                    players: [mockPlayer],
                },
                diceAttack: 3,
                diceDefense: 2,
                message: '',
                roomId: '123',
            };

            playerService.player.id = 'currentPlayerId';
        });

        it('should emit diceRoll with correct data when combat update is received', () => {
            spyOn(combatService.diceRoll, 'emit');

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;
            callback(mockCombatUpdateData);

            expect(combatService.diceRoll.emit).toHaveBeenCalledWith(mockCombatUpdateData);
        });

        it('should wait for animationComplete when attack is not defeated', fakeAsync(() => {
            const animationCompleteSubject = new Subject<void>();
            Object.defineProperty(combatService, '_animationComplete', { value: animationCompleteSubject, writable: true });

            let animationCompleted = false;
            animationCompleteSubject.subscribe(() => {
                animationCompleted = true;
            });

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;

            callback(mockCombatUpdateData);
            tick();

            expect(animationCompleted).toBeFalse();
            expect(combatService['_isInCombat']).toBeFalse();

            animationCompleteSubject.next();
            animationCompleteSubject.complete();
            tick();

            expect(animationCompleted).toBeTrue();
        }));

        it('should emit choicePopUp when current player is the starting player', () => {
            spyOn(combatService.choicePopUp, 'emit');

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;
            callback(mockCombatUpdateData);

            expect(combatService.choicePopUp.emit).toHaveBeenCalled();
        });

        it('should update escape attempts when escape failed', () => {
            spyOn(combatService.escapeAttemptsUpdated, 'emit');
            mockCombatUpdateData.message = CombatResults.EscapeFailed;

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;
            callback(mockCombatUpdateData);

            expect(combatService.escapeAttemptsUpdated.emit).toHaveBeenCalledWith({
                // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
                playerId: mockCombatUpdateData.gameState?.combat?.turn!,
            });
        });

        it('should emit cancelEscapes when player has max escape attempts', () => {
            spyOn(combatService.cancelEscapes, 'emit');
            // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
            mockCombatUpdateData.gameState!.players = [
                {
                    ...mockPlayer,
                    id: playerService.player.id,
                    escapeAttempts: 0,
                },
            ];

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;
            callback(mockCombatUpdateData);

            expect(combatService.cancelEscapes.emit).toHaveBeenCalled();
        });

        it('should call combatEnded when attack is defeated', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(combatService as any, 'combatEnded');
            mockCombatUpdateData.message = CombatResults.AttackDefeated;

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;
            callback(mockCombatUpdateData);

            expect(combatService['combatEnded']).toHaveBeenCalledWith(mockCombatUpdateData);
        });

        it('should call combatEnded when escape succeeded', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(combatService as any, 'combatEnded');
            mockCombatUpdateData.message = CombatResults.EscapeSucceeded;

            const callback = socketService.on.calls.argsFor(2)[1] as (data: CombatUpdate) => void;
            callback(mockCombatUpdateData);

            expect(combatService['combatEnded']).toHaveBeenCalledWith(mockCombatUpdateData);
        });
    });

    describe('setupCombatWinnerListener', () => {
        let winnerCallback: (data: CombatUpdate) => void;

        beforeEach(() => {
            mockCombatUpdate = mockCombatUpdate = {
                ...MOCK_COMBAT_UPDATE,
                message: CombatResults.AttackDefeated,
                roomId: 'room1',
            };
            combatService['setupCombatWinnerListener']();
            winnerCallback = socketService.on.calls.argsFor(0)[1];
        });

        it('should set combat winner when attack is defeated', () => {
            spyOn(combatService['_combatWinner'], 'next');

            winnerCallback(mockCombatUpdate);

            expect(combatService['_combatWinner'].next).toHaveBeenCalledWith(PLAYER_1.id);
        });

        it('should not set combat winner for other messages', () => {
            spyOn(combatService['_combatWinner'], 'next');
            mockCombatUpdate.message = CombatResults.EscapeSucceeded;

            winnerCallback(mockCombatUpdate);

            expect(combatService['_combatWinner'].next).not.toHaveBeenCalled();
        });
    });
    describe('fetchPlayers', () => {
        it('should update _gameRoomPlayers with the emitted player array', fakeAsync(() => {
            const mockPlayers = [PLAYER_1, PLAYER_2];
            const playerObservable = of(mockPlayers);
            combatService.fetchPlayers(playerObservable);
            tick();
            expect(combatService['_gameRoomPlayers']).toEqual(mockPlayers);
        }));
    });

    describe('onPlayerDisconnect', () => {
        let playerDisconnectCallback: (data: GameDisconnect) => void;
        let combatEndedSpy: jasmine.Spy;
        let fetchPlayersSpy: jasmine.Spy<() => Promise<void>>;

        beforeEach(() => {
            combatService['_isInCombat'] = true;
            combatService['_combatUpdateData'] = MOCK_COMBAT_UPDATE;
            combatService['_gameRoomPlayers'] = [PLAYER_1, PLAYER_2];
            Object.defineProperty(combatService, '_combatWinner', { value: new BehaviorSubject<string | undefined>(undefined), writable: true });

            combatEndedSpy = spyOn(actionService.onCombatEnded, 'emit');
            fetchPlayersSpy = spyOn(combatService, 'fetchPlayers').and.callFake(async () => {
                combatService['_gameRoomPlayers'] = [PLAYER_1, PLAYER_2];
                return Promise.resolve();
            });

            alertService.announceWinner.calls.reset();
            turnService.unfreezeTurn.calls.reset();
            actionService.hasActionLeftSubject.next(0);

            combatService['onPlayerDisconnect']();
            playerDisconnectCallback = socketService.on.calls.mostRecent().args[1];
        });

        afterEach(() => {
            combatEndedSpy.calls.reset();
            alertService.announceWinner.calls.reset();
            turnService.unfreezeTurn.calls.reset();
        });

        it('should do nothing if not in combat', fakeAsync(() => {
            combatService['_isInCombat'] = false;
            playerDisconnectCallback({ playerId: PLAYER_2.id });
            tick();

            expect(fetchPlayersSpy).not.toHaveBeenCalled();
            expect(alertService.announceWinner).not.toHaveBeenCalled();
            expect(turnService.unfreezeTurn).not.toHaveBeenCalled();
        }));

        it('should handle player disconnect during combat', fakeAsync(() => {
            playerDisconnectCallback({ playerId: PLAYER_2.id });
            tick();

            expect(fetchPlayersSpy).toHaveBeenCalled();
            expect(turnService.unfreezeTurn).toHaveBeenCalledWith(false);
        }));

        it('should announce winner when current player wins', fakeAsync(() => {
            playerService.player.id = PLAYER_1.id;
            playerDisconnectCallback({ playerId: PLAYER_2.id });
            tick();

            expect(alertService.announceWinner).toHaveBeenCalled();
            expect(combatEndedSpy).toHaveBeenCalled();
        }));

        it('should announce winner when other player quits', fakeAsync(() => {
            playerService.player.id = PLAYER_2.id;
            playerDisconnectCallback({ playerId: PLAYER_1.id });
            tick();

            expect(alertService.announceWinner).toHaveBeenCalledWith('combat.you_won');
            fetchPlayersSpy.and.returnValue(Promise.reject(new Error('Mock error')));
            combatService['_combatUpdateData'] = MOCK_COMBAT_UPDATE;
            combatService['_gameRoomPlayers'] = [PLAYER_1, PLAYER_2];
            playerDisconnectCallback({ playerId: PLAYER_1.id });
            tick();
        }));

        it('should announce other player as winner when current player quits', fakeAsync(() => {
            playerService.player.id = PLAYER_1.id;
            combatService['_combatUpdateData'] = MOCK_COMBAT_UPDATE;
            playerDisconnectCallback({ playerId: PLAYER_1.id });
            tick();
            expect(alertService.announceWinner).toHaveBeenCalledWith('combat.winner');
            expect(combatService['_combatWinner'].getValue()).toBe(PLAYER_2.id);
            expect(actionService.onCombatEnded.emit).not.toHaveBeenCalled();
        }));

        it('should not announce winner if disconnected player was not in combat', fakeAsync(() => {
            playerDisconnectCallback({ playerId: 'other-player' });
            tick();

            expect(alertService.announceWinner).not.toHaveBeenCalled();
        }));

        it('should reset combat data after handling disconnect', fakeAsync(() => {
            playerDisconnectCallback({ playerId: PLAYER_2.id });
            tick();

            expect(combatService['_combatUpdateData']).toBeUndefined();
            expect(combatService['_gameRoomPlayers']).toBeUndefined();
        }));

        it('should consume action when actions left', fakeAsync(() => {
            actionService.hasActionLeftSubject.next(1);
            playerDisconnectCallback({ playerId: PLAYER_2.id });
            tick();

            expect(actionService.hasActionLeftSubject.value).toBe(0);
        }));

        it('should not consume action when no actions left', fakeAsync(() => {
            actionService.hasActionLeftSubject.next(0);
            playerDisconnectCallback({ playerId: PLAYER_2.id });
            tick();

            expect(actionService.hasActionLeftSubject.value).toBe(0);
        }));
    });

    describe('combatUpdateData getter', () => {
        it('should return the current combat update data', () => {
            combatService['_combatUpdateData'] = MOCK_COMBAT_UPDATE;
            const result = combatService.combatUpdateData;
            expect(result).toEqual(MOCK_COMBAT_UPDATE);
        });
    });
    describe('onCombatStarted', () => {
        let combatStartCallback: (data: CombatUpdate) => void;
        let mockCombatData: CombatUpdate;

        beforeEach(() => {
            mockCombatData = MOCK_COMBAT_UPDATE;

            combatService['_isInCombat'] = false;
            combatService['_combatUpdateData'] = undefined;
            combatService['_combatInitiator'] = undefined;
            combatService['_attackedPlayer'] = undefined;
            socketService.on.and.callFake(<T>(event: string, callback: (data: T) => void) => {
                if (event === ActiveGameEvents.CombatInitiated) {
                    combatStartCallback = callback as (data: CombatUpdate) => void;
                }
            });

            combatService['onCombatStarted']();
        });

        it('should set combat state and update data', () => {
            combatStartCallback(mockCombatData);

            expect(combatService['_isInCombat']).toBeTrue();
            expect(combatService['_combatUpdateData']).toEqual(mockCombatData);
        });

        it('should set combat initiator and attacked player', () => {
            combatStartCallback(mockCombatData);

            expect(combatService.combatInitiator).toEqual(PLAYER_1);
            expect(combatService.attackedPlayer).toEqual(PLAYER_2);
        });

        describe('when current player is in game', () => {
            beforeEach(() => {
                playerService.player.id = PLAYER_1.id;
                spyOn(actionService.onCombatStart, 'emit');
                spyOn(combatService.choicePopUp, 'emit');
            });

            it('should emit combat start event', () => {
                combatStartCallback(mockCombatData);
                expect(actionService.onCombatStart.emit).toHaveBeenCalled();
            });

            it('should emit choice popup when player is starting player', fakeAsync(() => {
                combatStartCallback(mockCombatData);
                tick();
                expect(combatService.choicePopUp.emit).toHaveBeenCalled();
            }));
        });
    });

    describe('combatEnded', () => {
        let mockCombatData: CombatUpdate;

        beforeEach(() => {
            mockCombatData = {
                ...MOCK_COMBAT_UPDATE,
                message: CombatResults.AttackDefeated,
            };

            combatService['_combatInitiator'] = PLAYER_1;
            combatService['_attackedPlayer'] = PLAYER_2;
            combatService['_combatUpdateData'] = mockCombatData;
            combatService['_isInCombat'] = true;

            spyOn(actionService.onCombatEnded, 'emit');
        });

        it('should reset combat state regardless of message', async () => {
            await combatService['combatEnded'](mockCombatData);

            expect(combatService['_combatInitiator']).toBeUndefined();
            expect(combatService['_attackedPlayer']).toBeUndefined();
            expect(combatService['_combatUpdateData']).toBeUndefined();
            expect(combatService['_isInCombat']).toBeFalse();
        });
        describe('action left subject handling', () => {
            it('should consume action when actions left and victories <= 2', async () => {
                actionService.hasActionLeftSubject.next(1);
                mockCombatData.message = CombatResults.AttackDefeated;
                playerService.player.id = PLAYER_1.id;
                // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
                mockCombatData.gameState!.players[0].victories = 1;

                await combatService['combatEnded'](mockCombatData);

                expect(actionService.hasActionLeftSubject.getValue()).toBe(0);
            });
        });
        describe('when attack is defeated', () => {
            beforeEach(() => {
                mockCombatData.message = CombatResults.AttackDefeated;
            });

            it('should emit combat ended and unfreeze turn', async () => {
                await combatService['combatEnded'](mockCombatData);

                expect(actionService.onCombatEnded.emit).toHaveBeenCalled();
                expect(turnService.unfreezeTurn).toHaveBeenCalledWith(false);
            });

            describe('when current player is in game', () => {
                beforeEach(() => {
                    playerService.player.id = PLAYER_1.id;
                });

                it('should announce winner when current player wins', async () => {
                    await combatService['combatEnded'](mockCombatData);

                    expect(alertService.announceWinner).toHaveBeenCalledWith('combat.you_won');
                });

                it('should announce other player when they win', async () => {
                    playerService.player.id = PLAYER_2.id;
                    await combatService['combatEnded'](mockCombatData);

                    expect(alertService.announceWinner).toHaveBeenCalledWith('combat.winner');
                });

            });

            describe('when current player is not in game', () => {
                beforeEach(() => {
                    playerService.player.id = 'other-player-id';
                });

                it('should not announce winner', async () => {
                    await combatService['combatEnded'](mockCombatData);

                    expect(alertService.announceWinner).not.toHaveBeenCalled();
                });
            });
        });

        describe('when escape succeeded', () => {
            beforeEach(() => {
                mockCombatData.message = CombatResults.EscapeSucceeded;
            });

            it('should emit combat ended and unfreeze turn', async () => {
                await combatService['combatEnded'](mockCombatData);

                expect(actionService.onCombatEnded.emit).toHaveBeenCalled();
                expect(turnService.unfreezeTurn).toHaveBeenCalledWith(false);
            });

            it('should consume action when actions left', async () => {
                actionService.hasActionLeftSubject.next(1);

                await combatService['combatEnded'](mockCombatData);

                expect(actionService.hasActionLeftSubject.getValue()).toBe(0);
            });

            it('should not announce winner', async () => {
                await combatService['combatEnded'](mockCombatData);

                expect(alertService.announceWinner).not.toHaveBeenCalled();
            });
        });
    });

    describe('notifyAnimationComplete', () => {
        it('should emit through animationComplete$ when called', () => {
            let emissionReceived = false;
            combatService.animationComplete$.subscribe(() => {
                emissionReceived = true;
            });

            combatService.notifyAnimationComplete();

            expect(emissionReceived).toBeTrue();
        });

        it('should complete the animationComplete subject', () => {
            spyOn(combatService['_animationComplete'], 'next');

            combatService.notifyAnimationComplete();

            expect(combatService['_animationComplete'].next).toHaveBeenCalled();
        });
    });
});
