import { Actions, Directions, DoorState, GameModes, LobbyGameMode, PlayerState, TileTypes, VirtualPlayerTypes } from './enums';
import { Position } from './types';

export interface Stats {
    life: number;
    speed: number;
    attack: number;
    defense: number;
    maxSpeed?: number;
    maxLife?: number;
}

export interface Player {
    id: string;
    isHost: boolean;
    name?: string;
    avatar?: string;
    stats?: Stats;
    type?: VirtualPlayerTypes;
    victories?: number;
    position?: Position;
    lastDirection?: Directions.Left | Directions.Right;
    startingPoint?: Position;
    escapeAttempts?: number;
    isIceApplied?: boolean;
    isReviveUsed?: boolean;
    inventory?: Item[];
    actionsLeft?: number;
    playerStats?: PlayerStats;
    state?: PlayerState;
    isSpectator?: boolean;
    firebaseUid?: string;
}
export interface Door {
    DoorState: any;
    state: DoorState.Open | DoorState.Closed;
    position: Position;
}

export interface Combat {
    attacker: string;
    defender: string;
    turn: string;
    initialStats: {
        attacker: Stats;
        defender: Stats;
    };
    finished?: boolean;
    teamCombat?: TeamCombatState;
}

export interface AttackCalculation {
    damage: number;
    attackResult: number;
    diceAttackValue: number;
    diceDefenseValue: number;
    effectiveDefense: number;
    effectiveAttack: number;
}

export interface TeamCombatState {
    teamA: string[];
    teamB: string[];
    teamAIndex: number;
    teamBIndex: number;
    isTeamATurn: boolean;
    escaped: string[];
    defeatedPlayerIds: string[];
    initialTeamA: string[];
    initialTeamB: string[];
    playerInitialStats: Record<string, Stats>;
    needsTargetSelection: boolean;
    attacksRemainingInRound: number;
    victoriesAwarded: boolean;
}

export interface CombatActionResult {
    message: string;
    gameState: GameState;
    damage?: number;
    diceAttack?: number;
    diceDefense?: number;
    defense?: number;
    attack?: number;
    finalDice?: FinalDice;
    defeatedPlayerId?: string;
    escapedPlayerId?: string;
    teamCombatContinues?: boolean;
    lastAttackerId?: string;
    lastDefenderId?: string;
    losingPlayerIds?: string[];
    winningPlayerIds?: string[];
    nextVPAttackerId?: string;
}

export interface GameState {
    players: Player[];
    combat?: Combat;
    isEscape?: boolean;
    isGameOver?: boolean;
}

export interface RoomData {
    roomId?: string;
    hostUid?: string;
    map?: Grid;
    mapId?: string;
    gridSize?: number;
    gridImagePayload?: string;
    playerMax: number;
    playerMin: number;
    players: Player[];
    lobbyGameMode?: LobbyGameMode;
    teams?: Team[];
    selectedAvatars: Map<string, string>;
    isFriendsOnly: boolean;
    dropInDropOutEnabled: boolean;
    isLocked: boolean;
    isDebug?: boolean;
    currentTurn?: Player;
    // Set of sockets present in the room at the time of the last `TurnUpdate` broadcast.
    // Used to filter `ResetTimer` on the server side: a drop-in joiner receives their
    // `TurnUpdate` via `client.emit` (private) and thus never appears here — which prevents
    // their reset from re-initializing the current turn's timer for everyone.
    turnAwareSockets?: Set<string>;
    gameState?: GameState;
    startTime?: Date;
    globalStats?: GlobalStats;
    disconnectedPlayers?: Player[];
    flagHolderId?: string;
    logs?: Log[];
    entryFee: number;
    playerUids: Map<string, string>;
    paidPlayers: Set<string>;
    hasGameStarted: boolean;
    isFogOfWar?: boolean;
    statsRecorded?: boolean;
    recordedStatsUids?: Set<string>;
    isHostReady: boolean;
    pendingFirstTurn?: Player;
    readyPlayerIds?: Set<string>;
}

export interface PublicRoomInfo {
    roomId: string;
    players: number;
    playerMax: number;
    gridSize: number;
    gridImagePayload: string;
    hasGameStarted: boolean;
    isOpenToMorePlayers: boolean;
    entryFee: number;
    lobbyGameMode?: LobbyGameMode;
    isFriendsOnly?: boolean;
    hostUid?: string;
}

export interface Message {
    message: string;
    time: string;
    player: Player;
}

export interface MessagePayload extends SocketPayload {
    message: Message;
    roomId: string;
}

export interface Log {
    defendingPlayer?: Player;
    message: Message;
    isCombat?: boolean;
}

export interface CreateGameResponse {
    roomId: string;
}
export interface ItemCell {
    name: string;
    description: string;
    isOffensive?: boolean;
}
export interface BoardCell {
    tile: TileTypes;
    item: ItemCell;
    position?: Position;
    player?: Player;
    canCombat?: boolean;
}
export interface Grid {
    _id: string;
    name: string;
    description: string;
    gameMode: string;
    state: string;
    owner: string;
    ownerName: string;
    gridSize: number;
    nbActions: number;
    imagePayload: string;
    board: BoardCell[][];
    lastModified: string;
}

export interface QueueItem {
    position: Position;
    cost: number;
    path: Path;
    turns: number;
    lastDirection?: string;
}

export interface Path {
    positions: Position[];
    cost: number;
    turns: number;
}

export interface PathfindingResult {
    path?: Path;
    reachableTiles: Position[];
}

export interface Neighbor {
    position: Position;
    direction: string;
}

export interface ProcessNeighborsParams {
    grid: Grid;
    position: Position;
    path: Path;
    cost: number;
    turns: number;
    lastDirection?: string;
    costs: Map<string, number>;
    queue: QueueItem[];
    speed: number;
}

export interface AddToQueueParams {
    queue: QueueItem[];
    neighbor: Neighbor;
    newCost: number;
    path: Path;
    newTurns: number;
    direction: string;
}

export interface PlayerDisconnect {
    isHost: boolean;
    roomId: string;
    playerId?: string;
}
export interface SocketPayload {
    roomId: string;
    token?: string;
}

export interface KickPayload extends SocketPayload {
    player: string;
    roomId: string;
}

export interface VirtualPlayerPayload extends SocketPayload {
    type: VirtualPlayerTypes;
    roomId: string;
}
export interface SelectAvatarPayload extends SocketPayload {
    player: Player;
    roomId: string;
}
export interface TimerUpdatePayload extends SocketPayload {
    timeLeft: number;
    roomId: string;
    isCombat?: boolean;
}

export interface TimerEndPayload extends SocketPayload {
    message: string;
    roomId: string;
    turnEnd?: boolean;
    isCombat?: boolean;
}

export interface TimerInfo {
    roomId: string;
    startValue?: number;
    isCombat?: boolean;
    isCombatOver?: boolean;
}

export interface Coords {
    row: number;
    col: number;
}
export interface DragStartEvent {
    event: DragEvent;
    coords: Coords;
    item: string;
    description: string;
}

export interface Item {
    id: string;
    image: string;
    tooltip: string;
    selected?: boolean;
    uniqueId?: string;
}

export interface Section {
    label: string;
    items: Item[][];
}

export interface GroupedItem {
    sections: Section[];
}

export interface SocketResponse {
    success: boolean;
    message: string;
}

export interface FriendOnlyResponse {
    isFriendsOnly: boolean;
}

export interface LockResponse {
    isLocked: boolean;
}

export interface DropInDropOutResponse {
    dropInDropOutEnabled: boolean;
}

export interface LobbyGameModeResponse {
    lobbyGameMode: LobbyGameMode;
}

export interface DebugResponse {
    isDebug: boolean;
}

export interface SelectAvatarResponse {
    player: Player;
    isDropIn: boolean;
    isDropInSuccess: boolean;
}

export interface JoinAcceptedPayload extends SocketPayload {
    player?: Player;
    hasGameStarted?: boolean;
}

export interface JoinAcceptedPayload extends SocketPayload {
    player?: Player;
    hasGameStarted?: boolean;
}

export interface PlayerAction extends SocketPayload {
    roomId: string;
    playerId: string;
    action: Actions;
    target: Player | undefined;
}

export interface CombatUpdate extends SocketPayload {
    message?: string;
    gameState?: GameState;
    damage?: number;
    diceAttack?: number;
    diceDefense?: number;
    finalDice?: FinalDice;
    defense?: number;
    attack?: number;
    teamCombatContinues?: boolean;
    defeatedPlayerId?: string;
    escapedPlayerId?: string;
    lastAttackerId?: string;
    lastDefenderId?: string;
    losingPlayerIds?: string[];
    winningPlayerIds?: string[];
    nextVPAttackerId?: string;
}

export interface FinalDice {
    attack: number;
    defense: number;
}

export interface CombatAction {
    playerId: string;
    action: Actions.Attack | Actions.Escape;
    roomId: string;
}

export interface MovePlayer {
    roomId: string;
    grid: Grid;
    player: Player;
    path: Path;
    isRightClick?: boolean;
}

export interface PlayerNextPosition {
    player: Player;
    nextPosition: Position;
}
export interface SelectedAvatars {
    selectedAvatars: string[];
}

export interface GameDisconnect {
    roomId?: string;
    playerId: string;
    itemInformation?: ItemInformation;
    remainingPlayers?: Player[];
    disconnectedPlayers?: Player[];
}

export interface ItemInformation {
    inventory: Item[];
    position: Position;
}

export interface TurnUpdate {
    player: Player;
}

export interface ToggleDoor {
    position: Position;
    isOpened: boolean;
    player?: Player;
    roomId?: string;
}

export interface PlayerStats {
    nCombats: number;
    nEvasions: number;
    nVictories: number;
    nDefeats: number;
    hpLost: number;
    hpDealt: number;
    nItemsCollected: number;
    tilesVisited: Position[];
    tilesVisitedPercentage: number;
}

export interface GlobalStats {
    duration: number;
    totalTurns: number;
    tilesVisited: Position[];
    tilesVisitedPercentage: number;
    doorsUsed: Position[];
    doorsUsedPercent: number;
    flagHolders: string[];
}

export interface GameReward {
    uid: string;
    username: string;
    amount: number;
    isWinner: boolean;
}

export interface GameStats {
    players: Player[];
    globalStats: GlobalStats;
    rewards?: GameReward[];
    gameMode?: string;
}

export interface GameData {
    map: Grid;
    teams?: Team[];
    gameMode?: GameModes;
    lobbyGameMode?: LobbyGameMode;
    isFogOfWar?: boolean;
    isDropInDropOut?: boolean;
}

export interface FogOfWarResponse {
    isFogOfWar: boolean;
}

export interface Team {
    players: Player[];
    isOwnTeam: boolean;
    id: string;
    color: string;
    icon: string;
}

export interface ItemUpdate {
    roomId?: string;
    itemPosition?: Position;
    item?: Item;
    playerId: string;
    inventory?: Item[];
}

export interface ItemsDropped {
    roomId?: string;
    inventory: Item[];
    positions: Position[];
}

export interface TradePopupData {
    playerInventory: Item[];
    teammateInventory: Item[];
    playerId: string;
    teammateId: string;
    playerSelected?: Item;
    teammateItemOffered?: Item;
    playerAccepted?: boolean;
    teammateAccepted?: boolean;
}

export interface TradeStartedData {
    playerId: string;
    teammateId: string;
    playerInventory: Item[];
    teammateInventory: Item[];
}

export interface TradeAcceptData {
    playerAId: string;
    playerBId: string;
    playerAAccepted: boolean;
    playerBAccepted: boolean;
}

export interface TradeCompleteData {
    playerAId: string;
    playerBId: string;
    playerAInventory: Item[];
    playerBInventory: Item[];
}

export interface FlagTakenPayload extends SocketPayload {
    roomId: string;
    flagHolderId: string;
}

export interface FlagHolderPayload {
    flagHolder: Player;
}

export interface FlagCapturedPayload {
    winningTeam: Player[];
}

export interface NoMorePlayerPayload {
    player: Player;
}

export interface AvatarUpdate extends SocketPayload {
    roomId: string;
    nextAvatar?: string;
}
