import { Grid, Player } from '@common/interfaces';

export interface GridInfo {
    roomId: string;
    grid: Grid;
    flagHolder?: Player;
}
