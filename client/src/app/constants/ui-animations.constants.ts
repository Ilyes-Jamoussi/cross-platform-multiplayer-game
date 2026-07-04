/** Margin after the exit duration before closing MatDialog (safety net if the animation does not notify). */
export const CONFIRM_POPUP_CLOSE_FALLBACK_BUFFER_MS = 100;

/** Confirm / success / info dialog — exit; keep in sync with the fallback timer (+ CONFIRM_POPUP_CLOSE_FALLBACK_BUFFER_MS). */
export const CONFIRM_POPUP_EXIT_MS = 150;
/** Entrance duration; keep backdrop (styles.scss) in sync. Animation = fade only (ease-out / ease-in in components). */
export const CONFIRM_POPUP_ENTER_MS = 200;

/** Shop header — currency change toast visibility. */
export const SHOP_CURRENCY_FEEDBACK_MS = 2000;
