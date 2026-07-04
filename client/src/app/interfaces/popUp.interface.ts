import { TileTypes } from '@common/enums';
import { ItemCell, Player } from '@common/interfaces';

export interface PopUpData {
    item?: ItemCell;
    tile?: TileTypes;
    player?: Player;
    tileInfo?: string;
}
