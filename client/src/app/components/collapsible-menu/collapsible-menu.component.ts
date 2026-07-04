import { CommonModule } from '@angular/common';
import { AfterViewChecked, AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Game } from '@common/types';
import { CARD_HEIGHT } from '@common/constants';

@Component({
    selector: 'app-collapsible-menu',
    templateUrl: './collapsible-menu.component.html',
    styleUrls: ['./collapsible-menu.component.scss'],
    standalone: true,
    imports: [CommonModule],
})
export class CollapsibleMenuComponent implements AfterViewInit, OnChanges, AfterViewChecked {
    @Input() label: string = '';
    @Input() games: Game[] = [];
    @ViewChild('menu') menu: ElementRef | undefined;

    isMenuOpen: boolean = true;
    gameCount: number = 0;

    constructor(private readonly cdRef: ChangeDetectorRef) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes.games) {
            this.gameCount = this.games.length;
            this.updateMenuHeight();
        }
    }

    ngAfterViewInit() {
        this.updateMenuHeight();
    }

    ngAfterViewChecked() {
        this.updateMenuHeight();
    }

    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        this.updateMenuHeight();
    }

    private updateMenuHeight() {
        if (this.menu) {
            const menuElement = this.menu.nativeElement;

            this.cdRef.detectChanges();

            menuElement.style.height = this.isMenuOpen ? `${Math.max(this.games.length * CARD_HEIGHT, CARD_HEIGHT)}vmin` : '0';
        }
    }
}
