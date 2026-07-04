// Authentication constants for the game server
// bump to trigger CI
export const MAX_RANDOM_USERNAME = 10000;
export const SESSION_TOKEN_LENGTH = 32;
export const DEFAULT_AVATAR = 'avatar-1';
export const DEFAULT_USERNAME_PREFIX = 'User';
export const BEARER_PREFIX = 'Bearer ';

export const DEFAULT_USER_STATS = {
    virtualCurrency: 1000,
    gamesPlayedClassic: 0,
    gamesPlayedCTF: 0,
    gamesWon: 0,
    totalGameTime: 0,
};
