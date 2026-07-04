import { ItemId } from '@common/enums';
export const ITEM_INFO: Map<string, boolean> = new Map<string, boolean>([
    [ItemId.Item1, false],
    [ItemId.Item2, true],
    [ItemId.Item3, false],
    [ItemId.Item4, false],
    [ItemId.Item5, false],
    [ItemId.Item6, true],
    [ItemId.ItemFlag, true],
]);
export const MILLISECOND_MULTIPLIER = 1000;
export const THINKING_TIME = 2500;
export const ATTACK_BASE_TIME = 1000;
export const ATTACK_DECISION_TIME = 2000;
export const TAKE_ITEM_DELAY = 1000;
