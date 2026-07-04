export interface Timers {
    counter: number;
    interval: NodeJS.Timeout;
}

export const TICK_TIME = 1000;
export const COMBAT_TICK = 100;
