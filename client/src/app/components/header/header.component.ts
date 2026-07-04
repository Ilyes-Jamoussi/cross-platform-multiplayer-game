import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Routes } from '@app/enums/routes-enums';
import { PlayerService } from '@app/services/player/player.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-header',
    standalone: true,
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    imports: [TranslateModule],
})
export class HeaderComponent {
    constructor(
        private playerService: PlayerService,
        private router: Router,
    ) {}

    goHome() {
        if (this.playerService.roomId) {
            const isEndPage = this.router.url === Routes.End;
            this.playerService.quitGame({ silent: isEndPage });
        } else {
            void this.router.navigate([Routes.Home]);
        }
    }
}
