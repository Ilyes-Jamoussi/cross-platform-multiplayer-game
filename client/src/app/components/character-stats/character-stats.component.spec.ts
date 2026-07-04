import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerService } from '@app/services/player/player.service';
import { BASE_STAT, BOOST, MAX_STAT } from '@common/constants';
import { StatsType } from '@common/enums';
import { TranslateModule } from '@ngx-translate/core';
import { CharacterStatsComponent } from './character-stats.component';

describe('CharacterStatsComponent', () => {
    let component: CharacterStatsComponent;
    let fixture: ComponentFixture<CharacterStatsComponent>;
    let mockPlayerService: jasmine.SpyObj<PlayerService>;

    beforeEach(async () => {
        mockPlayerService = jasmine.createSpyObj('PlayerService', [], {
            player: { stats: {} },
        });

        await TestBed.configureTestingModule({
            imports: [CharacterStatsComponent, TranslateModule.forRoot()],
            providers: [{ provide: PlayerService, useValue: mockPlayerService }],
        }).compileComponents();

        fixture = TestBed.createComponent(CharacterStatsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize stats with BASE_STAT', () => {
        expect(component.stats).toEqual({
            life: BASE_STAT,
            speed: BASE_STAT,
            attack: BASE_STAT,
            defense: BASE_STAT,
            maxSpeed: BASE_STAT,
        });
    });

    it('should set player stats in constructor', () => {
        expect(mockPlayerService.player.stats).toEqual(component.stats);
    });

    describe('canValidate', () => {
        it('should return true when conditions are met', () => {
            component.stats = { life: MAX_STAT, speed: BASE_STAT, attack: MAX_STAT, defense: BASE_STAT };
            expect(component.canValidate()).toBeTrue();
        });

        it('should return false when conditions are not met', () => {
            component.stats = { life: BASE_STAT, speed: BASE_STAT, attack: BASE_STAT, defense: BASE_STAT };
            expect(component.canValidate()).toBeFalse();
        });
    });

    describe('toggleStatLS', () => {
        it('should boost life and reset speed', () => {
            component.toggleStat(StatsType.Life);
            expect(component.stats.life).toBe(BASE_STAT + BOOST);
            expect(component.stats.speed).toBe(BASE_STAT);
        });

        it('should boost speed and reset life', () => {
            component.toggleStat(StatsType.Speed);
            expect(component.stats.speed).toBe(BASE_STAT + BOOST);
            expect(component.stats.life).toBe(BASE_STAT);
        });
    });

    describe('toggleStatAD', () => {
        it('should boost attack and reset defense', () => {
            component.toggleStat(StatsType.Attack);
            expect(component.stats.attack).toBe(BASE_STAT + BOOST);
            expect(component.stats.defense).toBe(BASE_STAT);
        });

        it('should boost defense and reset attack', () => {
            component.toggleStat(StatsType.Defense);
            expect(component.stats.defense).toBe(BASE_STAT + BOOST);
            expect(component.stats.attack).toBe(BASE_STAT);
        });
    });

    it('should emit isValidChange when stats are updated', () => {
        spyOn(component.isValidChange, 'emit');
        component.toggleStat(StatsType.Life);
        expect(component.isValidChange.emit).toHaveBeenCalled();
    });

    it('should update player service stats when stats are updated', () => {
        component.toggleStat(StatsType.Life);
        expect(mockPlayerService.player.stats).toEqual(component.stats);
    });
});
