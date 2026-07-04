import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { TimeService } from '@app/services/time/time.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-timer',
    standalone: true,
    templateUrl: './timer.component.html',
    styleUrls: ['./timer.component.scss'],
    imports: [CommonModule],
})
export class TimerComponent implements OnInit, OnDestroy {
    time: number | string = '--';
    private timerSubscription?: Subscription;
    private readonly lowTime: number = 5;

    constructor(private readonly timeService: TimeService) {}

    ngOnInit() {
        this.timeService.reset();
        this.timerSubscription = this.timeService.getTimeObservable().subscribe((time) => {
            this.time = time;
        });
    }

    isLowTime(): boolean {
        return typeof this.time === 'number' && this.time <= this.lowTime;
    }

    ngOnDestroy() {
        this.timerSubscription?.unsubscribe();
    }
}
