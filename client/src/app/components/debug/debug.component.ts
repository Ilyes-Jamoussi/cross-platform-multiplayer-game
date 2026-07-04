import { NgClass } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { DebugState } from '@app/enums/debug-enums';
import { DebugService } from '@app/services/debug-service/debug-service.service';
import { PlayerService } from '@app/services/player/player.service';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-debug',
    imports: [NgClass, TranslateModule],
    templateUrl: './debug.component.html',
    standalone: true,
    styleUrl: './debug.component.scss',
})
export class DebugComponent implements OnInit, OnDestroy {
    protected readonly debugState = DebugState;
    private _debug: string = DebugState.OFF;
    private readonly _destroy$ = new Subject<void>();
    constructor(
        private readonly debugService: DebugService,
        private readonly playerService: PlayerService,
    ) {}
    @HostListener('document:keydown.d', ['$event'])
    toggleDebug() {
        if (this.playerService.player.isHost && !(document.activeElement?.tagName === 'INPUT')) {
            this.debugService.toggleDebug(this.playerService.roomId);
        }
    }
    ngOnInit() {
        this.debugService.init(this.playerService.roomId);
        this.debugService.isDebug.pipe(takeUntil(this._destroy$)).subscribe((isDebug) => {
            this._debug = isDebug ? DebugState.ON : DebugState.OFF;
        });
    }

    ngOnDestroy() {
        this.debugService.reset();
        this._destroy$.next();
        this._destroy$.complete();
    }

    getDebug() {
        const debugState: string = this._debug === DebugState.ON ? 'debug.activated' : 'debug.desactivated';
        return debugState;
    }
}
