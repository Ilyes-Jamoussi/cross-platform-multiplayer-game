import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SHOP_CURRENCY_FEEDBACK_MS } from '@app/constants/ui-animations.constants';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CoinIconComponent } from '@app/components/coin-icon/coin-icon.component';

@Component({
    selector: 'app-shop-menu',
    imports: [AsyncPipe, TranslateModule, CoinIconComponent],
    templateUrl: './shop-menu.component.html',
    styleUrl: './shop-menu.component.scss',
})
export class ShopMenuComponent implements OnInit, OnDestroy {
    userProfile$ = this.authService.userProfile$;
    showAnimation = false;
    animationValue = 0;
    animationClass = '';
    private currencySubscription?: Subscription;
    private feedbackHideTimeoutId?: ReturnType<typeof setTimeout>;

    constructor(
        private readonly authService: AuthService,
        private readonly router: Router,
    ) {}

    ngOnInit(): void {
        this.currencySubscription = this.authService.currencyChange$.subscribe((change) => {
            if (change !== 0) {
                this.animationValue = change;
                this.animationClass = change > 0 ? 'gain' : 'loss';
                this.showAnimation = true;
                this.clearFeedbackHideTimeout();
                this.feedbackHideTimeoutId = setTimeout(() => {
                    this.feedbackHideTimeoutId = undefined;
                    this.showAnimation = false;
                    this.authService.clearCurrencyChangeIndicator();
                }, SHOP_CURRENCY_FEEDBACK_MS);
            }
        });
    }

    ngOnDestroy(): void {
        this.clearFeedbackHideTimeout();
        this.currencySubscription?.unsubscribe();
        this.authService.clearCurrencyChangeIndicator();
    }

    goToShop() {
        void this.router.navigate(['/shop']);
    }

    private clearFeedbackHideTimeout(): void {
        if (this.feedbackHideTimeoutId !== undefined) {
            clearTimeout(this.feedbackHideTimeoutId);
            this.feedbackHideTimeoutId = undefined;
        }
    }
}
