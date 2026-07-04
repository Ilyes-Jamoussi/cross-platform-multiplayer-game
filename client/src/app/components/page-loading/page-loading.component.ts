import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export type PageLoadingLayout = 'full' | 'inline';

/** Number of segments on the ring (360° / 8 = 45° per step, synchronized with steps(8) in CSS). */
const ORBIT_SEGMENT_COUNT = 8;

@Component({
    selector: 'app-page-loading',
    standalone: true,
    imports: [TranslateModule],
    templateUrl: './page-loading.component.html',
    styleUrl: './page-loading.component.scss',
})
export class PageLoadingComponent {
    @Input({ required: true }) messageKey!: string;
    @Input() layout: PageLoadingLayout = 'full';

    /** Indices 0..7 — one arm + pixel per ring segment */
    readonly orbitSlots = [...Array(ORBIT_SEGMENT_COUNT).keys()];
}
