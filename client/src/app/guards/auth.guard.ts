import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
        map((user) => {
            if (user) {
                return true;
            }
            void router.navigate(['/login']);
            return false;
        }),
    );
};
