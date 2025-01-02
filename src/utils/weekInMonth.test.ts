import { describe, it, expect } from 'vitest';
import { weekInMonth } from './weekInMonth';
import dayjs from 'dayjs';

describe('weekInMonth', () => {
    it('should return 4 for a month with 28 days', () => {
        expect(weekInMonth('2023-02-01')).toBe(4);
    });

    it('should return 4 for a month with 29 days', () => {
        expect(weekInMonth('2024-02-01')).toBe(4);
    });

    it('should return 5 for a month with 30 days', () => {
        expect(weekInMonth('2023-04-01')).toBe(5);
    });

    it('should return 5 for a month with 31 days', () => {
        expect(weekInMonth('2023-01-01')).toBe(5);
    });

    it('should return the correct number of weeks for the current month if no date is provided', () => {
        const currentMonthWeeks = Math.ceil(dayjs().daysInMonth() / 7);
        expect(weekInMonth()).toBe(currentMonthWeeks);
    });
});