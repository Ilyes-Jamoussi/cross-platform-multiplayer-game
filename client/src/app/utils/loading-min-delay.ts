import { DestroyRef } from '@angular/core';
import { MIN_PAGE_LOADING_MS } from '@app/constants/page-loading.constants';

/**
 * Schedules a callback after at least MIN_PAGE_LOADING_MS from startedAtMs.
 * Cancels any previous pending callback; clears on DestroyRef.
 */
export function createLoadingMinDelayScheduler(destroyRef: DestroyRef): {
    schedule: (startedAtMs: number, done: () => void) => void;
} {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cancel = (): void => {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }
    };

    destroyRef.onDestroy(cancel);

    return {
        schedule(startedAtMs: number, done: () => void): void {
            cancel();
            const elapsed = Date.now() - startedAtMs;
            const remaining = Math.max(0, MIN_PAGE_LOADING_MS - elapsed);
            timeoutId = setTimeout(() => {
                timeoutId = undefined;
                done();
            }, remaining);
        },
    };
}
