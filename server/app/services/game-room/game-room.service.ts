/* eslint-disable max-lines */
import { EXCLUDED_AVATAR_NAME, VIRTUAL_PLAYER_ID_PREFIX, VIRTUAL_PLAYER_NAMES } from '@app/constants/game-room-constants';
import { BoardService } from '@app/services/board/board.service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { AVATARS } from '@common/avatar';
import {
    BASE_STAT,
    DIGIT_MULTIPLIER,
    HALF_PERCENTAGE,
    ID_LENGTH,
    MAX_PLAYER,
    MAX_STAT,
    MIN_PLAYER,
    MIN_PLAYER_FOR_TEAMS,
    TEAM_CONFIG,
} from '@common/constants';
import { ItemTypes, LobbyGameMode, PlayerState, VirtualPlayerTypes } from '@common/enums';
import { AvatarUpdate, BoardCell, Player, PlayerDisconnect, PublicRoomInfo, RoomData, Stats, Team } from '@common/interfaces';
import { isInBoardBounds } from '@common/shared-utils';
import { Position } from '@common/types';
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GameRoomService {
    readonly onPublicRoomsChanged$ = new Subject<void>().asObservable();
    readonly roomRemoved$ = new Subject<string>();

    private readonly _rooms: Map<string, RoomData> = new Map();
    private readonly publicRoomsChanged$ = new Subject<void>();
    private readonly roomTimeouts: Map<string, Set<NodeJS.Timeout>> = new Map();

    constructor(
        private readonly gameService: BoardService,
        private readonly virtualCurrencyService: VirtualCurrencyService,
    ) {
        this.onPublicRoomsChanged$ = this.publicRoomsChanged$.asObservable();
    }

    get rooms() {
        return this._rooms;
    }

    notifyPublicRoomsChanged() {
        this.publicRoomsChanged$.next();
    }

    getPublicRooms(firebaseUid?: string): PublicRoomInfo[] {
        return Array.from(this._rooms.values())
            .filter((room) => this.isRoomVisibleTo(room, firebaseUid))
            .map((room) => this.toPublicRoomInfo(room, firebaseUid));
    }

    private isRoomVisibleTo(room: RoomData, firebaseUid?: string): boolean {
        if (!room.isHostReady || room.statsRecorded) return false;

        if (!room.hasGameStarted) {
            return !room.isLocked;
        }

        if (room.lobbyGameMode === LobbyGameMode.FastElimination) {
            const canReconnect = !!firebaseUid && this.canReconnectToStartedGame(room.roomId, firebaseUid);
            return canReconnect || this.canDropInToFastElim(room.roomId);
        }

        return !!room.dropInDropOutEnabled;
    }

    private toPublicRoomInfo(room: RoomData, firebaseUid?: string): PublicRoomInfo {
        const isEligibleFastElimObserver =
            room.hasGameStarted &&
            room.lobbyGameMode === LobbyGameMode.FastElimination &&
            !!firebaseUid &&
            this.canReconnectToStartedGame(room.roomId, firebaseUid);

        const players = isEligibleFastElimObserver ? Math.min(room.players.length, Math.max(room.playerMax - 1, 0)) : room.players.length;

        return {
            roomId: room.roomId,
            players,
            playerMax: room.playerMax,
            gridSize: room.gridSize,
            gridImagePayload: room.gridImagePayload,
            hasGameStarted: room.hasGameStarted,
            isOpenToMorePlayers: players < room.playerMax,
            entryFee: room.entryFee,
            lobbyGameMode: room.lobbyGameMode,
            isFriendsOnly: room.isFriendsOnly,
            hostUid: room.isFriendsOnly ? room.hostUid : undefined,
        };
    }

    // A new player can drop in to a FastElim game as long as a slot remains (an eliminated
    // observer does not free their spot in `room.players`) AND a starting point is available.
    canDropInToFastElim(roomId: string): boolean {
        const room = this.getRoom(roomId);
        if (!room) return false;
        if (!room.hasGameStarted || room.statsRecorded) return false;
        if (room.lobbyGameMode !== LobbyGameMode.FastElimination) return false;
        if (room.players.length >= room.playerMax) return false;
        if (!room.map?.board) return false;
        return this.getUnusedStartingPoint(room.map.board, room).length > 0;
    }

    getRoom(roomId: string): RoomData | undefined {
        return this._rooms.get(roomId);
    }

    getTeamRoomId(roomId: string, teamId: string): string {
        return `${roomId}-${teamId}`;
    }

    getPlayerTeam(roomId: string, playerId: string): Team | undefined {
        const room = this.getRoom(roomId);
        return room?.teams?.find((team) => team.players.some((player) => player.id === playerId));
    }

    getPlayers(roomId: string): Player[] {
        const room = this.getRoom(roomId);
        return room.players;
    }

    dropInPlayer(roomId: string, player: Player) {
        const room = this.getRoom(roomId);
        let isSuccess = false;
        const startingPoints = this.getUnusedStartingPoint(room.map.board, room);
        player.playerStats = {
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

        if (startingPoints.length === 0) return isSuccess;

        if (room.lobbyGameMode === LobbyGameMode.Teams && room.teams?.length) {
            const teamsWithPlayers = room.teams.filter((team) => team.players.length > 0);
            if (teamsWithPlayers.length === 0) return isSuccess;

            const smallestTeam = teamsWithPlayers.reduce((prev, current) => (prev.players.length < current.players.length ? prev : current));
            smallestTeam.players.push(player);
            this.setStartingPoints(roomId, { x: startingPoints[0].x, y: startingPoints[0].y }, player);
        } else {
            this.setStartingPoints(roomId, { x: startingPoints[0].x, y: startingPoints[0].y }, player);
        }

        isSuccess = true;
        return isSuccess;
    }
    getUnusedStartingPoint(board: BoardCell[][], room: RoomData) {
        const startingPoints: Position[] = [];
        const players = room.players;
        const usedStartingPoints = players.map((player: Player) => player.startingPoint);
        for (let rowIndex = 0; rowIndex < board.length; rowIndex++) {
            for (let colIndex = 0; colIndex < board[rowIndex].length; colIndex++) {
                const isUsed = usedStartingPoints.some((pos) => pos && pos.x === rowIndex && pos.y === colIndex);
                if (board[rowIndex][colIndex].item.name.includes(ItemTypes.UnusedStartingPoint) && !isUsed && !board[rowIndex][colIndex].player) {
                    startingPoints.push({ x: rowIndex, y: colIndex });
                }
            }
        }
        return startingPoints;
    }

    setStartingPoints(roomId: string, startingPoint: Position, player: Player): void {
        const room = this.getRoom(roomId);
        const playerIndex = room.players.findIndex((p) => p.id === player.id);
        room.players[playerIndex].startingPoint = startingPoint;
        room.players[playerIndex].position = startingPoint;
    }

    async createGameRoom(gameId: string, hostUid: string, entryFee: number = 0): Promise<string> {
        const game = await this.gameService.getGameById(gameId);
        const roomId = this.generateUniqueRoomId();
        this._rooms.set(roomId, {
            roomId,
            hostUid,
            players: [],
            selectedAvatars: new Map<string, string>(),
            mapId: gameId,
            gridSize: game.gridSize,
            gridImagePayload: game.imagePayload,
            playerMax: MAX_PLAYER.get(game.gridSize),
            playerMin: MIN_PLAYER,
            isFriendsOnly: false,
            isLocked: false,
            dropInDropOutEnabled: false,
            lobbyGameMode: LobbyGameMode.Classic,
            currentTurn: null,
            logs: [],
            teams: undefined,
            entryFee,
            playerUids: new Map<string, string>(),
            paidPlayers: new Set<string>(),
            hasGameStarted: false,
            isFogOfWar: false,
            isHostReady: false,
        });
        return roomId;
    }
    async selectAvatar(roomId: string, player: Player, firebaseUid: string): Promise<Player | { error: string }> {
        const room = this.getRoom(roomId);

        if (room.hasGameStarted && !room.dropInDropOutEnabled) {
            const reconnectedPlayer = this.reconnectObserver(roomId, player.id, firebaseUid);
            if (reconnectedPlayer) return reconnectedPlayer;
            if (!this.canDropInToFastElim(roomId)) {
                return { error: 'La partie a deja commence.' };
            }
            // Otherwise fall through to the normal add logic: FastElim accepts a new player
            // (or non-eliminated rejoiner) as long as the room has a free spot.
        }

        // Double click / duplicated HTTP request: the player is already registered with this avatar
        const alreadyJoined = room.players.find((p) => p.id === player.id);
        if (alreadyJoined && alreadyJoined.avatar === player.avatar) {
            return alreadyJoined;
        }

        if (room.entryFee > 0 && !room.paidPlayers.has(firebaseUid)) {
            const currentCurrency = await this.virtualCurrencyService.getCurrency(firebaseUid);
            if (currentCurrency < room.entryFee) {
                return { error: `Cette partie coûte ${room.entryFee} pièces. Vous n'avez que ${currentCurrency} pièces.` };
            }
            await this.virtualCurrencyService.removeCurrency(firebaseUid, room.entryFee, player.id);
            room.paidPlayers.add(firebaseUid);
        }

        room.playerUids.set(player.id, firebaseUid);

        if (!this.isAvatarAvailable(room.players, player.avatar)) return { error: 'Avatar non disponible' };
        player.victories = 0;
        player.name = this.generateUniqueName(player.name, room);
        player.stats.maxSpeed = player.stats.speed;
        player.stats.maxLife = player.stats.life;
        room.selectedAvatars.set(player.id, player.avatar);
        room.players.push(player);

        if (player.isHost) {
            room.isHostReady = true;
        }

        if (room.players.length >= room.playerMax) {
            room.isLocked = true;
        }
        return player;
    }
    async kickPlayer(roomId: string, playerId: string): Promise<boolean> {
        const room = this.getRoom(roomId);
        const playerIndex = room.players.findIndex((playerToKick) => playerToKick.id === playerId);
        if (playerIndex === -1) return false;

        const kickedPlayer = room.players[playerIndex];
        if (room.map?.board && room.hasGameStarted) {
            this.clearPlayerPresenceFromBoard(room, kickedPlayer);
        }

        const kickedUid = room.playerUids.get(playerId);
        if (!room.hasGameStarted && kickedUid && room.paidPlayers.has(kickedUid)) {
            await this.virtualCurrencyService.addCurrency(kickedUid, room.entryFee, playerId);
            room.paidPlayers.delete(kickedUid);
        }

        room.players.splice(playerIndex, 1);
        if (room.teams) {
            room.teams.forEach((team) => {
                team.players = team.players.filter((p) => p.id !== playerId);
            });
        }
        room.selectedAvatars.delete(playerId);
        room.isLocked = false;
        this.validateLobbyMode(room);
        return true;
    }
    addVirtualPlayer(roomId: string, type: VirtualPlayerTypes): Player {
        const room = this.getRoom(roomId);
        const virtualPlayerName = this.generateUniqueVirtualPlayerName(room);
        const virtualPlayer: Player = {
            id: `${VIRTUAL_PLAYER_ID_PREFIX}${uuidv4()}`,
            isHost: false,
            name: virtualPlayerName,
            avatar: this.getRandomAvailableAvatar(room),
            type,
            stats: this.generateRandomStats(),
            victories: 0,
            inventory: [],
        };
        room.players.push(virtualPlayer);
        room.selectedAvatars.set(virtualPlayer.id, virtualPlayer.avatar);

        if (room.players.length === room.playerMax) {
            room.isLocked = true;
        }

        if (room.lobbyGameMode === LobbyGameMode.Teams && room.teams?.length) {
            const availableTeams = room.teams.filter((t) => t.players.length < 2);
            if (availableTeams.length > 0) {
                const smallestTeam = availableTeams.reduce((prev, current) => (prev.players.length <= current.players.length ? prev : current));
                smallestTeam.players.push(virtualPlayer);
            }
        }

        return virtualPlayer;
    }
    getSelectedAvatars(roomId: string) {
        return this.getRoom(roomId).selectedAvatars;
    }
    isFriendsOnly(roomId: string) {
        return this._rooms.get(roomId).isFriendsOnly;
    }
    isLocked(roomId: string) {
        return this.getRoom(roomId).isLocked;
    }
    isDropInDropOut(roomId: string) {
        return this.getRoom(roomId).dropInDropOutEnabled;
    }
    hasStarted(roomId: string) {
        return this.getRoom(roomId).hasGameStarted;
    }
    toggleFriendOnly(roomId: string) {
        this._rooms.get(roomId).isFriendsOnly = !this._rooms.get(roomId).isFriendsOnly;
        return this._rooms.get(roomId).isFriendsOnly;
    }
    toggleLock(roomId: string) {
        const room = this.getRoom(roomId);
        room.isLocked = !room.isLocked;
        return room.isLocked;
    }
    setLobbyGameMode(roomId: string, mode: LobbyGameMode) {
        const room = this.getRoom(roomId);
        if (!room) return;

        room.lobbyGameMode = mode;

        if (mode === LobbyGameMode.Teams) {
            room.teams = this.initializeTeams(roomId);
        } else {
            room.teams = undefined;
        }

        return room;
    }

    assignPlayerToTeam(roomId: string, playerId: string, teamId: string): Team[] {
        const room = this.getRoom(roomId);
        if (!room || !room.teams) return [];

        const player = room.players.find((p) => p.id === playerId);
        if (!player) return room.teams;

        room.teams.forEach((team) => {
            team.players = team.players.filter((p) => p.id !== playerId);
        });

        const targetTeam = room.teams.find((t) => t.id === teamId);
        if (targetTeam && targetTeam.players.length < 2) {
            targetTeam.players.push(player);
        }

        return room.teams;
    }

    removePlayerFromTeam(roomId: string, playerId: string): Team[] {
        const room = this.getRoom(roomId);
        if (!room || !room.teams) return [];

        room.teams.forEach((team) => {
            team.players = team.players.filter((p) => p.id !== playerId);
        });

        return room.teams;
    }

    changeVirtualPlayerTeam(roomId: string, playerId: string, targetTeamId: string): Team[] {
        const room = this.getRoom(roomId);
        if (!room || !room.teams) return [];

        let playerToMove: Player | undefined;

        room.teams.forEach((team) => {
            const found = team.players.find((p) => p.id === playerId);
            if (found) {
                playerToMove = found;
                team.players = team.players.filter((p) => p.id !== playerId);
            }
        });

        if (!playerToMove) return room.teams;
        if (!playerToMove.id.startsWith(VIRTUAL_PLAYER_ID_PREFIX)) return room.teams;

        const target = room.teams.find((t) => t.id === targetTeamId);
        if (target && target.players.length < 2) {
            target.players.push(playerToMove);
        }

        return room.teams;
    }

    hasRoom(roomId: string) {
        return this._rooms.has(roomId);
    }

    canReconnectToStartedGame(roomId: string, firebaseUid: string): boolean {
        const room = this.getRoom(roomId);
        if (!room?.hasGameStarted || room.lobbyGameMode !== LobbyGameMode.FastElimination) return false;

        const previousSocketId = this.findPlayerSocketIdByUid(room, firebaseUid);
        if (!previousSocketId) return false;

        const player = room.players.find((playerToFind) => playerToFind.id === previousSocketId);
        return this.isReconnectableObserver(player);
    }

    reconnectObserver(roomId: string, nextSocketId: string, firebaseUid: string): Player | undefined {
        const room = this.getRoom(roomId);
        if (!room?.hasGameStarted || room.lobbyGameMode !== LobbyGameMode.FastElimination) return undefined;

        const previousSocketId = this.findPlayerSocketIdByUid(room, firebaseUid);
        if (!previousSocketId) return undefined;

        const player = room.players.find((playerToFind) => playerToFind.id === previousSocketId);
        if (!this.isReconnectableObserver(player)) return undefined;

        if (previousSocketId !== nextSocketId) {
            const avatar = room.selectedAvatars.get(previousSocketId);
            room.playerUids.delete(previousSocketId);
            room.playerUids.set(nextSocketId, firebaseUid);

            if (avatar) {
                room.selectedAvatars.delete(previousSocketId);
                room.selectedAvatars.set(nextSocketId, avatar);
            }

            player.id = nextSocketId;

            if (room.currentTurn?.id === previousSocketId) {
                room.currentTurn.id = nextSocketId;
            }

            if (room.flagHolderId === previousSocketId) {
                room.flagHolderId = nextSocketId;
            }

            if (room.gameState?.combat) {
                if (room.gameState.combat.attacker === previousSocketId) {
                    room.gameState.combat.attacker = nextSocketId;
                }
                if (room.gameState.combat.defender === previousSocketId) {
                    room.gameState.combat.defender = nextSocketId;
                }
                if (room.gameState.combat.turn === previousSocketId) {
                    room.gameState.combat.turn = nextSocketId;
                }
            }
        }

        if (room.disconnectedPlayers?.length) {
            room.disconnectedPlayers = room.disconnectedPlayers.filter((playerToKeep) => playerToKeep !== player);
        }

        return player;
    }

    removeGhostPlayer(roomId: string, ghostId: string): void {
        const room = this.getRoom(roomId);
        if (!room) return;

        const index = room.players.findIndex((p) => p.id === ghostId);
        if (index === -1) return;

        const ghost = room.players.splice(index, 1)[0];
        ghost.firebaseUid = room.playerUids.get(ghostId);
        room.selectedAvatars.delete(ghostId);
        room.playerUids.delete(ghostId);

        if (room.map?.board) {
            this.clearPlayerPresenceFromBoard(room, ghost);
        }

        if (room.teams) {
            room.teams.forEach((team) => {
                team.players = team.players.filter((p) => p.id !== ghostId);
            });
        }

        if (!room.disconnectedPlayers?.some((p) => p.id === ghostId)) {
            room.disconnectedPlayers = room.disconnectedPlayers ?? [];
            room.disconnectedPlayers.push(ghost);
        }
    }

    removeRoom(roomId: string) {
        this._rooms.delete(roomId);
        this.clearRoomTimeouts(roomId);
        this.roomRemoved$.next(roomId);
    }

    registerRoomTimeout(roomId: string, timeout: NodeJS.Timeout): NodeJS.Timeout {
        let set = this.roomTimeouts.get(roomId);
        if (!set) {
            set = new Set();
            this.roomTimeouts.set(roomId, set);
        }
        set.add(timeout);
        return timeout;
    }

    unregisterRoomTimeout(roomId: string, timeout: NodeJS.Timeout): void {
        this.roomTimeouts.get(roomId)?.delete(timeout);
    }

    clearRoomTimeouts(roomId: string): void {
        const set = this.roomTimeouts.get(roomId);
        if (!set) return;
        set.forEach((t) => clearTimeout(t));
        this.roomTimeouts.delete(roomId);
    }
    updateAvatar(payload: AvatarUpdate, client: string) {
        const room = this.getRoom(payload.roomId);
        if (room) {
            room.players.forEach((player) => {
                if (player.avatar) {
                    room.selectedAvatars.set(player.id, player.avatar);
                }
            });
            room.selectedAvatars.set(client, payload.nextAvatar);
        }
    }
    async removeClientFromRooms(client: Socket, isGameStarted: boolean): Promise<PlayerDisconnect> {
        for (const [roomId, room] of this._rooms.entries()) {
            const index = room.players.findIndex((player) => player.id === client.id);
            if (index !== -1) {
                const player = room.players[index];

                if (this.shouldPreserveDisconnectedPlayer(room, player, isGameStarted)) {
                    return { isHost: false, roomId };
                }

                room.selectedAvatars.delete(client.id);
                const removedPlayer = room.players.splice(index, 1)[0];
                if (room.map?.board && room.hasGameStarted) {
                    this.clearPlayerPresenceFromBoard(room, removedPlayer);
                }

                return this.finalizePlayerRemoval(room, roomId, client, removedPlayer, isGameStarted);
            }
            const hadAvatar = room.selectedAvatars.delete(client.id);
            if (hadAvatar) {
                return { isHost: false, roomId };
            }
        }
        return { isHost: undefined, roomId: undefined };
    }
    private isAvatarAvailable(players: Player[], playerAvatar: string): boolean {
        return !players.some((player) => player.avatar === playerAvatar);
    }
    private generateUniqueRoomId(): string {
        let roomId: string;
        do {
            roomId = Array.from({ length: ID_LENGTH }, () => Math.floor(Math.random() * DIGIT_MULTIPLIER)).join('');
        } while (this._rooms.has(roomId));
        return roomId;
    }
    private generateUniqueName(name: string, room: RoomData): string {
        let uniqueName = name;
        let suffix = 1;

        while (room.players.some((player) => player.name === uniqueName)) {
            suffix++;
            uniqueName = `${name}-${suffix}`;
        }

        return uniqueName;
    }
    private generateUniqueVirtualPlayerName(room: RoomData): string {
        const existingNames = new Set(room.players.map((player) => player.name));
        const availableNames = VIRTUAL_PLAYER_NAMES.filter((name) => !existingNames.has(name));

        if (availableNames.length > 0) {
            return availableNames[Math.floor(Math.random() * availableNames.length)];
        }

        const randomName = VIRTUAL_PLAYER_NAMES[Math.floor(Math.random() * VIRTUAL_PLAYER_NAMES.length)];
        return this.generateUniqueName(randomName, room);
    }
    private getRandomAvailableAvatar(room: RoomData): string | undefined {
        const allAvatars = AVATARS.filter((avatar) => avatar.name !== EXCLUDED_AVATAR_NAME).map((avatar) => avatar.name);
        const usedAvatars = new Set(room.selectedAvatars.values());
        const availableAvatars = allAvatars.filter((avatar) => !usedAvatars.has(avatar));

        const randomIndex = Math.floor(Math.random() * availableAvatars.length);
        return availableAvatars[randomIndex];
    }
    private generateRandomStats(): Stats {
        const isLifeFour = Math.random() < HALF_PERCENTAGE;
        const isAttackFour = Math.random() < HALF_PERCENTAGE;
        const stats: Stats = {
            life: isLifeFour ? BASE_STAT : MAX_STAT,
            speed: isLifeFour ? MAX_STAT : BASE_STAT,
            attack: isAttackFour ? BASE_STAT : MAX_STAT,
            defense: isAttackFour ? MAX_STAT : BASE_STAT,
        };
        stats.maxLife = stats.life;
        stats.maxSpeed = stats.speed;
        return stats;
    }

    private findPlayerSocketIdByUid(room: RoomData, firebaseUid: string): string | undefined {
        return Array.from(room.playerUids.entries()).find(([, uid]) => uid === firebaseUid)?.[0];
    }

    private isReconnectableObserver(player?: Player): boolean {
        return !!player && (player.state === PlayerState.ELIMINATED || !!player.isSpectator);
    }

    private shouldPreserveDisconnectedPlayer(room: RoomData, player: Player, isGameStarted: boolean): boolean {
        return isGameStarted && !room.statsRecorded && room.lobbyGameMode === LobbyGameMode.FastElimination && this.isReconnectableObserver(player);
    }

    private validateLobbyMode(room: RoomData): void {
        if (room.hasGameStarted) return;
        if (room.lobbyGameMode === LobbyGameMode.Teams && room.players.length < MIN_PLAYER_FOR_TEAMS) {
            room.lobbyGameMode = LobbyGameMode.Classic;
            room.teams = undefined;
        }
    }

    private async finalizePlayerRemoval(
        room: RoomData,
        roomId: string,
        client: Socket,
        removedPlayer: Player,
        isGameStarted: boolean,
    ): Promise<PlayerDisconnect> {
        const leavingUid = room.playerUids.get(client.id);
        if (!room.hasGameStarted && leavingUid && room.paidPlayers.has(leavingUid)) {
            await this.virtualCurrencyService.addCurrency(leavingUid, room.entryFee, client.id);
            room.paidPlayers.delete(leavingUid);
        }

        room.playerUids.delete(client.id);

        if (room.players.length === 0 || (removedPlayer.isHost && !isGameStarted)) {
            if (!room.hasGameStarted && room.entryFee > 0) {
                await this.refundAllPaidPlayers(room);
            }
            this.removeRoom(roomId);
            return { isHost: true, roomId };
        }

        if (room.teams) {
            room.teams.forEach((team) => {
                team.players = team.players.filter((p) => p.id !== client.id);
            });
        }
        this.validateLobbyMode(room);
        return { isHost: false, roomId };
    }

    private clearPlayerPresenceFromBoard(room: RoomData, removedPlayer: Player): void {
        const board = room.map?.board;
        if (!board) return;

        for (const row of board) {
            for (const cell of row) {
                if (cell.player?.id === removedPlayer.id) {
                    cell.player = undefined;
                }
            }
        }

        const startPoint = removedPlayer.startingPoint;
        if (startPoint && isInBoardBounds(startPoint, board.length)) {
            board[startPoint.x][startPoint.y].item.name = ItemTypes.UnusedStartingPoint;
            board[startPoint.x][startPoint.y].item.description = '';
        }
    }

    private async refundAllPaidPlayers(room: RoomData): Promise<void> {
        for (const uid of room.paidPlayers) {
            const socketId = Array.from(room.playerUids.entries()).find(([, u]) => u === uid)?.[0];
            await this.virtualCurrencyService.addCurrency(uid, room.entryFee, socketId);
        }
        room.paidPlayers.clear();
    }

    private initializeTeams(roomId: string): Team[] {
        const room = this.getRoom(roomId);
        if (!room) return [];

        const teamCount = room.playerMax <= MIN_PLAYER_FOR_TEAMS ? 2 : TEAM_CONFIG.length;

        if (!room.teams || room.teams.length === 0) {
            room.teams = TEAM_CONFIG.slice(0, teamCount).map((config) => ({
                ...config,
                players: [],
                isOwnTeam: false,
            }));
        }

        room.players.forEach((player, index) => {
            const teamIndex = index % room.teams.length;
            room.teams[teamIndex].players.push(player);
        });

        return room.teams;
    }
}
