import { environment } from '../client/src/environments/environment';
import { ItemCategory, ItemId, StatsType, TileTypes } from './enums';
import { GroupedItem } from './interfaces';

export const STAT_PAIRS = {
    [StatsType.Life]: StatsType.Speed,
    [StatsType.Speed]: StatsType.Life,
    [StatsType.Attack]: StatsType.Defense,
    [StatsType.Defense]: StatsType.Attack,
};

export const TILE_IMAGES = new Map<string, string>([
    [TileTypes.Water, './assets/images/water_tile.png'],
    [TileTypes.Ice, './assets/images/ice_tile.png'],
    [TileTypes.Wall, './assets/images/wall_tile.png'],
    [TileTypes.OpenedDoor, './assets/images/opened_door.png'],
    [TileTypes.Door, './assets/images/closed_door.png'],
    [TileTypes.Default, './assets/images/ground_tile.png'],
]);

export const TILE_COST = new Map<string, number>([
    [TileTypes.Water, 2],
    [TileTypes.Ice, 0],
    [TileTypes.OpenedDoor, 1],
    [TileTypes.Default, 1],
]);

export const TILES = Object.values(TileTypes);

export const PRELOAD_TILES = [TileTypes.Default, TileTypes.OpenedDoor];

export const TILE_DESCRIPTIONS = new Map<string, string>([
    [TileTypes.Water, 'map_editor.description.water'],
    [TileTypes.Ice, 'map_editor.description.ice'],
    [TileTypes.Door, 'map_editor.description.door'],
    [TileTypes.Wall, 'map_editor.description.wall'],
]);

export const TILE_NAMES = new Map<string, string>([
    [TileTypes.Water, 'map_editor.water'],
    [TileTypes.Ice, 'map_editor.ice'],
    [TileTypes.Door, 'map_editor.door'],
    [TileTypes.Wall, 'map_editor.wall'],
]);

export const ITEM_DESCRIPTIONS = new Map<string, string>([
    [ItemId.Item1, 'map_editor.description.potion'],
    [ItemId.Item2, 'map_editor.description.sword'],
    [ItemId.Item3, 'map_editor.description.shield'],
    [ItemId.Item4, 'map_editor.description.crane'],
    [ItemId.Item5, 'map_editor.description.resurrection'],
    [ItemId.Item6, 'map_editor.description.dices'],
    [ItemId.Item7, 'map_editor.description.item_random'],
    [ItemId.ItemFlag, 'map_editor.description.flag'],
    [ItemId.ItemStartingPoint, 'map_editor.description.starting_point'],
]);

export const ITEM_SECTIONS_NAMES = new Map<string, string>([
    [ItemCategory.Attributes, 'map_editor.attributes'],
    [ItemCategory.Conditional, 'map_editor.conditionnal'],
    [ItemCategory.Functioning, 'map_editor.working'],
    [ItemCategory.Random, 'map_editor.item_random'],
    [ItemCategory.Flag, 'map_editor.flag'],
    [ItemCategory.Starting, 'map_editor.starting_point'],
]);

export const NON_TERRAIN_TILES = [TileTypes.Door, TileTypes.OpenedDoor, TileTypes.Wall];

export const GRID_SIZE_ITEMS = new Map<string, number>([
    ['10', 2],
    ['15', 4],
    ['20', 6],
]);

export const MAX_PLAYER = new Map<number, number>([
    [10, 2],
    [15, 4],
    [20, 6],
]);

export const MIN_PLAYER = 2;
export const DELETED_ACCOUNT_USERNAME = '[deleted_account]';
export const MIN_PLAYERS_DROP_IN = 3;
export const MIN_REAL_PLAYERS_DROP_IN = 2;
export const MAX_INVENTORY_SIZE = 2;

export const BASE_STAT = 4;
export const MAX_STAT = 6;
export const BOOST = 2;

export const MOVEMENT_DELAY = 150;

export const CARD_HEIGHT = 17.75;

export const FORMAT_CHARACTERS = 19;
export const HOUR_CHANGE = 5;

export const GAME_ROOM_URL = `${environment.serverUrl}/game-room`;
export const VALID_TERRAINS = new Set([TileTypes.Ice, TileTypes.Water, TileTypes.Default, TileTypes.Door, TileTypes.OpenedDoor]);
export const ITEM_VALID_TERRAINS = new Set([TileTypes.Ice, TileTypes.Water, TileTypes.Default, TileTypes.OpenedDoor]);
export const TURN_TIME = 30;
export const COMBAT_TURN_TIME = 50;
export const REDUCED_COMBAT_TIME = 31;
const STARTING_IMAGE_PATH = './assets/items/';

export const ADJACENT_POSITIONS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
];

export const EXTENDED_DIRECTIONS = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
    { x: -1, y: -2 },
    { x: 1, y: 2 },
    { x: -1, y: 2 },
    { x: 2, y: -1 },
    { x: -2, y: -1 },
    { x: 2, y: 1 },
    { x: -2, y: 1 },
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: -2, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 0 },
    { x: -3, y: 0 },
    { x: 0, y: 3 },
    { x: 0, y: -3 },
];

export const ITEM_IMAGE_MAP: Record<ItemId, string> = {
    [ItemId.Item1]: `${STARTING_IMAGE_PATH}1.png`,
    [ItemId.Item2]: `${STARTING_IMAGE_PATH}2.png`,
    [ItemId.Item3]: `${STARTING_IMAGE_PATH}3.png`,
    [ItemId.Item4]: `${STARTING_IMAGE_PATH}4.png`,
    [ItemId.Item5]: `${STARTING_IMAGE_PATH}5.png`,
    [ItemId.Item6]: `${STARTING_IMAGE_PATH}6.png`,
    [ItemId.Item7]: `${STARTING_IMAGE_PATH}7.png`,
    [ItemId.ItemFlag]: `${STARTING_IMAGE_PATH}flag.png`,
    [ItemId.ItemStartingPoint]: `${STARTING_IMAGE_PATH}red.png`,
};
export const GROUPED_ITEMS: GroupedItem[] = [
    {
        sections: [
            {
                label: ItemCategory.Attributes,
                items: [
                    [
                        { id: ItemId.Item1, image: ITEM_IMAGE_MAP[ItemId.Item1], tooltip: 'Vous donne +2 Vies et -1 défense' },
                        { id: ItemId.Item3, image: ITEM_IMAGE_MAP[ItemId.Item3], tooltip: 'Vous donne +2 défense et -1 attaque' },
                    ],
                ],
            },
            {
                label: ItemCategory.Conditional,
                items: [
                    [
                        { id: ItemId.Item2, image: ITEM_IMAGE_MAP[ItemId.Item2], tooltip: 'Si vous avez 3 Vies ou moins vous avez +2 attaque' },
                        {
                            id: ItemId.Item4,
                            image: ITEM_IMAGE_MAP[ItemId.Item4],
                            tooltip: "Si vous avez moins que 2 Vies votre adversaire ne peut pas faire plus qu'un dégat à la fois",
                        },
                    ],
                ],
            },
            {
                label: ItemCategory.Functioning,
                items: [
                    [
                        {
                            id: ItemId.Item5,
                            image: ITEM_IMAGE_MAP[ItemId.Item5],
                            tooltip: 'Une deuxième vie est allouée lors de la première défaite du combat',
                        },
                        {
                            id: ItemId.Item6,
                            image: ITEM_IMAGE_MAP[ItemId.Item6],
                            tooltip: "Chaque fois que vous lancé un dé d'attaque vous avez soit le maximum du dé ou le maximum moins un",
                        },
                    ],
                ],
            },
            {
                label: ItemCategory.Random,
                items: [[{ id: ItemId.Item7, image: ITEM_IMAGE_MAP[ItemId.Item7], tooltip: 'Item Aléatoire' }]],
            },
            {
                label: ItemCategory.Flag,
                items: [[{ id: ItemId.ItemFlag, image: ITEM_IMAGE_MAP[ItemId.ItemFlag], tooltip: 'Drapeau' }]],
            },
            {
                label: ItemCategory.Starting,
                items: [[{ id: ItemId.ItemStartingPoint, image: ITEM_IMAGE_MAP[ItemId.ItemStartingPoint], tooltip: 'Départ Joueur' }]],
            },
        ],
    },
];

export const TEAM_CONFIG = [
    { id: '1', color: '#ef4444', icon: '🔥' },
    { id: '2', color: '#3b82f6', icon: '❄️' },
    { id: '3', color: '#22c55e', icon: '🌿' },
];

export const DIGIT_MULTIPLIER = 10;
export const ID_LENGTH = 4;
export const HALF_PERCENT = 50;
export const FULL_PERCENT = 100;
export const DOM_DELAY = 50;
export const MAX_POLL_ATTEMPTS = 40;
export const POLL_INTERVAL_MS = 50;
export const HTTP_BAD_REQUEST = 400;
export const HALF_PERCENTAGE = 0.5;

export const MAX_N_COLUMNS = 3;
export const LOADING_DOTS_INTERVAL = 500;
export const N_LOADING_DOTS = 3;

export const ESCAPE_PERCENTAGE = 0.4;

export const ERROR_CODE_MONGODB = 11000;
export const POPUP_LENGTH = 3000;
export const SNACKBAR_TIME = 3000;
export const TURN_DELAY = 3;
export const RANDOMIZER = 0.5;
export const COMBAT_TIME = 5;
export const WINNING_CONDITION = 3;
export const DEBOUNCE_TIME = 100;
export const SEARCH_DEBOUNCE_TIME = 300;
export const ICE_DEBUFF = 2;
export const MAX_ESCAPE_ATTEMPTS = 2;

export const MS_IN_SECOND = 1000;
export const SECONDS_IN_MINUTE = 60;
export const PADDED_SECONDS = 10;
export const USERNAME_MAX_LENGTH = 10;
export const MAX_LISTENERS = 15;
export const ITEM_DROP_DELAY = 5000;
export const POPUP_HEIGHT = 250;
export const MAX_SEARCH_LENGTH = 10;
export const MIN_PLAYER_FOR_TEAMS = 4;

export const DRAG_GHOST_OPACITY = '0.85';
export const DRAG_GHOST_Z_INDEX = '10000';
export const DRAG_GHOST_BORDER_RADIUS = '4px';
export const DRAG_DISABLED_OPACITY = '0.40';
export const OFFSCREEN_POSITION = '-9999px';
export const BLANK_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
export const INVALID_COORD = -1;
export const RIGHT_CLICK_BUTTON = 2;
export const LEFT_CLICK_BUTTON = 0;
export const MAX_NB_ACTIONS = 5;
export const VP_POST_ANIMATION_DELAY = 2000;
export const TARGET_SELECTION_SECONDS = 5;
export const FOG_OF_WAR_RADIUS = 2;
