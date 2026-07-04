export const AUTH_MESSAGES = {
    usernameTaken: 'server_msg.username_taken',
    alreadyLoggedIn: 'server_msg.already_logged_in',
    noToken: 'No token provided',
    noSessionToken: 'No session token provided',
    userNotFound: 'User not found',
    invalidSession: 'server_msg.invalid_session',
    invalidToken: 'Invalid token',
};

export const GAME_ROOM_MESSAGES = {
    playerKicked: 'server_msg.player_kicked',
    hostLeft: 'server_msg.host_left',
    roomNotFound: 'server_msg.room_not_found',
    avatarTaken: 'server_msg.avatar_taken',
    combatStartError: 'server_msg.combat_start_error',
    createRoomError: 'Failed to create room',
};

export const BOARD_MESSAGES = {
    noGamesFound: 'server_msg.no_games_found',
    gameNotFound: 'server_msg.game_not_found',
    mapNotFound: 'server_msg.map_not_found',
    gameNotConform: 'server_msg.game_not_conform',
    internalError: 'Internal server error',
    saveError: 'server_msg.save_error',
    editError: 'server_msg.edit_error',
    validationErrors: 'server_msg.validation_errors',
};

export const BOARD_VALIDATION_MESSAGES = {
    invalidDoor: (row: number, col: number) => `server_msg.invalid_door|${JSON.stringify({ row: row + 1, col: col + 1 })}`,
    inaccessibleTiles: 'server_msg.inaccessible_tiles',
    lowTerrainCoverage: (percentage: number) => `server_msg.low_terrain_coverage|${JSON.stringify({ percentage })}`,
    missingStartingPoints: 'server_msg.missing_starting_points',
    notEnoughItems: 'server_msg.not_enough_items',
    missingFlag: 'server_msg.missing_flag',
    itemsOnWall: 'server_msg.items_on_wall',
    duplicateName: (name: string) => `server_msg.duplicate_name|${JSON.stringify({ name })}`,
};
