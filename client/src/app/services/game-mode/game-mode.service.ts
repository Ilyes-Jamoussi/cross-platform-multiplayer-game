import { Injectable } from '@angular/core';
import { GameModes, LobbyGameMode } from '@common/enums';
import { FlagCapturedPayload, FlagHolderPayload, Player, Team, BoardCell } from '@common/interfaces';
import { PlayerService } from '@app/services/player/player.service';
import { ActiveGameEvents, CTFEvents, GameRoomEvents } from '@common/gateway-events';
import { Position } from '@common/types';
import { SocketService } from '@app/services/socket/socket.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class GameModeService {
    private _gameMode: GameModes;
    private _lobbyGameMode: LobbyGameMode;
    private _teams: Team[] = [];
    private _flagGoal: Position | undefined;
    private _isFlagTaken: boolean;
    private _flagHolder: Player | undefined;
    private readonly _winningTeamSubject = new BehaviorSubject<Player[]>([]);
    private _isInitialised = false;
    private _isFogOfWar = false;
    private _isDropInDropOut = false;

    constructor(
        private readonly playerService: PlayerService,
        private readonly socketService: SocketService,
    ) {}

    get gameMode() {
        return this._gameMode;
    }
    get lobbyGameMode() {
        return this._lobbyGameMode;
    }
    get teams() {
        return this._teams;
    }
    get winningTeamSubject() {
        return this._winningTeamSubject;
    }
    get flagHolder() {
        return this._flagHolder;
    }
    get isFogOfWar() {
        return this._isFogOfWar;
    }
    get isDropInDropOut() {
        return this._isDropInDropOut;
    }
    set flagHolder(player: Player | undefined) {
        this._flagHolder = player;
    }
    set gameMode(mode: GameModes) {
        this._gameMode = mode;
    }
    set lobbyGameMode(mode: LobbyGameMode) {
        this._lobbyGameMode = mode;
    }
    set isFogOfWar(value: boolean) {
        this._isFogOfWar = value;
    }
    set isDropInDropOut(value: boolean) {
        this._isDropInDropOut = value;
    }

    onInit() {
        this.socketService.on<{ teams: Team[] }>(GameRoomEvents.UpdateTeams, (data) => {
            this.setTeams(data.teams);
        });
        if (this._gameMode === GameModes.CTF && !this._isInitialised) {
            this.setUpCTFListeners();
            this._isInitialised = true;
        }
    }

    setTeams(teams: Team[]): void {
        this._teams = teams.map((team) => ({
            ...team,
            isOwnTeam: team.players.some((player) => player.id === this.playerService.player.id),
        }));
    }

    setGameMode(gameMode: GameModes | undefined, lobbyGameMode: LobbyGameMode | undefined, isFogOfWar?: boolean, isDropInDropOut?: boolean) {
        if (gameMode) this._gameMode = gameMode;
        if (lobbyGameMode) this._lobbyGameMode = lobbyGameMode;
        if (isFogOfWar !== undefined) this._isFogOfWar = isFogOfWar;
        if (isDropInDropOut !== undefined) this._isDropInDropOut = isDropInDropOut;
    }

    getTeamId(playerId: string): string {
        if (!this._teams || this._teams.length === 0) return '';

        const playerTeam = this._teams.find((team) => team.players.some((player) => player.id === playerId));
        if (!playerTeam) return '';
        return playerTeam.id;
    }

    isPartOfOwnTeam(playerId: string): boolean {
        if (!this._teams || this._teams.length === 0) return false;

        const playerTeam = this._teams.find((team) => team.players.some((player) => player.id === playerId));
        return playerTeam ? playerTeam.isOwnTeam : false;
    }

    sendMap(map: BoardCell[][]) {
        this.socketService.sendMessage<{ roomId: string; map: BoardCell[][] }>(ActiveGameEvents.MapRequest, {
            roomId: this.playerService.roomId,
            map,
        });
    }

    makeStartingPointGlow(x: number, y: number) {
        return this._isFlagTaken && this._flagGoal && this._flagGoal.x === x && this._flagGoal.y === y;
    }

    showFlagHolder(player: Player | undefined) {
        if (!player) {
            return false;
        }
        return this._flagHolder?.id === player.id;
    }

    isCtf() {
        return this._gameMode === GameModes.CTF;
    }

    isTeamGameMode() {
        return this._lobbyGameMode === LobbyGameMode.Teams;
    }

    onReset() {
        this.removeCTFListeners();
        this._teams = [];
        this._flagGoal = undefined;
        this._flagHolder = undefined;
        this._isFlagTaken = false;
        this._isInitialised = false;
        this._isFogOfWar = false;
        this._isDropInDropOut = false;
        this._winningTeamSubject.next([]);
    }

    private setUpCTFListeners() {
        this.socketService.on<FlagHolderPayload>(CTFEvents.FlagTaken, (data) => {
            this._isFlagTaken = true;
            this._flagGoal = data.flagHolder.startingPoint;
            this._flagHolder = data.flagHolder;
        });
        this.socketService.on(CTFEvents.FlagDropped, () => {
            this._isFlagTaken = false;
            this._flagGoal = undefined;
            this._flagHolder = undefined;
        });
        this.socketService.on<FlagCapturedPayload>(CTFEvents.FlagCaptured, (data) => {
            this._isFlagTaken = false;
            this._winningTeamSubject.next(data.winningTeam);
        });
    }

    private removeCTFListeners() {
        this.socketService.off(CTFEvents.FlagTaken);
        this.socketService.off(CTFEvents.FlagDropped);
        this.socketService.off(CTFEvents.FlagCaptured);
    }
}
