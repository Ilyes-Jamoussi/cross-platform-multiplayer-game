export enum GameRoomEvents {
    JoinGame = 'joinGame',
    LeaveGame = 'leaveGame',
    JoinAccepted = 'joinAccepted',
    JoinDenied = 'joinDenied',
    AvatarUpdate = 'avatarUpdate',
    RoomUpdate = 'roomUpdateResponse',
    KickPlayer = 'kickPlayer',
    ToggleLock = 'toggleLock',
    ToggleFriendOnly = 'toggleFriendOnly',
    ToggleDropInDropOut = 'toggleDropInDropOut',
    SetLobbyGameMode = 'setLobbyGameMode',
    AddVirtualPlayer = 'addVirtualPlayer',
    KickUpdate = 'kickUpdate',
    StartGame = 'startGame',
    UpdateTeams = 'UpdateTeams',
    SelectTeam = 'SelectTeam',
    LeaveTeam = 'LeaveTeam',
    VirtualPlayerTeamChanged = 'VirtualPlayerTeamChanged',
    InsufficientCurrency = 'insufficientCurrency',
    ToggleFogOfWar = 'toggleFogOfWar',
    PublicRoomsUpdate = 'publicRoomsUpdate',
}

export enum ActiveGameEvents {
    CombatStarted = 'combatStarted',
    CombatInitiated = 'combatInitiated',
    CombatAction = 'combatAction',
    CombatUpdate = 'combatUpdate',
    MovePlayer = 'movePlayer',
    PlayerNextPosition = 'playerNextPosition',
    PlayerStartedMoving = 'playerStartedMoving',
    PlayerStoppedMoving = 'PlayerStoppedMoving',
    TurnUpdate = 'turnUpdate',
    NextTurn = 'nextTurn',
    NoMorePlayers = 'noMorePlayers',
    PlayerDisconnect = 'playerDisconnect',
    ToggledDoor = 'toggledDoor',
    DoorUpdate = 'doorUpdated',
    FetchStats = 'fetchStats',
    GameEnded = 'gameEnded',
    MapRequest = 'mapRequest',
    ItemSwapped = 'itemSwapped',
    ItemUpdate = 'itemUpdate',
    ItemsDropped = 'itemsDropped',
    ResetInventory = 'resetInventory',
    ItemPickedUp = 'itemPickedUp',
    TradeInit = 'TradeInit',
    TradeStarted = 'TradeStarted',
    TradeUpdate = 'TradeUpdate',
    TradeAccept = 'TradeAccept',
    TradeCancel = 'TradeCancel',
    TradeComplete = 'TradeComplete',
    DropIn = 'dropIn',
    SpawnPlayer = 'spawnPlayer',
    SelectCombatTarget = 'SelectCombatTarget',
    PlayerReady = 'playerReady',
}

export enum GameChatEvents {
    SendMessage = 'sendMessage',
    ReceiveMessage = 'receiveMessage',
    ReceiveTeamMessage = 'receiveTeamMessage',
}

export enum GlobalChannelEvents {
    SendMessage = 'globalChannel:sendMessage',
    ReceiveMessage = 'globalChannel:receiveMessage',
    AccountDeleted = 'globalChannel:accountDeleted',
}

export enum CustomChannelEvents {
    SendMessage = 'customChannel:sendMessage',
    ReceiveMessage = 'customChannel:receiveMessage',
    RetrieveMessages = 'customChannel:retrieveMessages',
    GiveMessages = 'customChannel:giveMessages',
    Create = 'customChannel:create',
    Join = 'customChannel:join',
    Leave = 'customChannel:leave',
    Search = 'customChannel:search',
    SearchResults = 'customChannel:searchResults',
    ChannelDeleted = 'customChannel:deleted',
    CloseChannel = 'customChannel:close',
    GetJoinedChannels = 'customChannel:getJoined',
    GiveJoinedChannels = 'customChannel:giveJoined',
    Error = 'customChannel:error',
    newOwner = 'customChannel:newOwner',
}

export enum TimerEvents {
    StartTimer = 'start-timer',
    StopTimer = 'stop-timer',
    TimerUpdate = 'timer-update',
    TimerEnd = 'timer-end',
    ResetTimer = 'reset-timer',
}

export enum DebugEvents {
    ToggleDebug = 'debug',
    RequestDebugState = 'requestDebugState',
}

export enum CTFEvents {
    FlagTaken = 'flagTaken',
    FlagDropped = 'flagDropped',
    FlagCaptured = 'flagCaptured',
}

export enum VirtualCurrencyEvents {
    CurrencyUpdate = 'currencyUpdate',
}
