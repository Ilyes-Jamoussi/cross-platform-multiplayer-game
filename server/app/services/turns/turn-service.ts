import { TurnInfo } from '@app/interfaces/turn-service-interfaces';
import { EndGameService } from '@app/services/end-game/end-game.service';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { TimerService } from '@app/services/time/time.service';
import { VirtualCurrencyService } from '@app/services/virtual-currency/virtual-currency.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { MAX_ESCAPE_ATTEMPTS, RANDOMIZER } from '@common/constants';
import { CombatResults, GameModes, LobbyGameMode, PlayerState } from '@common/enums';
import { ActiveGameEvents, CTFEvents } from '@common/gateway-events';
import { GameDisconnect, Player, RoomData, TeamCombatState } from '@common/interfaces';
import { findAvailableTerrainForItem } from '@common/shared-utils';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Server } from 'socket.io';

@Injectable()
export class TurnService implements OnModuleInit {
    private virtualPlayerService: VirtualPlayerService;

    constructor(
        private readonly moduleRef: ModuleRef,
        private readonly gameRoomService: GameRoomService,
        private readonly timeService: TimerService,
        private readonly virtualCurrencyService: VirtualCurrencyService,
        private readonly endGameService: EndGameService,
    ) {}

    onModuleInit() {
        this.virtualPlayerService = this.moduleRef.get(VirtualPlayerService, { strict: false });
    }

    findRoomFromClient(client: string): string | undefined {
        for (const [roomId, room] of this.gameRoomService.rooms.entries()) {
            const playerIndex = room.players.findIndex((player) => player.id === client);
            if (playerIndex !== -1) {
                return roomId;
            }
        }
        return undefined;
    }

    setFirstTurn(roomId: string, players: Player[]) {
        const room = this.gameRoomService.getRoom(roomId);
        if (!room) return;

        const sortedPlayers = players.slice().sort((a, b) => {
            if (b.stats?.maxSpeed !== a.stats?.maxSpeed) {
                return b.stats.maxSpeed - a.stats.maxSpeed;
            }
            return Math.random() - RANDOMIZER;
        });

        room.currentTurn = sortedPlayers[0];
        room.players = sortedPlayers;
        const nbActions = room.map?.nbActions ?? 1;
        if (room.currentTurn) {
            room.currentTurn.actionsLeft = nbActions;
        }

        return room.currentTurn;
    }

    nextTurn(roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);

        if (!room || !room.players.length) return;

        const currentTurn = room.currentTurn;
        const playerOrder = room.players;

        // If there is no current turn, start with first non-eliminated player
        if (!currentTurn) {
            const active = playerOrder.find((player) => player.state !== PlayerState.ELIMINATED);
            room.currentTurn = active || null;
            return room.currentTurn;
        }

        const currentIndex = playerOrder.findIndex((player) => player.id === currentTurn.id);
        if (currentIndex === -1) {
            const active = playerOrder.find((player) => player.state !== PlayerState.ELIMINATED);
            room.currentTurn = active || null;
            return room.currentTurn;
        }

        let nextIndex = (currentIndex + 1) % playerOrder.length;
        let nextPlayer = playerOrder[nextIndex];

        // In Fast Elimination mode, skip eliminated players
        if (room.lobbyGameMode === LobbyGameMode.FastElimination) {
            let attempts = 0;
            while (nextPlayer?.state === PlayerState.ELIMINATED && attempts < playerOrder.length) {
                nextIndex = (nextIndex + 1) % playerOrder.length;
                nextPlayer = playerOrder[nextIndex];
                attempts++;
            }
        }

        room.currentTurn = nextPlayer;
        return room.currentTurn;
    }

    /**
     * Single broadcast of a `TurnUpdate` to the whole room, capturing on the way the set of
     * sockets present. Only these sockets will be allowed to trigger a `ResetTimer` for the
     * current turn (see `TimerGateway.handleResetTimer`). Drop-in joiners who receive a
     * private `TurnUpdate` via `client.emit` after this broadcast are therefore not in this set and
     * cannot re-initialize the ongoing timer.
     */
    broadcastTurnUpdate(server: Server, roomId: string, player: Player | null | undefined): void {
        const room = this.gameRoomService.getRoom(roomId);
        if (!room) return;
        const roomSockets = server.sockets.adapter.rooms.get(roomId);
        room.turnAwareSockets = new Set(roomSockets ?? []);
        server.to(roomId).emit(ActiveGameEvents.TurnUpdate, { player });
    }

    async handlePlayerQuit(roomId: string, quittingPlayerId: string, server: Server, preserveObserverSlot = false): Promise<boolean | Player> {
        const room = this.gameRoomService.getRoom(roomId);
        if (!room || !room.map) return false;

        if (room.statsRecorded) return true;

        const quittingPlayer = room.players.find((player) => player.id === quittingPlayerId);
        const shouldKeepObserver = this.shouldKeepObserverInRoom(room, quittingPlayer, preserveObserverSlot);
        if (!shouldKeepObserver && quittingPlayer) {
            quittingPlayer.firebaseUid = room.playerUids.get(quittingPlayerId);
            room.disconnectedPlayers = room.disconnectedPlayers ?? [];
            room.disconnectedPlayers.push(quittingPlayer);
            if (room.hasGameStarted) {
                this.endGameService.setGlobalStats(room);
                await this.endGameService.recordPlayerQuit(room, quittingPlayer);
            }
        }
        if (room.flagHolderId === quittingPlayerId) {
            room.flagHolderId = undefined;
            server.to(roomId).emit(CTFEvents.FlagDropped);
        }
        if (shouldKeepObserver) {
            return true;
        }
        const noMorePlayers = await this.handleNoMorePlayers(room, { server, roomId, quittingPlayerId });
        if (noMorePlayers) return noMorePlayers;

        const oneTeamLeft = await this.handleOneTeamLeft(room, { server, roomId, quittingPlayerId });
        if (oneTeamLeft) return true;

        const combatDisconnect = this.handleCombatDisconnect({ server, roomId, quittingPlayerId }, room, quittingPlayer);
        if (combatDisconnect) return combatDisconnect;
        return this.handleDisconnectEnd(room, { server, roomId, quittingPlayerId }, quittingPlayer);
    }

    private async handleNoMorePlayers(room: RoomData, turnInfo: TurnInfo) {
        const remainingPlayers = room.players.filter((player) => player.id !== turnInfo.quittingPlayerId);
        const isActiveFn = (p: Player) => p.state !== PlayerState.ELIMINATED && !p.isSpectator;
        const activePlayers = room.lobbyGameMode === LobbyGameMode.FastElimination ? remainingPlayers.filter(isActiveFn) : remainingPlayers;

        if (activePlayers.length <= 1 || activePlayers.filter((player) => !player.type).length === 0) {
            const lastPlayer = activePlayers[0];

            if (room.statsRecorded) {
                this.gameRoomService.removeRoom(turnInfo.roomId);
                return true;
            }

            if (room.hasGameStarted && lastPlayer) {
                this.endGameService.setGlobalStats(room);
                const winnerSocketIds = [lastPlayer.id];
                const rewards = await this.virtualCurrencyService.distributeEndGameRewards(room, winnerSocketIds, [turnInfo.quittingPlayerId]);

                const allPlayers = [...room.players.filter((p) => p.id !== turnInfo.quittingPlayerId), ...(room.disconnectedPlayers || [])];
                await this.endGameService.recordPlayerStats(room, allPlayers, winnerSocketIds);

                turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.GameEnded, {
                    players: allPlayers,
                    globalStats: room.globalStats,
                    rewards,
                    gameMode: room.map?.gameMode,
                });
            } else {
                turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.NoMorePlayers, {
                    player: lastPlayer,
                });
            }

            this.timeService.stopTimer({ roomId: turnInfo.roomId });
            this.gameRoomService.removeRoom(turnInfo.roomId);
            return true;
        }
    }

    private async handleOneTeamLeft(room: RoomData, turnInfo: TurnInfo): Promise<boolean> {
        if (!room.teams || room.teams.length === 0) return false;
        if (room.statsRecorded) return false;

        const remainingPlayers = room.players.filter((p) => p.id !== turnInfo.quittingPlayerId);

        const teamsStillAlive = room.teams.filter(
            (t) => t.players?.filter((tp) => tp.id !== turnInfo.quittingPlayerId).some((tp) => remainingPlayers.some((rp) => rp.id === tp.id)),
        );

        if (teamsStillAlive.length !== 1) return false;

        this.endGameService.setGlobalStats(room);
        const winnerSocketIds = remainingPlayers.map((p) => p.id);
        const rewards = await this.virtualCurrencyService.distributeEndGameRewards(room, winnerSocketIds);

        const allPlayers = [...room.players.filter((p) => p.id !== turnInfo.quittingPlayerId), ...(room.disconnectedPlayers || [])];
        await this.endGameService.recordPlayerStats(room, allPlayers, winnerSocketIds);

        turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.GameEnded, {
            players: allPlayers,
            globalStats: room.globalStats,
            rewards,
            gameMode: room.map?.gameMode,
        });

        this.timeService.stopTimer({ roomId: turnInfo.roomId });
        this.gameRoomService.removeRoom(turnInfo.roomId);
        return true;
    }

    // eslint-disable-next-line complexity
    private handleCombatDisconnect(turnInfo: TurnInfo, room: RoomData, quittingPlayer: Player): boolean | Player | undefined {
        if (!room.gameState?.combat) return;

        const combat = room.gameState.combat;

        if (combat.teamCombat) {
            this.dropDisconnectedPlayerItems(quittingPlayer, turnInfo.roomId, room, turnInfo.server);
            const result = this.handleTeamCombatDisconnect(turnInfo.quittingPlayerId, turnInfo.roomId, room, quittingPlayer);
            if (!result) return;

            turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.CombatUpdate, result);
            turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.PlayerDisconnect, {
                playerId: turnInfo.quittingPlayerId,
                remainingPlayers: room.players.filter((p) => p.id !== turnInfo.quittingPlayerId),
                itemInformation: { inventory: quittingPlayer?.inventory ?? [], position: quittingPlayer?.position },
                disconnectedPlayers: [...(room.disconnectedPlayers || [])],
            } as GameDisconnect);
            return true;
        }

        const isQuitterCombatant = combat.attacker === turnInfo.quittingPlayerId || combat.defender === turnInfo.quittingPlayerId;

        // Quitting player is NOT a combatant (third party disconnect during someone else's combat)
        if (!isQuitterCombatant) {
            this.dropDisconnectedPlayerItems(quittingPlayer, turnInfo.roomId, room, turnInfo.server);
            turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.PlayerDisconnect, {
                playerId: turnInfo.quittingPlayerId,
                remainingPlayers: room.players.filter((player) => player.id !== turnInfo.quittingPlayerId),
                itemInformation: { inventory: quittingPlayer?.inventory ?? [], position: quittingPlayer?.position },
                disconnectedPlayers: [...(room.disconnectedPlayers || [])],
            } as GameDisconnect);
            return true;
        }

        // --- 1v1: Quitting player IS a combatant ---
        const winnerId = combat.attacker === turnInfo.quittingPlayerId ? combat.defender : combat.attacker;
        const winningPlayer = room.players.find((player) => player.id === winnerId);
        const isQuitterAttacker = combat.attacker === turnInfo.quittingPlayerId;

        // 1) Update victory/defeat stats
        if (winningPlayer) {
            winningPlayer.playerStats.nVictories++;
            if (!(room.map?.gameMode === GameModes.Classic && room.lobbyGameMode === LobbyGameMode.FastElimination)) {
                winningPlayer.victories = (winningPlayer.victories ?? 0) + 1;
            }
        }
        if (quittingPlayer) {
            quittingPlayer.playerStats.nDefeats++;
        }

        // 2) Restore stats from initialStats (spread copy to avoid shared references)
        if (winningPlayer) {
            winningPlayer.stats = { ...(isQuitterAttacker ? combat.initialStats.defender : combat.initialStats.attacker) };
            winningPlayer.stats.life = winningPlayer.stats.maxLife;
            winningPlayer.isReviveUsed = false;
            winningPlayer.isIceApplied = false;
            winningPlayer.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        }
        if (quittingPlayer) {
            quittingPlayer.stats = { ...(isQuitterAttacker ? combat.initialStats.attacker : combat.initialStats.defender) };
            quittingPlayer.isReviveUsed = false;
            quittingPlayer.isIceApplied = false;
            quittingPlayer.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        }

        // 3) Update gameState.players with winner first (client expects this order)
        if (winningPlayer && quittingPlayer) {
            room.gameState.players = [winningPlayer, quittingPlayer];
        }
        room.gameState.isEscape = false;

        // 3b) Drop quitting player's items on the board (must happen before FastElimination sets position to {-1,-1})
        this.dropDisconnectedPlayerItems(quittingPlayer, turnInfo.roomId, room, turnInfo.server);

        // 4) Handle FastElimination: mark loser as eliminated
        if (room.lobbyGameMode === LobbyGameMode.FastElimination && quittingPlayer) {
            quittingPlayer.state = PlayerState.ELIMINATED;
            quittingPlayer.isSpectator = true;
            quittingPlayer.position = { x: -1, y: -1 };

            const activePlayers = room.players.filter((p) => p.state !== PlayerState.ELIMINATED && p.id !== turnInfo.quittingPlayerId);
            if (activePlayers.length <= 1) {
                room.gameState.isGameOver = true;
            }
        }

        // 5) Clear combat state
        room.gameState.combat = undefined;

        // 6) Stop combat timer
        this.timeService.stopTimer({ roomId: turnInfo.roomId, isCombat: true });

        // 7) Emit CombatUpdate so clients properly close the combat UI
        turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.CombatUpdate, {
            message: CombatResults.AttackDefeated,
            gameState: room.gameState,
            defeatedPlayerId: turnInfo.quittingPlayerId,
        });

        // 8) Emit PlayerDisconnect with inventory/position for item drops
        turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.PlayerDisconnect, {
            playerId: turnInfo.quittingPlayerId,
            remainingPlayers: room.players.filter((p) => p.id !== turnInfo.quittingPlayerId),
            itemInformation: { inventory: quittingPlayer?.inventory ?? [], position: quittingPlayer?.position },
            disconnectedPlayers: [...(room.disconnectedPlayers || [])],
        } as GameDisconnect);

        // 9) Handle turn advancement
        if (room.currentTurn?.id === turnInfo.quittingPlayerId) {
            // Quitting player was the current turn player — advance turn
            const nextPlayer = this.nextTurn(turnInfo.roomId);
            this.broadcastTurnUpdate(turnInfo.server, turnInfo.roomId, room.currentTurn);
            // Return the next player so the gateway can trigger VP turnAction if needed
            return nextPlayer || true;
        }

        // Current turn player is someone else (possibly the VP winner)
        this.broadcastTurnUpdate(turnInfo.server, turnInfo.roomId, room.currentTurn);

        // If the VP winner IS the current turn player, continue its turn via afterCombatTurn
        if (winningPlayer?.type && room.currentTurn?.id === winnerId) {
            this.virtualPlayerService.afterCombatTurn(winningPlayer, turnInfo.roomId);
        }

        return true;
    }

    private handleTeamCombatDisconnect(disconnectedId: string, roomId: string, room: RoomData, disconnectedPlayer: Player) {
        const combat = room.gameState?.combat;
        if (!combat?.teamCombat) return null;

        const { teamCombat } = combat;
        const inA = teamCombat.teamA.includes(disconnectedId);
        const inB = teamCombat.teamB.includes(disconnectedId);
        if (!inA && !inB) return null;

        disconnectedPlayer.stats = { ...teamCombat.playerInitialStats[disconnectedId] };
        disconnectedPlayer.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        disconnectedPlayer.isReviveUsed = false;
        teamCombat.escaped.push(disconnectedId);

        this.removeFromTeam(disconnectedId, teamCombat);

        const activeTeam = inA ? teamCombat.teamA : teamCombat.teamB;

        if (activeTeam.length === 0) {
            const winnerOriginalIds = inA ? teamCombat.initialTeamB : teamCombat.initialTeamA;
            const loserOriginalIds = inA ? teamCombat.initialTeamA : teamCombat.initialTeamB;

            if (!teamCombat.victoriesAwarded) {
                teamCombat.victoriesAwarded = true;
                room.players
                    .filter((p) => winnerOriginalIds.includes(p.id))
                    .forEach((p) => {
                        p.victories = (p.victories ?? 0) + 1;
                        if (p.playerStats) p.playerStats.nVictories++;
                    });
            }

            const winningPlayerIds = room.players.filter((p) => winnerOriginalIds.includes(p.id)).map((p) => p.id);
            const losingPlayerIds = room.players.filter((p) => loserOriginalIds.includes(p.id)).map((p) => p.id);

            this.endTeamCombat(room, teamCombat);
            return {
                message: CombatResults.AttackDefeated,
                gameState: room.gameState,
                winningPlayerIds,
                losingPlayerIds,
                defeatedPlayerId: disconnectedId,
            };
        }

        // Team still has members — advance the turn only if it was their turn.
        let nextVPAttackerId: string | undefined;
        if (combat.attacker === disconnectedId) {
            nextVPAttackerId = this.advanceTeamTurn(room, disconnectedPlayer, teamCombat);
        }

        return {
            message: CombatResults.EscapeSucceeded,
            gameState: room.gameState,
            escapedPlayerId: disconnectedId,
            teamCombatContinues: true,
            nextVPAttackerId,
        };
    }

    private removeFromTeam(playerId: string, teamCombat: TeamCombatState) {
        const inA = teamCombat.teamA.includes(playerId);
        if (inA) {
            const idx = teamCombat.teamA.indexOf(playerId);
            teamCombat.teamA.splice(idx, 1);
            if (teamCombat.teamA.length > 0) teamCombat.teamAIndex = teamCombat.teamAIndex % teamCombat.teamA.length;
        } else {
            const idx = teamCombat.teamB.indexOf(playerId);
            teamCombat.teamB.splice(idx, 1);
            if (teamCombat.teamB.length > 0) teamCombat.teamBIndex = teamCombat.teamBIndex % teamCombat.teamB.length;
        }
    }

    private advanceTeamTurn(room: RoomData, justActed: Player, teamCombat: TeamCombatState): string | undefined {
        const combat = room.gameState.combat;
        const actorInA = teamCombat.teamA.includes(justActed.id);

        if (actorInA && teamCombat.teamA.length > 0) {
            teamCombat.teamAIndex = (teamCombat.teamAIndex + 1) % teamCombat.teamA.length;
        } else if (!actorInA && teamCombat.teamB.length > 0) {
            teamCombat.teamBIndex = (teamCombat.teamBIndex + 1) % teamCombat.teamB.length;
        }

        teamCombat.attacksRemainingInRound--;
        if (teamCombat.attacksRemainingInRound <= 0) {
            teamCombat.isTeamATurn = !actorInA;
            const nextTeam = teamCombat.isTeamATurn ? teamCombat.teamA : teamCombat.teamB;
            teamCombat.attacksRemainingInRound = nextTeam.length;
        }

        const nextAttackerId = teamCombat.isTeamATurn ? teamCombat.teamA[teamCombat.teamAIndex] : teamCombat.teamB[teamCombat.teamBIndex];

        const nextAttacker = room.players.find((p) => p.id === nextAttackerId);
        if (!nextAttacker) return undefined;

        combat.attacker = nextAttackerId;
        combat.turn = nextAttackerId;
        combat.defender = '';
        teamCombat.needsTargetSelection = true;

        if (nextAttacker.type) {
            const enemyTeam = teamCombat.isTeamATurn ? teamCombat.teamB : teamCombat.teamA;
            const targetId = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
            combat.defender = targetId;
            const target = room.players.find((p) => p.id === targetId);
            if (target) combat.initialStats.defender = { ...target.stats };
            teamCombat.needsTargetSelection = false;
            return nextAttackerId;
        }

        return undefined;
    }

    private endTeamCombat(room: RoomData, teamCombat: TeamCombatState) {
        room.gameState.players.forEach((p) => {
            const snap = teamCombat.playerInitialStats[p.id];
            if (snap) p.stats = { ...snap };
            p.isReviveUsed = false;
            p.isIceApplied = false;
            p.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        });
        room.gameState.combat = undefined;
        room.gameState.isEscape = false;
    }

    private handleDisconnectEnd(room: RoomData, turnInfo: TurnInfo, quittingPlayer: Player) {
        let nextTurn: Player;
        if (room.currentTurn?.id === turnInfo.quittingPlayerId) {
            nextTurn = this.nextTurn(turnInfo.roomId);
        }
        this.broadcastTurnUpdate(turnInfo.server, turnInfo.roomId, room.currentTurn);
        turnInfo.server.to(turnInfo.roomId).emit(ActiveGameEvents.PlayerDisconnect, {
            roomId: turnInfo.roomId,
            playerId: turnInfo.quittingPlayerId,
            remainingPlayers: room.players.filter((player) => player.id !== turnInfo.quittingPlayerId),
            itemInformation: { inventory: quittingPlayer.inventory ?? [], position: quittingPlayer.position },
            disconnectedPlayers: [...(room.disconnectedPlayers || [])],
        });

        return nextTurn ? nextTurn : true;
    }

    private shouldKeepObserverInRoom(room: RoomData, player?: Player, preserveObserverSlot = false): boolean {
        return (
            preserveObserverSlot &&
            room.hasGameStarted &&
            room.lobbyGameMode === LobbyGameMode.FastElimination &&
            !!player &&
            (player.state === PlayerState.ELIMINATED || !!player.isSpectator)
        );
    }

    private dropDisconnectedPlayerItems(player: Player, roomId: string, room: RoomData, server: Server): void {
        if (!player?.inventory?.length) return;
        const positions = findAvailableTerrainForItem(player.position, room.map.board);
        server.to(roomId).emit(ActiveGameEvents.ItemsDropped, { roomId, inventory: player.inventory, positions });
        player.inventory = [];
    }
}
