import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { GameChatComponent } from '@app/components/game-chat/game-chat.component';
import { GameTeamChatComponent } from '@app/components/game-team-chat/game-team-chat.component';
import { LogService } from '@app/services/logs/log.service';
import { DOM_DELAY } from '@common/constants';
import { Log } from '@common/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-log-chat',
    imports: [GameTeamChatComponent, TranslateModule, GameChatComponent],
    templateUrl: './log-chat.component.html',
    styleUrl: './log-chat.component.scss',
    standalone: true,
})
export class LogChatComponent implements OnInit, OnDestroy {
    @Input() isTeamGame: boolean = false;
    @ViewChild('logsContainer') private readonly logsContainer!: ElementRef;
    chosenWindow: string = 'chat';
    areLogsFiltered: boolean = false;
    scrollDown: boolean = true;

    logs: Log[] = [];

    private logSubscription = new Subscription();

    constructor(private readonly logService: LogService) {}

    ngOnInit(): void {
        this.logService.setupListeners();
        this.setupLogListener();
    }

    ngOnDestroy() {
        this.logs = [];
        this.logService.ngOnDestroy();
        this.logSubscription.unsubscribe();
    }

    seeChat() {
        this.chosenWindow = 'chat';
    }

    seeLogs() {
        this.chosenWindow = 'logs';
    }

    seeTeam() {
        this.chosenWindow = 'team';
    }

    filterLogs() {
        this.logService.filterLogs();
        this.areLogsFiltered = !this.areLogsFiltered;
    }

    scrollToBottom() {
        if (this.scrollDown) {
            if (this.logsContainer) {
                setTimeout(() => {
                    const container = this.logsContainer.nativeElement;
                    container.scrollTop = container.scrollHeight;
                }, DOM_DELAY);
            }
        }
    }

    private setupLogListener() {
        this.logSubscription = this.logService.logs.subscribe((logs) => {
            this.logs = logs;
            this.scrollToBottom();
        });
    }
}
