/* eslint-disable max-lines */
import { DAGGER_ATTACK_BONUS, DEBUG_DEFENSE_VALUE, DICE_MIN_VALUE, MIN_LIFE_AFTER_REVIVE, POISON_DAMAGE_CAP } from '@app/constants/combat-constants';
import { GAME_ROOM_MESSAGES } from '@app/constants/messages';
import { GameRoomService } from '@app/services/game-room/game-room.service';
import { ItemService } from '@app/services/items/items.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player-service/virtual-player.service';
import { ADJACENT_POSITIONS, BASE_STAT, ESCAPE_PERCENTAGE, ICE_DEBUFF, MAX_ESCAPE_ATTEMPTS } from '@common/constants';
import { Actions, CombatResults, GameModes, LobbyGameMode, PlayerState, TileTypes } from '@common/enums';
import { AttackCalculation, Combat, CombatActionResult, Player, RoomData, Stats, Team, TeamCombatState } from '@common/interfaces';
import { Position } from '@common/types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CombatService {
    constructor(
        private readonly gameRoomService: GameRoomService,
        private readonly virtualPlayerService: VirtualPlayerService,
        private readonly itemService: ItemService,
    ) {}

    handleStartCombat(playerId: string, roomId: string, target?: Player) {
        if (target && target.id !== playerId) {
            return this.startCombat(playerId, target.id, roomId);
        }
        return { message: GAME_ROOM_MESSAGES.combatStartError };
    }

    startCombat(attackerId: string, defenderId: string, roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);

        if (room.teams && room.teams.length >= 2) {
            const teamA = this.findPlayerTeamId(attackerId, room.teams);
            const teamB = this.findPlayerTeamId(defenderId, room.teams);
            if (teamA && teamB && teamA !== teamB) {
                return this.startTeamCombat(attackerId, defenderId, roomId, teamA, teamB);
            }
        }

        const attacker = room.players.find((p) => p.id === attackerId);
        const defender = room.players.find((p) => p.id === defenderId);
        if (!attacker || !defender) return { message: GAME_ROOM_MESSAGES.combatStartError };
        room.gameState = { players: [attacker, defender] };

        attacker.playerStats.nCombats++;
        defender.playerStats.nCombats++;

        let firstTurnPlayer: string;
        if (attacker.stats.maxSpeed > defender.stats.maxSpeed) {
            firstTurnPlayer = attackerId;
        } else if (defender.stats.maxSpeed > attacker.stats.maxSpeed) {
            firstTurnPlayer = defenderId;
        } else {
            firstTurnPlayer = attackerId;
        }

        const playerToFind = [attacker, defender].find((p) => p.id === firstTurnPlayer);
        if (playerToFind.type) {
            this.virtualPlayerService.combatAnswer(playerToFind, roomId);
        }
        const secondTurnPlayer = firstTurnPlayer === attackerId ? defenderId : attackerId;

        room.gameState.combat = {
            attacker: firstTurnPlayer,
            defender: secondTurnPlayer,
            turn: firstTurnPlayer,
            initialStats: {
                attacker: firstTurnPlayer === attackerId ? { ...attacker.stats } : { ...defender.stats },
                defender: secondTurnPlayer === attackerId ? { ...attacker.stats } : { ...defender.stats },
            },
        };

        this.isIce(attacker.id, roomId);
        this.isIce(defender.id, roomId);
        attacker.isReviveUsed = false;
        defender.isReviveUsed = false;

        return { message: CombatResults.CombatStarted, gameState: room.gameState };
    }

    selectCombatTarget(roomId: string, playerId: string, targetId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState?.combat;
        if (!combat?.teamCombat || combat.attacker !== playerId) return null;

        const { teamCombat } = combat;
        const attackerInA = teamCombat.teamA.includes(playerId);
        const validTargets = attackerInA ? teamCombat.teamB : teamCombat.teamA;
        if (!validTargets.includes(targetId)) return null;

        const target = room.players.find((p) => p.id === targetId);
        if (!target) return null;

        combat.defender = targetId;
        combat.initialStats.defender = { ...target.stats };
        teamCombat.needsTargetSelection = false;

        return { message: CombatResults.TargetSelected, gameState: room.gameState };
    }

    findNextPlayerPosition(newStartingPosition: Position, roomId: string): Position | null {
        if (!newStartingPosition) return null;
        const players = this.gameRoomService.getPlayers(roomId);

        const isCurrentPositionOccupied = players.some((p) => {
            const cell = p.position;
            return cell.x === newStartingPosition.x && cell.y === newStartingPosition.y;
        });

        if (!isCurrentPositionOccupied) return newStartingPosition;

        for (const direction of ADJACENT_POSITIONS) {
            const newX = newStartingPosition.x + direction.x;
            const newY = newStartingPosition.y + direction.y;
            const position: Position = { x: newX, y: newY };
            if (this.isValidPosition(position, roomId)) {
                const isOccupied = players.some((p) => p.position.x === newX && p.position.y === newY);
                if (!isOccupied) return { x: newX, y: newY };
            }
        }
        return newStartingPosition;
    }

    processCombatAction(action: Actions.Attack | Actions.Escape, roomId: string): CombatActionResult | undefined {
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState.combat;
        if (!combat) return;

        const attacker = room.players.find((p) => p.id === combat.attacker);
        const defender = room.players.find((p) => p.id === combat.defender);
        if (!attacker || !defender) return;

        if (action === Actions.Attack) return this.handleAttack(attacker, defender, roomId);
        if (action === Actions.Escape) return this.handleEscape(attacker, defender, roomId);
    }

    handleAttack(attacker: Player, defender: Player, roomId: string): CombatActionResult {
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState.combat;
        const attackResult = this.attack(attacker, defender, roomId);

        if (attackResult.damage < 0) {
            attacker.playerStats.hpDealt += Math.abs(attackResult.damage);
            defender.playerStats.hpLost += Math.abs(attackResult.damage);
        }

        if (this.itemService.applyRevive(roomId, defender.id) && !defender.isReviveUsed && attackResult.attackResult < 0) {
            defender.stats.life = MIN_LIFE_AFTER_REVIVE;
            defender.isReviveUsed = true;
            if (combat.teamCombat) {
                const lastAttackerId = attacker.id;
                const lastDefenderId = defender.id;
                const nextVPAttackerId = this.advanceTeamTurn(roomId, attacker);
                return {
                    message: CombatResults.AttackNotDefeated,
                    gameState: room.gameState,
                    damage: attackResult.damage,
                    diceAttack: attackResult.diceAttackValue,
                    diceDefense: attackResult.diceDefenseValue,
                    defense: attackResult.effectiveDefense,
                    attack: attackResult.effectiveAttack,
                    lastAttackerId,
                    lastDefenderId,
                    nextVPAttackerId,
                };
            } else {
                this.flip1v1Turn(combat, defender, attacker, roomId);
            }
            return {
                message: CombatResults.AttackNotDefeated,
                gameState: room.gameState,
                damage: attackResult.damage,
                diceAttack: attackResult.diceAttackValue,
                diceDefense: attackResult.diceDefenseValue,
                defense: attackResult.effectiveDefense,
                attack: attackResult.effectiveAttack,
            };
        }

        if (attackResult.attackResult > 0) {
            defender.stats.life = Math.min(attackResult.attackResult, defender.stats.maxLife);
            if (combat.teamCombat) {
                const lastAttackerId = attacker.id;
                const lastDefenderId = defender.id;
                const nextVPAttackerId = this.advanceTeamTurn(roomId, attacker);
                return {
                    message: CombatResults.AttackNotDefeated,
                    gameState: room.gameState,
                    damage: attackResult.damage,
                    diceAttack: attackResult.diceAttackValue,
                    diceDefense: attackResult.diceDefenseValue,
                    defense: attackResult.effectiveDefense,
                    attack: attackResult.effectiveAttack,
                    lastAttackerId,
                    lastDefenderId,
                    nextVPAttackerId,
                };
            } else {
                this.flip1v1Turn(combat, defender, attacker, roomId);
            }
            return {
                message: CombatResults.AttackNotDefeated,
                gameState: room.gameState,
                damage: attackResult.damage,
                diceAttack: attackResult.diceAttackValue,
                diceDefense: attackResult.diceDefenseValue,
                defense: attackResult.effectiveDefense,
                attack: attackResult.effectiveAttack,
            };
        }

        if (combat.teamCombat) {
            return this.handleTeamMemberDefeated(attacker, defender, roomId, attackResult);
        }

        this.endCombat(roomId, attacker.id, defender.id);
        if (!this.isClassicFastElimination(room)) {
            attacker.victories += 1;
        }
        attacker.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        defender.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        return {
            message: CombatResults.AttackDefeated,
            gameState: room.gameState,
            finalDice: {
                attack: attackResult.diceAttackValue,
                defense: attackResult.diceDefenseValue,
            },
        };
    }

    handleEscape(attacker: Player, defender: Player, roomId: string): CombatActionResult {
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState.combat;
        const escapeCount = attacker.escapeAttempts > 0 ? attacker.escapeAttempts : MAX_ESCAPE_ATTEMPTS;
        const escapeResult = this.escape();
        attacker.escapeAttempts = escapeCount - 1;

        if (escapeResult.success) {
            attacker.playerStats.nEvasions++;
            attacker.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
            defender.escapeAttempts = MAX_ESCAPE_ATTEMPTS;

            if (combat.teamCombat) {
                return this.handleTeamMemberEscape(attacker, roomId);
            }

            attacker.stats = { ...combat.initialStats.attacker };
            defender.stats = { ...combat.initialStats.defender };
            room.gameState.players = [attacker, defender];
            this.endCombat(roomId, null, null);
            return { message: CombatResults.EscapeSucceeded, gameState: room.gameState };
        }

        if (combat.teamCombat) {
            const lastAttackerId = attacker.id;
            const lastDefenderId = defender.id;
            const nextVPAttackerId = this.advanceTeamTurn(roomId, attacker);
            return {
                message: CombatResults.EscapeFailed,
                gameState: room.gameState,
                lastAttackerId,
                lastDefenderId,
                nextVPAttackerId,
            };
        } else {
            combat.attacker = defender.id;
            combat.defender = attacker.id;
            [combat.initialStats.attacker, combat.initialStats.defender] = [combat.initialStats.defender, combat.initialStats.attacker];
            combat.turn = defender.id;
            if (defender.type) this.virtualPlayerService.combatAnswer(defender, roomId);
        }
        return { message: CombatResults.EscapeFailed, gameState: room.gameState };
    }

    private startTeamCombat(attackerId: string, defenderId: string, roomId: string, teamAId: string, teamBId: string) {
        const room = this.gameRoomService.getRoom(roomId);

        const teamAPlayerIds = this.resolveTeamPlayerIds(teamAId, room);
        const teamBPlayerIds = this.resolveTeamPlayerIds(teamBId, room);

        const allCombatants = [...teamAPlayerIds, ...teamBPlayerIds]
            .map((id) => room.players.find((p) => p.id === id))
            .filter((p): p is Player => !!p);

        room.gameState = { players: allCombatants };

        const playerInitialStats: Record<string, Stats> = {};
        allCombatants.forEach((p) => {
            playerInitialStats[p.id] = { ...p.stats };
            p.playerStats.nCombats++;
            p.isReviveUsed = false;
            this.isIce(p.id, roomId);
        });

        const initiatingAttacker = room.players.find((p) => p.id === attackerId);
        const initiatingDefender = room.players.find((p) => p.id === defenderId);
        const isTeamATurn = initiatingAttacker.stats.maxSpeed >= initiatingDefender.stats.maxSpeed;

        const firstAttackerId = isTeamATurn ? teamAPlayerIds[0] : teamBPlayerIds[0];
        const firstAttacker = room.players.find((p) => p.id === firstAttackerId);
        const prelimDefenderId = isTeamATurn ? teamBPlayerIds[0] : teamAPlayerIds[0];
        const prelimDefender = room.players.find((p) => p.id === prelimDefenderId);

        const teamCombat: TeamCombatState = {
            teamA: [...teamAPlayerIds],
            teamB: [...teamBPlayerIds],
            teamAIndex: 0,
            teamBIndex: 0,
            isTeamATurn,
            escaped: [],
            defeatedPlayerIds: [],
            initialTeamA: [...teamAPlayerIds],
            initialTeamB: [...teamBPlayerIds],
            playerInitialStats,
            needsTargetSelection: true,
            attacksRemainingInRound: isTeamATurn ? teamAPlayerIds.length : teamBPlayerIds.length,
            victoriesAwarded: false,
        };

        room.gameState.combat = {
            attacker: firstAttackerId,
            defender: prelimDefenderId,
            turn: firstAttackerId,
            initialStats: {
                attacker: { ...firstAttacker.stats },
                defender: { ...prelimDefender.stats },
            },
            teamCombat,
        };

        if (firstAttacker.type) {
            const enemyTeam = isTeamATurn ? teamBPlayerIds : teamAPlayerIds;
            const targetId = enemyTeam[0];
            room.gameState.combat.defender = targetId;
            room.gameState.combat.initialStats.defender = { ...room.players.find((p) => p.id === targetId)?.stats };
            teamCombat.needsTargetSelection = false;
        }

        return {
            message: CombatResults.CombatStarted,
            gameState: room.gameState,
            nextVPAttackerId: firstAttacker.type ? firstAttackerId : undefined,
        };
    }

    private handleTeamMemberDefeated(attacker: Player, defender: Player, roomId: string, attackResult: AttackCalculation): CombatActionResult {
        const room = this.gameRoomService.getRoom(roomId);
        const { teamCombat } = room.gameState.combat;

        attacker.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        defender.escapeAttempts = MAX_ESCAPE_ATTEMPTS;
        defender.playerStats.nDefeats++;

        defender.stats = { ...teamCombat.playerInitialStats[defender.id] };
        teamCombat.defeatedPlayerIds.push(defender.id);

        this.removeFromTeam(defender.id, teamCombat);

        const attackerInA = teamCombat.teamA.includes(attacker.id);
        const defendingTeam = attackerInA ? teamCombat.teamB : teamCombat.teamA;

        if (defendingTeam.length === 0) {
            const attackerTeamId = this.findPlayerTeamId(attacker.id, room.teams);
            const winningTeam = room.teams?.find((t) => t.id === attackerTeamId);
            const losingTeamId =
                this.findPlayerTeamId(teamCombat.defeatedPlayerIds[0], room.teams) ??
                (attackerTeamId === room.teams?.[0]?.id ? room.teams?.[1]?.id : room.teams?.[0]?.id);
            const losingTeam = room.teams?.find((t) => t.id === losingTeamId);

            const winningPlayerIds = winningTeam?.players.map((p) => p.id) ?? [];
            const losingPlayerIds = losingTeam?.players.map((p) => p.id) ?? [];

            if (!teamCombat.victoriesAwarded) {
                teamCombat.victoriesAwarded = true;
                const winnerOriginalIds = attackerInA ? teamCombat.initialTeamA : teamCombat.initialTeamB;
                room.players
                    .filter((p) => winnerOriginalIds.includes(p.id))
                    .forEach((p) => {
                        p.victories++;
                        p.playerStats.nVictories++;
                    });
            }

            this.endTeamCombat(roomId);
            return {
                message: CombatResults.AttackDefeated,
                gameState: room.gameState,
                finalDice: { attack: attackResult.diceAttackValue, defense: attackResult.diceDefenseValue },
                losingPlayerIds,
                winningPlayerIds,
                defeatedPlayerId: defender.id,
                lastAttackerId: attacker.id,
                lastDefenderId: defender.id,
            };
        }

        const nextVPAttackerId = this.advanceTeamTurn(roomId, attacker);
        return {
            message: CombatResults.AttackDefeated,
            gameState: room.gameState,
            finalDice: { attack: attackResult.diceAttackValue, defense: attackResult.diceDefenseValue },
            defeatedPlayerId: defender.id,
            teamCombatContinues: true,
            nextVPAttackerId,
            lastAttackerId: attacker.id,
            lastDefenderId: defender.id,
        };
    }

    private handleTeamMemberEscape(escaper: Player, roomId: string): CombatActionResult {
        const room = this.gameRoomService.getRoom(roomId);
        const { teamCombat } = room.gameState.combat;

        escaper.stats = { ...teamCombat.playerInitialStats[escaper.id] };
        teamCombat.escaped.push(escaper.id);

        const escaperInA = teamCombat.teamA.includes(escaper.id);
        this.removeFromTeam(escaper.id, teamCombat);
        const escaperActiveTeam = escaperInA ? teamCombat.teamA : teamCombat.teamB;

        if (escaperActiveTeam.length === 0) {
            this.endTeamCombat(roomId);
            room.gameState.isEscape = true;
            return {
                message: CombatResults.EscapeSucceeded,
                gameState: room.gameState,
            };
        }

        const nextVPAttackerId = this.advanceTeamTurn(roomId, escaper);
        return {
            message: CombatResults.EscapeSucceeded,
            gameState: room.gameState,
            escapedPlayerId: escaper.id,
            teamCombatContinues: true,
            nextVPAttackerId,
        };
    }

    private advanceTeamTurn(roomId: string, justActed: Player) {
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState.combat;
        const { teamCombat } = combat;

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
        if (!nextAttacker) return;

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

    private endTeamCombat(roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        const { teamCombat } = room.gameState.combat;

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

    private removeFromTeam(playerId: string, teamCombat: TeamCombatState) {
        const inA = teamCombat.teamA.includes(playerId);
        if (inA) {
            const idx = teamCombat.teamA.indexOf(playerId);
            teamCombat.teamA.splice(idx, 1);
            if (teamCombat.teamA.length > 0) {
                teamCombat.teamAIndex = teamCombat.teamAIndex % teamCombat.teamA.length;
            }
        } else {
            const idx = teamCombat.teamB.indexOf(playerId);
            teamCombat.teamB.splice(idx, 1);
            if (teamCombat.teamB.length > 0) {
                teamCombat.teamBIndex = teamCombat.teamBIndex % teamCombat.teamB.length;
            }
        }
    }

    private flip1v1Turn(combat: Combat, newAttacker: Player, newDefender: Player, roomId: string) {
        combat.attacker = newAttacker.id;
        combat.defender = newDefender.id;
        [combat.initialStats.attacker, combat.initialStats.defender] = [combat.initialStats.defender, combat.initialStats.attacker];
        combat.turn = newAttacker.id;
        if (newAttacker.type) this.virtualPlayerService.combatAnswer(newAttacker, roomId);
    }

    private findPlayerTeamId(playerId: string, teams: Team[]): string | null {
        for (const team of teams) {
            if (team.players.some((p) => p.id === playerId)) return team.id;
        }
        return null;
    }

    private resolveTeamPlayerIds(teamId: string, room: RoomData): string[] {
        const team = room.teams?.find((t) => t.id === teamId);
        if (!team) return [];
        return team.players.map((p) => p.id).filter((id) => room.players.some((p) => p.id === id));
    }

    private isValidPosition(position: Position, roomId: string): boolean {
        const gridSize = this.gameRoomService.getRoom(roomId).map.gridSize;
        return position.x >= 0 && position.x < gridSize && position.y >= 0 && position.y < gridSize;
    }

    private attack(attacker: Player, defender: Player, roomId: string): AttackCalculation {
        let attackResult = 0;
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState.combat;
        const isDebug = room.isDebug;
        const initialDefenderLife = defender.stats.life;
        const oneDamageCap = this.itemService.applyPoison(roomId, defender.id);
        const daggerEffect = this.itemService.applyDagger(roomId, attacker.id);
        let effectiveAttack = attacker.stats.attack > BASE_STAT ? BASE_STAT : attacker.stats.attack;
        let effectiveDefense = Math.min(defender.stats.defense, BASE_STAT);
        const attackerStats = this.itemService.applyAttributesBuffs(roomId, attacker.id, { attack: effectiveAttack, defense: 0, life: 0, speed: 0 });
        const defenderStats = this.itemService.applyAttributesBuffs(roomId, defender.id, { attack: 0, defense: effectiveDefense, life: 0, speed: 0 });
        if (daggerEffect) attackerStats.attack += DAGGER_ATTACK_BONUS;
        if (oneDamageCap) attackerStats.attack = POISON_DAMAGE_CAP;
        const diceEffect = this.itemService.applyDiceEffect(roomId, attacker.id, combat.initialStats.attacker.attack);
        let diceAttackValue = this.rollDice(combat.initialStats.attacker.attack, isDebug, true);
        if (diceEffect && !isDebug) diceAttackValue = diceEffect;
        const diceDefenseValue = this.rollDice(combat.initialStats.defender.defense, isDebug, false);
        const damage = diceDefenseValue + defenderStats.defense - (diceAttackValue + attackerStats.attack);
        attackResult = damage < 0 ? initialDefenderLife + damage : initialDefenderLife;
        effectiveAttack = attackerStats.attack;
        effectiveDefense = defenderStats.defense;
        return { damage, attackResult, diceAttackValue, diceDefenseValue, effectiveDefense, effectiveAttack };
    }

    private isIce(playerId: string, roomId: string) {
        const room = this.gameRoomService.getRoom(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (!player || player.isIceApplied) return;
        const board = room.map.board;
        const { x, y } = player.position;
        if (board[x][y].tile === TileTypes.Ice) {
            player.stats.attack = BASE_STAT - ICE_DEBUFF;
            player.stats.defense = BASE_STAT - ICE_DEBUFF;
            player.isIceApplied = true;
        }
    }

    private rollDice(numDice: number, isDebug: boolean, isAttack: boolean): number {
        if (isDebug) return isAttack ? numDice : DEBUG_DEFENSE_VALUE;
        return Math.floor(Math.random() * numDice) + DICE_MIN_VALUE;
    }

    private escape() {
        return Math.random() < ESCAPE_PERCENTAGE ? { success: true } : { success: false };
    }

    private endCombat(roomId: string, winnerId: string | null, loserId: string | null) {
        const room = this.gameRoomService.getRoom(roomId);
        const combat = room.gameState.combat;
        if (!combat) return;

        room.gameState.combat = undefined;
        room.gameState.isEscape = true;

        if (winnerId && loserId) {
            const winner = room.players.find((p) => p.id === winnerId);
            const loser = room.players.find((p) => p.id === loserId);
            if (winner && loser) {
                winner.playerStats.nVictories++;
                loser.playerStats.nDefeats++;
                room.gameState.players = [winner, loser];
                room.gameState.isEscape = false;

                winner.isReviveUsed = false;
                loser.isReviveUsed = false;
                winner.stats.life = winner.stats.maxLife;
                loser.stats.life = loser.stats.maxLife;

                room.gameState.players.forEach((p) => (p.isIceApplied = false));
            }
        } else {
            const attacker = room.gameState.players[0];
            const defender = room.gameState.players[1];
            if (attacker && defender) {
                attacker.stats = { ...combat.initialStats.attacker };
                defender.stats = { ...combat.initialStats.defender };
                attacker.isReviveUsed = false;
                defender.isReviveUsed = false;
            }
            room.gameState.players.forEach((p) => (p.isIceApplied = false));
        }

        if (room.lobbyGameMode === LobbyGameMode.FastElimination && loserId) {
            const loser = room.players.find((p) => p.id === loserId);
            if (loser) {
                loser.state = PlayerState.ELIMINATED;
                loser.isSpectator = true;
                loser.position = { x: -1, y: -1 };
            }
        }

        if (room.lobbyGameMode === LobbyGameMode.FastElimination) {
            const activePlayers = room.players.filter((p) => p.state !== PlayerState.ELIMINATED);
            if (activePlayers.length <= 1) {
                room.gameState.isGameOver = true;
            }
        }

        room.gameState.players?.forEach((player) => {
            player.isIceApplied = false;
        });
    }

    private isClassicFastElimination(room: RoomData): boolean {
        return room?.map?.gameMode === GameModes.Classic && room?.lobbyGameMode === LobbyGameMode.FastElimination;
    }
}
