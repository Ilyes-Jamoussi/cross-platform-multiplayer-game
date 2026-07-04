import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@app/services/auth-service/auth-service.service';
import { from, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    return from(authService.getToken()).pipe(
        switchMap((token) => {
            if (token) {
                const sessionToken = authService.getSessionToken();
                let headers = req.headers.set('authorization', `Bearer ${token}`);

                if (sessionToken) {
                    headers = headers.set('x-session-token', sessionToken);
                }

                const cloned = req.clone({ headers });
                return next(cloned);
            }
            return next(req);
        }),
    );
};
