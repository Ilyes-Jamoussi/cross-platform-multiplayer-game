import { TileTypes } from '@common/enums';
import { TILE_COST } from '@common/constants';
import { TranslateService } from '@ngx-translate/core';

export function getTileInfo(translate: TranslateService): Record<TileTypes, string> {
    const tile = translate.instant('tile_info.tile');
    const cost = (type: TileTypes) => translate.instant('tile_info.cost', { cost: TILE_COST.get(type) });

    const info = (key: string) => translate.instant(`tile_info.${key}`);

    return {
        [TileTypes.Water]: `${tile} : ${TileTypes.Water}\n${info('water_desc')}\n${cost(TileTypes.Water)}`,
        [TileTypes.Ice]: `${tile} : ${TileTypes.Ice}\n${info('ice_desc')}\n${cost(TileTypes.Ice)}`,
        [TileTypes.Door]: `${tile} : ${info('door_closed_name')}\n${info('door_closed_desc')}`,
        [TileTypes.OpenedDoor]: `${tile} : ${info('door_open_name')}\n${info('door_open_desc')}\n${cost(TileTypes.OpenedDoor)}`,
        [TileTypes.Wall]: `${tile} : ${TileTypes.Wall}\n${info('wall_desc')}`,
        [TileTypes.Default]: `${tile} : ${info('default_desc')}\n${cost(TileTypes.Default)}`,
    } as Record<TileTypes, string>;
}
