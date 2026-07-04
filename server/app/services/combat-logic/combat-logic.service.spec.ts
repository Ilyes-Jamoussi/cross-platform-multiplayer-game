/* eslint-disable max-lines */
import { DAGGER_LIFE_APPLY } from '@app/constants/test-consts';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ItemService } from '@app/services/items/items.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { ESCAPE_PERCENTAGE, MAX_ESCAPE_ATTEMPTS } from '@common/constants';
import {
    DEFAULT_ROOM_MOCK,
    FAKE_ID,
    NON_DEBUG_ROOM,
    PLAYER_1,
    PLAYER_2,
    PLAYER_3,
    PLAYER_4,
    PLAYER_5,
    ROOM_ID,
    UPDATED_PLAYER_STATS,
} from '@common/constants.spec';
import { Actions, CombatResults, TileTypes, VirtualPlayerTypes } from '@common/enums';
import { GameState, Player } from '@common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';
import { cloneDeep } from 'lodash';

describe('CombatService', () => {
    let combatService: CombatService;
    let gameRoomService: GameRoomService;
    let virtualPlayerService: VirtualPlayerService;
    let attacker: Player;
    let defender: Player;

    const mockItemService = {
        applyAttributesBuffs: jest.fn(),
        applyPoison: jest.fn().mockReturnValue(false),
        applyDagger: jest.fn().mockReturnValue(false),
        applyDiceEffect: jest.fn().mockReturnValue(null),
        applyRevive: jest.fn().mockReturnValue(false),
    };
    mockItemService.applyAttributesBuffs.mockImplementation((roomId, playerId, stats) => {
        return stats;
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CombatService,
                {
                    provide: GameRoomService,
                    useValue: {
                        rooms: new Map(),
                        getRoom: jest.fn((id: string) => gameRoomService.rooms.get(id)),
                        getPlayers: jest.fn().mockImplementation((roomId: string) => {
                            const room = gameRoomService.rooms.get(roomId);
                            return room ? room.players : [];
                        }),
                    },
                },
                {
                    provide: VirtualPlayerService,
                    useValue: {
                        combatAnswer: jest.fn(),
                    },
                },
                {
                    provide: ItemService,
                    useValue: mockItemService,
                },
            ],
        }).compile();

        combatService = module.get<CombatService>(CombatService);
        gameRoomService = module.get<GameRoomService>(GameRoomService);
        virtualPlayerService = module.get<VirtualPlayerService>(VirtualPlayerService);
        gameRoomService.rooms.set(ROOM_ID, DEFAULT_ROOM_MOCK);
    });

    afterEach(async () => {
        gameRoomService.rooms.set(ROOM_ID, DEFAULT_ROOM_MOCK);
    });

    it('should be defined', () => {
        expect(combatService).toBeDefined();
    });

    describe('handleStartCombat', () => {
        it('should start combat if a target is found', () => {
            const room = cloneDeep(DEFAULT_ROOM_MOCK);
            gameRoomService.rooms.set(ROOM_ID, room);
            const result = combatService.handleStartCombat('player1', ROOM_ID, PLAYER_2);

            if ('gameState' in result) {
                expect(result.message).toBe(CombatResults.CombatStarted);
                expect(result.gameState.players).toEqual([
                    expect.objectContaining({
                        ...PLAYER_1,
                        playerStats: UPDATED_PLAYER_STATS,
                    }),
                    expect.objectContaining({
                        ...PLAYER_2,
                        playerStats: UPDATED_PLAYER_STATS,
                    }),
                ]);
            } else {
                fail('Expected result to have gameState property');
            }
        });
    });

    describe('startCombat', () => {
        it('should initialize combat state correctly', () => {
            const result = combatService.startCombat('player1', 'player2', ROOM_ID);
            expect(result.message).toBe(CombatResults.CombatStarted);
            expect(result.gameState.combat.attacker).toBe('player1');
            expect(result.gameState.combat.defender).toBe('player2');
        });
    });

    describe('processCombatAction', () => {
        it('should handle attack action', () => {
            const result = combatService.processCombatAction(Actions.Attack, ROOM_ID) as {
                message: CombatResults;
                gameState: GameState;
            };
            expect(result.message).toBe(CombatResults.AttackNotDefeated);
        });

        it('should handle escape action', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(ESCAPE_PERCENTAGE - 0.1);
            const result = combatService.processCombatAction(Actions.Escape, ROOM_ID) as {
                message: CombatResults;
                gameState: GameState;
            };
            expect([CombatResults.EscapeSucceeded, CombatResults.EscapeFailed]).toContain(result.message);
        });

        it('should handle if combat is undefined', () => {
            DEFAULT_ROOM_MOCK.gameState.combat = undefined;
            const result = combatService.processCombatAction(Actions.Attack, ROOM_ID) as {
                message: CombatResults;
                gameState: GameState;
            };
            expect(result).toBeUndefined();
        });
    });

    describe('handleAttack', () => {
        it('should handle attack and not defeat the defender', () => {
            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: 'player1',
                        defender: 'player2',
                        turn: 'player1',
                        initialStats: {
                            attacker: { ...PLAYER_1.stats },
                            defender: { ...PLAYER_2.stats },
                        },
                    },
                    players: [PLAYER_1, PLAYER_2],
                },
            });

            const result = combatService.handleAttack(PLAYER_1, PLAYER_2, ROOM_ID);
            expect(result.message).toBe(CombatResults.AttackNotDefeated);
        });

        it('should handle attack and defeat the defender', () => {
            const weakPlayer = { ...PLAYER_2, stats: { ...PLAYER_2.stats, life: 1, defense: 1 } };
            const strongPlayer = { ...PLAYER_1, stats: { ...PLAYER_1.stats, attack: 6 } };
            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: 'player1',
                        defender: 'player2',
                        turn: 'player1',
                        initialStats: {
                            attacker: { ...strongPlayer.stats },
                            defender: { ...weakPlayer.stats },
                        },
                    },
                    players: [strongPlayer, weakPlayer],
                },
            });

            const result = combatService.handleAttack(strongPlayer, weakPlayer, ROOM_ID);
            expect(result.message).toBe(CombatResults.AttackDefeated);
        });
    });

    describe('handleEscape', () => {
        beforeEach(() => {
            attacker = cloneDeep(PLAYER_1);
            defender = cloneDeep(PLAYER_2);

            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: 'player1',
                        defender: 'player2',
                        turn: 'player1',
                        initialStats: {
                            attacker: { ...PLAYER_1.stats },
                            defender: { ...PLAYER_2.stats },
                        },
                    },
                    players: [attacker, defender],
                },
            });
        });

        it('should handle escape successfully', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(ESCAPE_PERCENTAGE - 0.1);
            const result = combatService.handleEscape(attacker, defender, ROOM_ID);
            expect(result.message).toBe(CombatResults.EscapeSucceeded);
        });

        it('should handle escape failure', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(ESCAPE_PERCENTAGE + 0.1);
            const result = combatService.handleEscape(attacker, defender, ROOM_ID);
            expect(result.message).toBe(CombatResults.EscapeFailed);
        });
    });

    describe('attack', () => {
        beforeEach(() => {
            attacker = cloneDeep(PLAYER_2);
            defender = cloneDeep(PLAYER_3);

            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: 'player2',
                        defender: 'player3',
                        turn: 'player2',
                        initialStats: {
                            attacker: { ...PLAYER_2.stats },
                            defender: { ...PLAYER_3.stats },
                        },
                    },
                    players: [attacker, defender],
                },
                players: [attacker, defender],
            });
        });

        it('should calculate attack result correctly', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(0.5);

            const result = combatService['attack'](attacker, defender, ROOM_ID);
            expect(result.damage).toBeDefined();
            expect(result.attackResult).toBeDefined();
            expect(result.diceAttackValue).toBeDefined();
            expect(result.diceDefenseValue).toBeDefined();
        });

        it('should calculate negative damage correctly', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);

            const result = combatService['attack'](attacker, defender, ROOM_ID);
            expect(result.damage).toBeLessThan(0);
            expect(result.attackResult).toBeLessThan(defender.stats.life);
        });

        it('should calculate non-negative damage correctly', () => {
            jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(1);

            const result = combatService['attack'](attacker, defender, ROOM_ID);
            expect(result.damage).toBeGreaterThanOrEqual(0);
        });

        describe('item effects', () => {
            beforeEach(() => {
                attacker = cloneDeep(PLAYER_4);
                defender = cloneDeep(PLAYER_5);

                gameRoomService.rooms.set(ROOM_ID, {
                    ...NON_DEBUG_ROOM,
                    gameState: {
                        combat: {
                            attacker: attacker.id,
                            defender: defender.id,
                            turn: attacker.id,
                            initialStats: {
                                attacker: { ...attacker.stats },
                                defender: { ...defender.stats },
                            },
                        },
                        players: [attacker, defender],
                    },
                    isDebug: false,
                    players: [attacker, defender],
                });
            });

            it('should apply poison effect (oneDamageCap)', () => {
                mockItemService.applyPoison.mockReturnValueOnce(true);

                const result = combatService['attack'](attacker, defender, ROOM_ID);

                expect(mockItemService.applyPoison).toHaveBeenCalledWith(ROOM_ID, defender.id);
                expect(result.damage).toBeGreaterThanOrEqual(-1);
            });

            it('should apply dagger effect (+2 attack when life < threshold)', () => {
                mockItemService.applyDagger.mockReturnValueOnce(true);
                attacker.stats.life = DAGGER_LIFE_APPLY - 1;

                const result = combatService['attack'](attacker, defender, ROOM_ID);

                expect(mockItemService.applyDagger).toHaveBeenCalledWith(ROOM_ID, attacker.id);
                expect(result.damage).toBeLessThan(0);
            });

            it('should apply dice effect (override dice roll)', () => {
                const fixedDiceValue = 5;
                mockItemService.applyDiceEffect.mockReturnValueOnce(fixedDiceValue);

                const result = combatService['attack'](attacker, defender, ROOM_ID);

                expect(mockItemService.applyDiceEffect).toHaveBeenCalledWith(ROOM_ID, attacker.id, attacker.stats.attack);
                expect(result.diceAttackValue).toBe(fixedDiceValue);
            });

            it('should apply revive effect', () => {
                mockItemService.applyRevive.mockReturnValueOnce(true);
                const weakDefender = { ...attacker, stats: { ...PLAYER_2.stats, life: 1 }, isReviveUsed: false };

                gameRoomService.rooms.set(ROOM_ID, {
                    ...NON_DEBUG_ROOM,
                    gameState: {
                        combat: {
                            attacker: PLAYER_1.id,
                            defender: weakDefender.id,
                            turn: PLAYER_1.id,
                            initialStats: {
                                attacker: { ...PLAYER_1.stats },
                                defender: { ...weakDefender.stats },
                            },
                        },
                        players: [PLAYER_1, weakDefender],
                    },
                    players: [PLAYER_1, weakDefender],
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                jest.spyOn(combatService as any, 'attack').mockReturnValueOnce({
                    damage: -10,
                    attackResult: -9,
                    diceAttackValue: 6,
                    diceDefenseValue: 1,
                });

                const result = combatService.handleAttack(PLAYER_1, weakDefender, ROOM_ID);
                expect(result.message).toBe(CombatResults.AttackNotDefeated);
                expect(weakDefender.stats.life).toBe(1);
                expect(weakDefender.isReviveUsed).toBe(true);
            });
        });
    });

    describe('VirtualPlayers', () => {
        it('should call combatAnswer when first turn player is virtual', () => {
            const virtualAttacker = {
                ...PLAYER_1,
                type: VirtualPlayerTypes.Aggressive,
                stats: { ...PLAYER_1.stats, maxSpeed: PLAYER_2.stats.maxSpeed + 1 },
            };
            gameRoomService.rooms.set(ROOM_ID, {
                ...DEFAULT_ROOM_MOCK,
                players: [virtualAttacker, PLAYER_2],
            });

            combatService.startCombat(virtualAttacker.id, PLAYER_2.id, ROOM_ID);
            expect(virtualPlayerService.combatAnswer).toHaveBeenCalledWith(virtualAttacker, ROOM_ID);
        });

        it('should call combatAnswer when defender becomes attacker and is virtual', () => {
            const virtualDefender = {
                ...PLAYER_2,
                type: VirtualPlayerTypes.Defensive,
                stats: { ...PLAYER_2.stats, life: 10 },
            };
            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: PLAYER_1.id,
                        defender: virtualDefender.id,
                        turn: PLAYER_1.id,
                        initialStats: {
                            attacker: { ...PLAYER_1.stats },
                            defender: { ...virtualDefender.stats },
                        },
                    },
                    players: [PLAYER_1, virtualDefender],
                },
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(combatService as any, 'attack').mockReturnValue({
                damage: -1,
                attackResult: 9,
                diceAttackValue: 3,
                diceDefenseValue: 2,
            });

            combatService.handleAttack(PLAYER_1, virtualDefender, ROOM_ID);
            expect(virtualPlayerService.combatAnswer).toHaveBeenCalledWith(virtualDefender, ROOM_ID);
        });

        it('should call combatAnswer when revive is used and defender is virtual', () => {
            const virtualDefender = {
                ...PLAYER_2,
                type: VirtualPlayerTypes.Aggressive,
                stats: { ...PLAYER_2.stats, life: 1 },
                isReviveUsed: false,
            };
            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: PLAYER_1.id,
                        defender: virtualDefender.id,
                        turn: PLAYER_1.id,
                        initialStats: {
                            attacker: { ...PLAYER_1.stats },
                            defender: { ...virtualDefender.stats },
                        },
                    },
                    players: [PLAYER_1, virtualDefender],
                },
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockItemService.applyRevive.mockReturnValueOnce(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(combatService as any, 'attack').mockReturnValue({
                damage: -10,
                attackResult: -9,
                diceAttackValue: 6,
                diceDefenseValue: 1,
            });

            combatService.handleAttack(PLAYER_1, virtualDefender, ROOM_ID);
            expect(virtualPlayerService.combatAnswer).toHaveBeenCalledWith(virtualDefender, ROOM_ID);
        });

        it('should call combatAnswer when escape fails and defender is virtual', () => {
            const virtualDefender = {
                ...PLAYER_2,
                type: VirtualPlayerTypes.Defensive,
            };
            gameRoomService.rooms.set(ROOM_ID, {
                ...NON_DEBUG_ROOM,
                gameState: {
                    combat: {
                        attacker: PLAYER_1.id,
                        defender: virtualDefender.id,
                        turn: PLAYER_1.id,
                        initialStats: {
                            attacker: { ...PLAYER_1.stats },
                            defender: { ...virtualDefender.stats },
                        },
                    },
                    players: [PLAYER_1, virtualDefender],
                },
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(combatService as any, 'escape').mockReturnValue({ success: false });

            combatService.handleEscape(PLAYER_1, virtualDefender, ROOM_ID);
            expect(virtualPlayerService.combatAnswer).toHaveBeenCalledWith(virtualDefender, ROOM_ID);
        });
    });

    describe('isIce', () => {
        it('should not apply ice debuff if player is not on ice tile', () => {
            const player1 = { ...PLAYER_1, position: { x: 0, y: 1 } };
            const player2 = cloneDeep(PLAYER_2);
            const room = cloneDeep(NON_DEBUG_ROOM);
            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    players: [player1, player2],
                },
                map: {
                    board: [
                        [
                            { tile: TileTypes.Ice, player: player2, item: { name: '', description: '' } },
                            { tile: TileTypes.Default, player: player1, item: { name: '', description: '' } },
                        ],
                    ],
                    name: 'test',
                    description: 'test',
                    imagePayload: 'test',
                    gameMode: 'CTF',
                    gridSize: 10,
                    isHidden: true,
                    lastModified: '',
                    _id: FAKE_ID,
                },
                isDebug: false,
            });

            combatService.startCombat(player1.id, PLAYER_2.id, ROOM_ID);
            const roomPlayer1 = room.players.find((player) => player.id === player1.id);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayer1.stats.attack).toBe(2);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayer1.stats.defense).toBe(2);
        });
        it('should apply ice debuff if player is on ice tile', () => {
            const player1 = cloneDeep(PLAYER_1);
            const room = cloneDeep(NON_DEBUG_ROOM);
            room.players.push(player1);
            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    players: [player1, PLAYER_2],
                },
                map: {
                    board: [[{ tile: TileTypes.Ice, player: player1, item: { name: '', description: '' } }]],
                    name: 'test',
                    description: 'test',
                    imagePayload: 'test',
                    gameMode: 'CTF',
                    gridSize: 10,
                    isHidden: true,
                    lastModified: '',
                    _id: FAKE_ID,
                },
                isDebug: false,
            });

            combatService.startCombat(player1.id, PLAYER_2.id, ROOM_ID);
            expect(player1.isIceApplied).toBe(false);
        });

        it('should not apply ice debuff if player already has ice applied', () => {
            const player1 = {
                id: 'player1',
                stats: { speed: 10, maxSpeed: 10, life: 100, attack: 10, defense: 5 },
                victories: 0,
                escapeAttempts: MAX_ESCAPE_ATTEMPTS,
                isIceApplied: true,
                isHost: true,
                position: { x: 0, y: 0 },
            };
            const room = cloneDeep(NON_DEBUG_ROOM);
            room.players.push(player1);
            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    players: [player1],
                },
                map: {
                    board: [[{ tile: TileTypes.Ice, player: player1, item: { name: '', description: '' } }]],
                    name: 'test',
                    description: 'test',
                    imagePayload: 'test',
                    gameMode: 'CTF',
                    gridSize: 10,
                    isHidden: true,
                    lastModified: '',
                    _id: FAKE_ID,
                },
                isDebug: false,
            });

            combatService.startCombat(player1.id, PLAYER_2.id, ROOM_ID);
            const roomPlayer1 = room.players.find((player) => player.id === player1.id);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayer1.stats.attack).toBe(2);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayer1.stats.defense).toBe(2);
        });

        it('should not apply ice debuff if player is null', () => {
            const room = cloneDeep(NON_DEBUG_ROOM);
            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    players: [],
                },
                map: {
                    board: [[{ tile: TileTypes.Ice, player: null, item: { name: '', description: '' } }]],
                    name: 'test',
                    description: 'test',
                    imagePayload: 'test',
                    gameMode: 'CTF',
                    gridSize: 10,
                    isHidden: true,
                    lastModified: '',
                    _id: FAKE_ID,
                },
                isDebug: false,
            });

            combatService['isIce']('non-existent-player', ROOM_ID);
        });
    });

    describe('rollDice', () => {
        it('should return MAX_STAT if debug mode is on and it is an attack', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const result = combatService['rollDice'](4, true, true);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(result).toBe(4);
        });

        it('should return 1 if debug mode is on and it is not an attack', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const result = combatService['rollDice'](4, true, false);
            expect(result).toBe(1);
        });

        it('should return a random number between 1 and numDice if debug mode is off', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(0.5);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            const result = combatService['rollDice'](4, false, true);
            expect(result).toBeGreaterThanOrEqual(1);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(result).toBeLessThanOrEqual(10);
        });
    });

    describe('escape', () => {
        it('should return success based on ESCAPE_PERCENTAGE', () => {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(ESCAPE_PERCENTAGE - 0.1);
            const result = combatService['escape']();
            expect(result.success).toBe(true);

            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            jest.spyOn(Math, 'random').mockReturnValue(ESCAPE_PERCENTAGE + 0.1);
            const result2 = combatService['escape']();
            expect(result2.success).toBe(false);
        });
    });

    describe('endCombat', () => {
        it('should reset stats and end combat if there is a winner and loser', () => {
            const playerWithIce = { ...PLAYER_3, isIceApplied: true };
            const room = cloneDeep(NON_DEBUG_ROOM);
            room.players.push(playerWithIce);

            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    combat: {
                        attacker: 'player1',
                        defender: 'player3',
                        turn: 'player1',
                        initialStats: {
                            attacker: { ...playerWithIce.stats },
                            // eslint-disable-next-line max-lines
                            defender: { ...PLAYER_2.stats },
                        },
                    },
                    players: [playerWithIce, PLAYER_2],
                },
                isDebug: false,
                players: [playerWithIce, PLAYER_2],
            });

            combatService['endCombat'](ROOM_ID, 'player3', 'player2');
            const roomPlayerWithIce = room.players.find((player) => player.id === playerWithIce.id);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayerWithIce.stats.attack).toBe(4);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayerWithIce.stats.defense).toBe(4);
            expect(roomPlayerWithIce.isIceApplied).toBe(false);
        });

        it('should reset stats if combat, winnerId, or loserId is null', () => {
            const playerWithIce = { ...PLAYER_3, isIceApplied: true };
            const room = cloneDeep(DEFAULT_ROOM_MOCK);
            room.players.push(playerWithIce);
            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    combat: {
                        attacker: 'player1',
                        defender: 'player2',
                        turn: 'player1',
                        initialStats: {
                            attacker: { ...playerWithIce.stats },
                            defender: { ...PLAYER_2.stats },
                        },
                    },
                    players: [playerWithIce, PLAYER_2],
                },
                players: [playerWithIce, PLAYER_2],
            });

            combatService['endCombat'](ROOM_ID, null, null);
            const roomPlayerWithIce = room.players.find((player) => player.id === playerWithIce.id);
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            expect(roomPlayerWithIce.stats.attack).toBe(4);
        });
    });

    describe('findNextPlayerPosition', () => {
        it('should return the same position if it is not occupied', () => {
            const newStartingPosition = { x: 1, y: 2 };
            const result = combatService.findNextPlayerPosition(newStartingPosition, ROOM_ID);
            expect(result).toEqual(newStartingPosition);
        });

        it('should return a new position if the starting position is occupied', () => {
            const newStartingPosition = { x: 1, y: 1 };
            const occupiedPlayer = { ...PLAYER_1, position: { x: 1, y: 1 } };
            gameRoomService.rooms.set(ROOM_ID, {
                ...DEFAULT_ROOM_MOCK,
                players: [occupiedPlayer, PLAYER_2],
                gameState: {
                    players: [occupiedPlayer, PLAYER_2],
                },
            });

            const result = combatService.findNextPlayerPosition(newStartingPosition, ROOM_ID);
            expect(result).not.toEqual(newStartingPosition);
        });

        it('should return null if the starting position is null or undefined', () => {
            expect(combatService.findNextPlayerPosition(null, ROOM_ID)).toBeNull();
            expect(combatService.findNextPlayerPosition(undefined, ROOM_ID)).toBeNull();
        });

        it('should return a valid position even if some directions are out of bounds', () => {
            const newStartingPosition = { x: 0, y: 0 };
            const room = cloneDeep(DEFAULT_ROOM_MOCK);
            room.players.push(PLAYER_1);
            room.players.push({ ...PLAYER_3, position: { x: 0, y: 1 } });
            room.players.push({ ...PLAYER_5, position: { x: 1, y: 0 } });

            gameRoomService.rooms.set(ROOM_ID, {
                ...room,
                gameState: {
                    players: [PLAYER_1, PLAYER_3, PLAYER_5],
                },
            });

            const result = combatService.findNextPlayerPosition(newStartingPosition, ROOM_ID);
            expect(result).toEqual(newStartingPosition);
        });
    });

    it('should return the Max escape attempts (2) if the escape Attempts are 0', () => {
        const room = cloneDeep(DEFAULT_ROOM_MOCK);
        room.players.push(PLAYER_4);
        gameRoomService.rooms.set(ROOM_ID, {
            ...room,
            gameState: {
                players: [PLAYER_4, PLAYER_2],
            },
        });
        combatService.startCombat(PLAYER_4.id, PLAYER_2.id, ROOM_ID);
        combatService.handleEscape(PLAYER_4, PLAYER_2, ROOM_ID);
        expect(PLAYER_4.escapeAttempts).toEqual(1);
    });
});
