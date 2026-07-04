/// Aligned with `common/gateway-events.ts` (Socket.IO events used by the mobile client).
abstract final class GameRoomSocketEvents {
  static const joinGame = 'joinGame';
  static const leaveGame = 'leaveGame';
  static const joinAccepted = 'joinAccepted';
  static const joinDenied = 'joinDenied';
  static const avatarUpdate = 'avatarUpdate';
  static const roomUpdateResponse = 'roomUpdateResponse';
  static const kickPlayer = 'kickPlayer';
  static const toggleLock = 'toggleLock';
  static const toggleFriendOnly = 'toggleFriendOnly';
  static const toggleDropInDropOut = 'toggleDropInDropOut';
  static const setLobbyGameMode = 'setLobbyGameMode';
  static const addVirtualPlayer = 'addVirtualPlayer';
  static const kickUpdate = 'kickUpdate';
  static const startGame = 'startGame';
  static const updateTeams = 'UpdateTeams';
  static const selectTeam = 'SelectTeam';
  static const leaveTeam = 'LeaveTeam';
  static const virtualPlayerTeamChanged = 'VirtualPlayerTeamChanged';
  static const toggleFogOfWar = 'toggleFogOfWar';
  static const publicRoomsUpdate = 'publicRoomsUpdate';
}

abstract final class VirtualCurrencySocketEvents {
  static const currencyUpdate = 'currencyUpdate';
}

/// Aligned with `GlobalChannelEvents` in `common/gateway-events.ts`.
abstract final class GlobalChannelSocketEvents {
  static const accountDeleted = 'globalChannel:accountDeleted';
}

const deletedAccountUsername = '[deleted_account]';

abstract final class GameChatSocketEvents {
  static const sendMessage = 'sendMessage';
  static const receiveMessage = 'receiveMessage';
  static const receiveTeamMessage = 'receiveTeamMessage';
}

/// Aligned with `CustomChannelEvents` in `common/gateway-events.ts`.
abstract final class CustomChannelSocketEvents {
  static const sendMessage = 'customChannel:sendMessage';
  static const receiveMessage = 'customChannel:receiveMessage';
  static const retrieveMessages = 'customChannel:retrieveMessages';
  static const giveMessages = 'customChannel:giveMessages';
  static const create = 'customChannel:create';
  static const join = 'customChannel:join';
  static const leave = 'customChannel:leave';
  static const search = 'customChannel:search';
  static const searchResults = 'customChannel:searchResults';
  static const channelDeleted = 'customChannel:deleted';
  static const closeChannel = 'customChannel:close';
  static const getJoinedChannels = 'customChannel:getJoined';
  static const giveJoinedChannels = 'customChannel:giveJoined';
  static const newOwner = 'customChannel:newOwner';
  static const error = 'customChannel:error';
}
