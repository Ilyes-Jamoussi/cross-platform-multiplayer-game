import { Position } from '@common/types';
import { Grid } from '@common/interfaces';

export interface ActiveClick {
    event: MouseEvent;
    position: Position;
    grid: Grid;
}
