import { MAX_ESCAPE_ATTEMPTS, MAX_PLAYER } from './constants';
import { Directions, ItemId, ItemTypes, TileTypes } from './enums';
import { BoardCell, Combat, CombatUpdate, Item, Player, RoomData, Stats, ToggleDoor } from './interfaces';
import { createItem } from './shared-utils';
import { Game } from './types';

export const validGameId = '123';
export const FAKE_ID = '123';
export const ROOM_ID = 'room1';
export const PLAYER_STATS = {
    nCombats: 0,
    nEvasions: 0,
    nVictories: 0,
    nDefeats: 0,
    hpLost: 0,
    hpDealt: 0,
    nItemsCollected: 0,
    tilesVisited: [],
    tilesVisitedPercentage: 0,
};

export const UPDATED_PLAYER_STATS = {
    ...PLAYER_STATS,
    nCombats: 2,
};

export const GLOBAL_STATS = {
    duration: 0,
    totalTurns: 0,
    tilesVisited: [],
    tilesVisitedPercentage: 0,
    doorsUsed: [],
    doorsUsedPercent: 0,
    flagHolders: [],
};

export const ITEMS = [createItem('item-1-Potion' as ItemId, 'test'), createItem('item-3-Bouclier' as ItemId, 'test2')];
export const ITEMS_ATTACK = [createItem('item-4-Poison' as ItemId, 'test3'), createItem('item-6-Dé' as ItemId, 'test6')];
export const NEW_ITEM = createItem('item-2-Dague' as ItemId, 'test3');
export const PLAYER_1: Player = {
    id: 'player1',
    stats: { speed: 10, maxSpeed: 10, life: 6, attack: 4, defense: 4 },
    victories: 0,
    escapeAttempts: MAX_ESCAPE_ATTEMPTS,
    isIceApplied: false,
    isHost: true,
    position: { x: 0, y: 0 },
    playerStats: PLAYER_STATS,
    isReviveUsed: false,
    inventory: ITEMS,
};
export const PLAYER_2: Player = {
    id: 'player2',
    stats: { speed: 8, maxSpeed: 8, life: 4, attack: 4, defense: 4 },
    victories: 0,
    escapeAttempts: MAX_ESCAPE_ATTEMPTS,
    isIceApplied: false,
    isHost: false,
    position: { x: 0, y: 0 },
    playerStats: PLAYER_STATS,
    isReviveUsed: false,
};
export const PLAYER_3: Player = {
    id: 'player3',
    stats: { speed: 5, maxSpeed: 5, life: 4, attack: 4, defense: 4 },
    victories: 0,
    escapeAttempts: MAX_ESCAPE_ATTEMPTS,
    isIceApplied: false,
    isHost: false,
    position: { x: 0, y: 0 },
    playerStats: PLAYER_STATS,
    isReviveUsed: false,
};
export const PLAYER_4: Player = {
    id: 'player3',
    stats: { speed: 5, maxSpeed: 5, life: 4, attack: 4, defense: 4 },
    victories: 0,
    escapeAttempts: 0,
    isIceApplied: false,
    isHost: false,
    position: { x: 0, y: 0 },
    playerStats: PLAYER_STATS,
    isReviveUsed: false,
    inventory: [NEW_ITEM, createItem('item-5-Revie' as ItemId, 'test5')],
};
export const PLAYER_5: Player = {
    id: 'player5',
    stats: { speed: 5, maxSpeed: 5, life: 4, attack: 4, defense: 4 },
    victories: 0,
    escapeAttempts: MAX_ESCAPE_ATTEMPTS,
    isIceApplied: false,
    isHost: false,
    position: { x: 0, y: 0 },
    playerStats: PLAYER_STATS,
    isReviveUsed: false,
    inventory: ITEMS_ATTACK,
};
export const PLAYER_6: Player = {
    id: 'player6',
    stats: { speed: 5, maxSpeed: 5, life: 4, attack: 4, defense: 4 },
    victories: 0,
    escapeAttempts: MAX_ESCAPE_ATTEMPTS,
    isIceApplied: false,
    isHost: false,
    position: { x: 0, y: 0 },
    playerStats: PLAYER_STATS,
    isReviveUsed: false,
    inventory: [],
};
export const NON_DEBUG_ROOM: RoomData = {
    players: [PLAYER_1, PLAYER_2],
    gameState: { players: [] },
    isDebug: false,
    playerMax: 4,
    playerMin: 2,
    isFriendsOnly: false,
    dropInDropOutEnabled: false,
    isLocked: false,
    selectedAvatars: new Map<string, string>(),
    entryFee: 0,
    playerUids: new Map<string, string>(),
    paidPlayers: new Set<string>(),
    hasGameStarted: false,
    isHostReady: false,
};
export const DEFAULT_ROOM_MOCK: RoomData = {
    ...NON_DEBUG_ROOM,
    gameState: {
        combat: {
            attacker: 'player1',
            defender: 'player2',
            turn: 'player1',
            initialStats: {
                attacker: { ...PLAYER_1.stats } as Stats,
                defender: { ...PLAYER_2.stats } as Stats,
            },
        },
        players: [PLAYER_1, PLAYER_2],
    },
    map: {
        board: [[{ tile: TileTypes.Default, player: PLAYER_1, item: { name: '', description: '' } }]],
        name: 'test',
        description: 'test',
        imagePayload: 'test',
        gameMode: 'CTF',
        gridSize: 10,
        nbActions: 1,
        state: 'public',
        owner: 'test-uid',
        ownerName: 'test-user',
        lastModified: '',
        _id: FAKE_ID,
    },
    isDebug: false,
};

export const MOCK_3X3_GRID = {
    _id: '1',
    name: '1',
    description: '3x3 grid',
    gameMode: 'CTF',
    state: 'public',
    owner: 'test-uid',
    ownerName: 'test-user',
    imagePayload: '',
    lastModified: '',
    gridSize: 3,
    nbActions: 1,
    board: [
        [
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 0 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 1 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 2 } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 1, y: 0 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 1, y: 1 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 1, y: 2 } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 2, y: 0 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 2, y: 1 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 2, y: 2 } },
        ],
    ],
};

export const GAME_DATA = {
    name: 'test',
    description: 'test',
    imagePayload: 'test',
    gameMode: 'CTF',
    gridSize: 10,
    nbActions: 1,
    board: [
        [
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 0 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 1 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 2 } },
            { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 3 } },
            { tile: TileTypes.Ice, item: { name: '', description: '' }, position: { x: 0, y: 4 } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: 'StartingPoint', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: 'sword', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
        [
            { tile: TileTypes.Default, item: { name: 'StartingPoint', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Ice, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
            { tile: TileTypes.Default, item: { name: '', description: '' } },
        ],
    ],
};

export const GAME_ARRAY_1: Game[] = [
    {
        _id: '1',
        name: 'Battle Arena',
        description: 'A fast-paced multiplayer battle game.',
        gameMode: 'CTF',
        state: 'public',
        owner: 'uid-1',
        ownerName: 'user1',
        gridSize: 20,
        nbActions: 1,
        imagePayload: '',
        lastModified: '2025-01-28T10:00:00Z',
    },
    {
        _id: '2',
        name: 'Classique',
        description: 'Find the hidden treasures before your opponents!',
        gameMode: 'CTF',
        state: 'private',
        owner: 'uid-2',
        ownerName: 'user2',
        gridSize: 15,
        nbActions: 1,
        imagePayload: '',
        lastModified: '2025-01-27T15:30:00Z',
    },
    {
        _id: '3',
        name: 'Classique',
        description: 'Navigate through complex mazes and escape!',
        gameMode: 'Classique',
        state: 'public',
        owner: 'uid-1',
        ownerName: 'user1',
        gridSize: 10,
        nbActions: 1,
        imagePayload: '',
        lastModified: '2025-01-26T08:45:00Z',
    },
    {
        _id: '4',
        name: 'Space Invaders',
        description: 'Defend the galaxy from waves of alien invaders.',
        gameMode: 'CTF',
        state: 'private-shared',
        owner: 'uid-3',
        ownerName: 'user3',
        gridSize: 20,
        nbActions: 1,
        imagePayload: '',
        lastModified: '2025-01-25T14:20:00Z',
    },
];

export const MOCK_PLAYERS: Player[] = [
    {
        id: 'player1000',
        isHost: true,
        name: 'Player 1',
        avatar: 'Archer',
        stats: {
            life: 100,
            speed: 10,
            attack: 15,
            defense: 5,
            maxSpeed: 20,
        },
        inventory: [],
        actionsLeft: 1,
        victories: 5,
        position: { x: 0, y: 0 },
        lastDirection: Directions.Right,
        playerStats: PLAYER_STATS,
    },
    {
        id: 'player2',
        isHost: false,
        name: 'Player 2',
        avatar: 'Golden Punch',
        actionsLeft: 1,
        stats: {
            life: 80,
            speed: 12,
            attack: 18,
            defense: 8,
            maxSpeed: 25,
        },
        inventory: [],
        victories: 5,
        position: { x: 1, y: 1 },
        lastDirection: Directions.Right,
        playerStats: PLAYER_STATS,
    },
    {
        id: 'player3',
        isHost: false,
        name: 'Player 3',
        avatar: 'IceWolf',
        stats: {
            life: 90,
            speed: 11,
            attack: 14,
            defense: 6,
            maxSpeed: 22,
        },
        inventory: [],
        actionsLeft: 1,
        victories: 3,
        position: { x: 2, y: 2 },
        lastDirection: Directions.Left,
        playerStats: PLAYER_STATS,
    },
];

export const MOCK_COMBAT_UPDATE: CombatUpdate = {
    gameState: {
        players: [PLAYER_1, PLAYER_2],
        combat: {
            attacker: PLAYER_1.id,
            defender: PLAYER_2.id,
            turn: PLAYER_1.id,
            initialStats: {
                attacker: PLAYER_1.stats!,
                defender: PLAYER_2.stats!,
            },
        },
    },
    roomId: 'test-room',
};
export const MOCK_COMBAT: Combat = {
    attacker: 'player1000',
    defender: 'player2',
    turn: 'yes',
    initialStats: {
        attacker: {
            life: 10,
            speed: 10,
            attack: 10,
            defense: 10,
            maxSpeed: 10,
            maxLife: 10,
        },
        defender: {
            life: 10,
            speed: 10,
            attack: 10,
            defense: 10,
            maxSpeed: 10,
            maxLife: 10,
        },
    },
};

export const MOCK_ROOM: RoomData = {
    mapId: 'map1',
    playerMax: 4,
    playerMin: 2,
    players: MOCK_PLAYERS,
    selectedAvatars: new Map<string, string>([
        ['client1', 'avatar1.png'],
        ['client2', 'avatar2.png'],
        ['client3', 'avatar3.png'],
    ]),
    isFriendsOnly: false,
    isLocked: false,
    dropInDropOutEnabled: false,
    currentTurn: MOCK_PLAYERS[0],
    entryFee: 0,
    playerUids: new Map<string, string>(),
    paidPlayers: new Set<string>(),
    hasGameStarted: false,
    map: {
        _id: 'string',
        board: GAME_DATA.board,
        description: 'string',
        gameMode: 'string',
        gridSize: 0,
        nbActions: 1,
        imagePayload: 'string',
        state: 'public',
        owner: 'test-uid',
        ownerName: 'test-user',
        lastModified: 'string',
        name: 'string',
    },
    disconnectedPlayers: [],
    isHostReady: false,
};

export const MOCK_BOARD: BoardCell[][] = [
    [
        { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 0, y: 0 } },
        { tile: TileTypes.Ice, item: { name: '', description: '' }, position: { x: 0, y: 1 } },
    ],
    [
        { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 1, y: 0 } },
        { tile: TileTypes.Default, item: { name: '', description: '' }, position: { x: 1, y: 1 } },
    ],
];
export const RANDOM_FRACTION2 = 0.6;

export const TIME_BELOW_THRESHOLD = 3;
export const TIME_ABOVE_THRESHOLD = 6;

export const MAX_PLAYERS_2 = Array.from(MAX_PLAYER.entries())[0][1];
export const MAX_PLAYERS_4 = Array.from(MAX_PLAYER.entries())[1][1];
export const MAX_PLAYERS_6 = Array.from(MAX_PLAYER.entries())[2][1];
export const TOGGLE_DOOR_DATA: ToggleDoor = {
    position: { x: 0, y: 0 },
    isOpened: true,
    roomId: '123',
};
export const MOCK_BOARD_ITEM = [
    [
        { item: { name: '', description: '' }, player: { ...MOCK_PLAYERS[0] }, tile: TileTypes.Default },
        { item: { name: ItemTypes.StartingPoint + '1', description: 'start' }, tile: TileTypes.Default },
    ],
    [
        { item: { name: ItemTypes.Item, description: 'normal' }, tile: TileTypes.Default },
        { item: { name: ItemTypes.Flag + '1', description: 'flag' }, tile: TileTypes.Default },
    ],
];

export const POTION_ITEM: Item = {
    id: ItemId.Item1,
    uniqueId: 'potion-1',
    image: '',
    tooltip: '',
    selected: false,
};
export const SHIELD_ITEM: Item = {
    id: ItemId.Item3,
    uniqueId: 'shield-1',
    image: '',
    tooltip: '',
    selected: false,
};
export const FLAG: Item = {
    id: ItemId.ItemFlag,
    uniqueId: 'item-1-flag',
    image: '',
    tooltip: '',
    selected: false,
};
export const SELECTED_POTION_ITEM: Item = {
    id: ItemId.Item1,
    uniqueId: 'potion-2',
    image: '',
    tooltip: '',
    selected: true,
};
export const SELECTED_DAGUE_ITEM: Item = {
    id: ItemId.Item2,
    uniqueId: 'dague-2',
    image: '',
    tooltip: '',
    selected: true,
};
export const SELECTED_FLAG: Item = {
    id: ItemId.ItemFlag,
    uniqueId: 'item-1-flag-selected',
    image: '',
    tooltip: '',
    selected: true,
};
