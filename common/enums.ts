export enum VirtualPlayerTypes {
    Defensive = 'Défensif',
    Aggressive = 'Aggressif',
}

export enum ItemCounts {
    SmallItem = 2,
    MediumItem = 4,
    BigItem = 6,
}
export enum StatsType {
    Life = 'life',
    Speed = 'speed',
    Attack = 'attack',
    Defense = 'defense',
}

export enum Players {
    SmallMap = 2,
    MediumMap = 4,
    BigMap = 6,
}

export enum GameSizes {
    Small = 10,
    Medium = 15,
    Big = 20,
}

export enum TileTypes {
    Ice = 'Glace',
    Water = 'Eau',
    Door = 'Porte',
    Wall = 'Mur',
    OpenedDoor = 'PorteOuverte',
    Default = 'TuileDeBase',
}

export enum ItemTypes {
    StartingPoint = 'StartingPoint',
    UnusedStartingPoint = 'UnusedSpawnPoint',
    Flag = 'flag',
    Item = 'item',
}

export enum Directions {
    Up = 'up',
    Down = 'down',
    Left = 'left',
    Right = 'right',
}

export enum GameModes {
    CTF = 'CTF',
    Classic = 'Classic',
}

export enum ItemId {
    Item1 = 'item-1-Potion',
    Item2 = 'item-2-Dague',
    Item3 = 'item-3-Bouclier',
    Item4 = 'item-4-Poison',
    Item5 = 'item-5-Revie',
    Item6 = 'item-6-Dé',
    Item7 = 'item-7',
    ItemFlag = 'item-flag',
    ItemStartingPoint = 'item-StartingPoint-red',
}

export enum ItemCategory {
    Attributes = 'Attributs',
    Conditional = 'Conditionnel',
    Functioning = 'Fonctionnement',
    Random = 'Item Aléatoire',
    Flag = 'Drapeau',
    Starting = 'Positions de Départ',
}

export enum DoorState {
    Open = 'open',
    Closed = 'closed',
}

export enum Actions {
    Attack = 'attack',
    Escape = 'escape',
    StartCombat = 'startCombat',
}

export enum CombatResults {
    AttackDefeated = 'attackDefeated',
    AttackNotDefeated = 'attackNotDefeated',
    EscapeSucceeded = 'escapeSucceeded',
    EscapeFailed = 'escapeFailed',
    CombatStarted = 'combatStarted',
    TargetSelected = "TargetSelected",
}

export enum LobbyGameMode {
    Classic = 'classic',
    Teams = 'teams',
    FastElimination = 'fastElimination',
}

export enum PlayerState {
    ACTIVE = 'active',
    ELIMINATED = 'eliminated',
    SPECTATOR = 'spectator',
}

export enum GameState {
    Public = 'public',
    Private = 'private',
    PrivateShared = 'private-shared',
}

export enum PlayerStatus {
    Online = 'online',
    Offline = 'offline',
    InCombat = 'inCombat',
}
