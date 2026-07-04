import { GameLogicGateway } from '@app/gateways/game-logic/game-logic.gateway';
import { ItemGateway } from '@app/gateways/items/items.gateway';
import { MoveAction } from '@app/interfaces/game-logic-interfaces';
import { CombatService } from '@app/services/combat-logic/combat-logic.service';
import { GameLogicService } from '@app/services/game-logic/game-logic.service';
import { GameModeService } from '@app/services/game-mode/game-mode.service';
import { MovementService } from '@app/services/movement-logic/movement-logic.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { Directions, VirtualPlayerTypes } from '@common/enums';
import { ActiveGameEvents, CTFEvents } from '@common/gateway-events';
import { CombatAction, CombatActionResult, Player, RoomData } from '@common/interfaces';
import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';

describe('GameLogicService', () => {
    let service: GameLogicService;
    let mockCombatService: Partial<CombatService>;
    let mockGameModeService: Partial<GameModeService>;
    let mockMovementService: Partial<MovementService>;
    let mockVirtualPlayerService: Partial<VirtualPlayerService>;
    let mockItemGateway: Partial<ItemGateway>;
    let mockGameLogicGateway: Partial<GameLogicGateway>;
    let mockModuleRef: Partial<ModuleRef>;
    let mockServer: Server;

    beforeEach(async () => {
        mockServer = { to: jest.fn().mockReturnThis(), emit: jest.fn() } as unknown as Server;
        mockCombatService = {
            findNextPlayerPosition: jest.fn(),
        };

        mockGameModeService = {
            flagDropped: jest.fn(),
            checkFlagCaptured: jest.fn(),
            setTilesVisited: jest.fn(),
        };

        mockMovementService = {
            delay: jest.fn().mockResolvedValue(undefined),
            decreaseSpeed: jest.fn(),
            findPaths: jest.fn().mockReturnValue({ reachableTiles: [] }),
        };

        mockVirtualPlayerService = {
            afterCombatTurn: jest.fn(),
            turnAction: jest.fn(),
        };

        mockItemGateway = {
            handleDroppedItems: jest.fn(),
        };

        mockGameLogicGateway = {
            server: mockServer,
            handleEndTurn: jest.fn(),
        };

        mockItemGateway = {
            handleDroppedItems: jest.fn(),
            server: mockServer,
        };

        mockGameLogicGateway = {
            handleEndTurn: jest.fn(),
            server: mockServer,
        };

        mockModuleRef = {
            get: jest.fn().mockImplementation((type) => {
                if (type === ItemGateway) return mockItemGateway;
                if (type === GameLogicGateway) return mockGameLogicGateway;
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameLogicService,
                { provide: CombatService, useValue: mockCombatService },
                { provide: ModuleRef, useValue: mockModuleRef },
                { provide: GameModeService, useValue: mockGameModeService },
                { provide: MovementService, useValue: mockMovementService },
                { provide: VirtualPlayerService, useValue: mockVirtualPlayerService },
                { provide: ItemGateway, useValue: mockItemGateway },
                { provide: GameLogicGateway, useValue: mockGameLogicGateway },
            ],
        }).compile();

        service = module.get<GameLogicService>(GameLogicService);
        service.onModuleInit();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should initialize gateways', () => {
            expect(mockModuleRef.get).toHaveBeenCalledWith(ItemGateway);
            expect(mockModuleRef.get).toHaveBeenCalledWith(GameLogicGateway);
            expect(service['itemGateway']).toBeDefined();
            expect(service['gameLogicGateway']).toBeDefined();
        });
    });

    describe('setNextPosition', () => {
        it('should return starting position if player is at starting point', () => {
            const player = MOCK_PLAYERS[0];
            player.startingPoint = player.position;
            const data = { roomId: 'room1' } as CombatAction;
            const room = { map: { board: [] } } as RoomData;

            const result = service.setNextPosition(player, data, room);
            expect(result).toEqual({ x: 0, y: 0 });
        });

        it('should call findNextPlayerPosition if not at starting point', () => {
            const player = {
                position: { x: 1, y: 1 },
                startingPoint: { x: 0, y: 0 },
                type: 'player',
                inventory: [],
            } as unknown as Player;
            const data = { roomId: 'room1' } as CombatAction;
            const room = { map: { board: [] } } as RoomData;

            mockCombatService.findNextPlayerPosition = jest.fn().mockReturnValue({ x: 2, y: 2 });
            const result = service.setNextPosition(player, data, room);
            expect(mockCombatService.findNextPlayerPosition).toHaveBeenCalledWith({ x: 0, y: 0 }, 'room1');
            expect(result).toEqual({ x: 2, y: 2 });
        });

        it('should handle dropped items for player type', () => {
            const player = {
                position: { x: 1, y: 1 },
                startingPoint: { x: 0, y: 0 },
                type: 'player',
                inventory: ['item1'],
            } as unknown as Player;
            const data = { roomId: 'room1' } as CombatAction;
            const room = { map: { board: [] } } as RoomData;

            service.setNextPosition(player, data, room);
            expect(mockItemGateway.handleDroppedItems).toHaveBeenCalled();
        });
    });

    describe('handleCombat', () => {
        const player = {
            id: 'player1',
            type: 'player',
            inventory: [{ id: 'flag_red' }],
            position: { x: 1, y: 1 },
        } as unknown as Player;
        const data = { roomId: 'room1' } as CombatAction;
        const nextPosition = { x: 2, y: 2 };
        const room = {
            players: [{ id: 'player1' }],
            currentTurn: { type: 'player', id: 'player1' },
        } as unknown as RoomData;
        let result = {
            gameState: {
                players: [{ id: 'player1' }, { id: 'player2' }],
            },
        } as CombatActionResult;

        it('should handle flag drop for player type', async () => {
            await service.handleCombat(player, data, nextPosition, room, result);
            expect(mockGameModeService.flagDropped).toHaveBeenCalledWith('room1');
            expect(mockGameLogicGateway.server.emit).toHaveBeenCalledWith(CTFEvents.FlagDropped);
        });

        it('should update player position and inventory', async () => {
            await service.handleCombat(player, data, nextPosition, room, result);
            expect(room.players[0].position).toEqual({ x: 2, y: 2 });
            expect(room.players[0].inventory).toEqual([]);
        });

        it('should handle virtual player turn after combat', async () => {
            result.gameState.players[0].type = VirtualPlayerTypes.Aggressive;
            await service.handleCombat(player, data, nextPosition, room, result);
            expect(mockVirtualPlayerService.afterCombatTurn).toHaveBeenCalled();
        });

        it('should handle normal player turn after combat', async () => {
            result = {
                gameState: {
                    players: [{ id: 'player2' }, { id: 'player1', type: 'player' }],
                },
            } as CombatActionResult;

            await service.handleCombat(player, data, nextPosition, room, result);
            expect(mockGameLogicGateway.handleEndTurn).toHaveBeenCalledWith({ roomId: 'room1' });
        });

        it('should not end turn when the human winner still has movement or actions', async () => {
            const winningPlayer = {
                id: 'player1',
                type: undefined,
                stats: { speed: 2, maxSpeed: 4, life: 3, maxLife: 4 },
                position: { x: 0, y: 0 },
                actionsLeft: 2,
            } as unknown as Player;
            const roomWithMap = {
                players: [winningPlayer],
                currentTurn: { id: 'player1' },
                map: { gridSize: 2, board: [], nbActions: 2 },
            } as unknown as RoomData;
            const combatResult = {
                gameState: {
                    players: [winningPlayer, { id: 'player2' }],
                },
            } as CombatActionResult;

            (mockMovementService.findPaths as jest.Mock).mockReturnValueOnce({ reachableTiles: [{ x: 0, y: 1 }] });

            await service.handleCombat(player, data, nextPosition, roomWithMap, combatResult);

            expect(mockGameLogicGateway.handleEndTurn).not.toHaveBeenCalled();
            expect(winningPlayer.actionsLeft).toBe(1);
        });

        it('should end turn when the human winner has no movement and no actions after combat', async () => {
            const winningPlayer = {
                id: 'player1',
                type: undefined,
                stats: { speed: 0, maxSpeed: 4, life: 3, maxLife: 4 },
                position: { x: 0, y: 0 },
                actionsLeft: 1,
            } as unknown as Player;
            const roomWithMap = {
                players: [winningPlayer],
                currentTurn: { id: 'player1' },
                map: { gridSize: 2, board: [], nbActions: 1 },
            } as unknown as RoomData;
            const combatResult = {
                gameState: {
                    players: [winningPlayer, { id: 'player2' }],
                },
            } as CombatActionResult;

            (mockMovementService.findPaths as jest.Mock).mockReturnValueOnce({ reachableTiles: [] });

            await service.handleCombat(player, data, nextPosition, roomWithMap, combatResult);

            expect(mockGameLogicGateway.handleEndTurn).toHaveBeenCalledWith({ roomId: 'room1' });
        });
    });

    describe('turnAction', () => {
        it('should call virtualPlayerService.turnAction', () => {
            const roomId = 'room1';
            const currentPlayer = { id: 'player1', type: 'player' } as unknown as Player;
            service.turnAction(roomId, currentPlayer);
            expect(mockVirtualPlayerService.turnAction).toHaveBeenCalledWith(roomId, currentPlayer);
        });
    });

    describe('moveAction', () => {
        const moveAction = {
            data: {
                roomId: 'room1',
                grid: {
                    board: [
                        [{ item: { name: 'sword', description: '' }, position: { x: 0, y: 0 } }],
                        [{ item: { name: 'sword', description: '' }, position: { x: 0, y: 0 } }],
                    ],
                },
                path: { positions: [{ x: 0, y: 0 }] },
            },
            movingPlayer: {
                id: 'player1',
                position: { x: 0, y: 0 },
                lastDirection: Directions.Right,
                inventory: [],
            },
            playerInRoom: {
                id: 'player1',
                inventory: [],
                playerStats: { nItemsCollected: 0 },
            },
            room: {
                players: [{ id: 'player1' }],
            },
            nextPosition: { x: 0, y: 0 },
            index: 0,
        } as MoveAction;

        it('should handle item pickup', async () => {
            const result = await service.moveAction(moveAction);
            expect(mockGameLogicGateway.server.emit).toHaveBeenCalledWith(ActiveGameEvents.ItemPickedUp, expect.anything());
            expect(result).toBe(true);
        });

        it('should handle a player without an inventory', async () => {
            moveAction.playerInRoom.inventory = undefined;
            await service.moveAction(moveAction);
            expect(moveAction.playerInRoom.inventory[0].id).toEqual('sword');
        });

        it('should handle winning team check', async () => {
            moveAction.data.grid.board[0][0].item.name = '';
            mockGameModeService.checkFlagCaptured = jest.fn().mockReturnValue('red');
            const result = await service.moveAction(moveAction);
            expect(result).toBe(true);
            expect(mockGameLogicGateway.server.emit).toHaveBeenCalledWith(ActiveGameEvents.PlayerNextPosition, {
                player: moveAction.movingPlayer,
                nextPosition: moveAction.nextPosition,
            });
        });

        it('should handle player disconnect when room is missing', async () => {
            moveAction.data.grid.board[0][0].item.name = 'sword';
            moveAction.room = undefined;
            const result = await service.moveAction(moveAction);
            expect(result).toBe(true);
            expect(mockGameLogicGateway.server.emit).toHaveBeenCalledWith(ActiveGameEvents.PlayerDisconnect, { playerId: 'player1' });
        });

        it('should handle an moveAction where the index is bigger than 0', async () => {
            moveAction.index = 1;
            await service.moveAction(moveAction);
            expect(moveAction.movingPlayer.position).toEqual({ x: 0, y: 0 });
        });

        it('should handle a change in the last direction of the player', async () => {
            moveAction.nextPosition.x = 1;
            await service.moveAction(moveAction);
            expect(moveAction.movingPlayer.lastDirection).toEqual(Directions.Right);

            moveAction.data.path.positions[0] = { x: 1, y: 1 };
            moveAction.nextPosition.x = 0;
            await service.moveAction(moveAction);
            expect(moveAction.movingPlayer.lastDirection).toEqual(Directions.Left);
        });
    });
});
