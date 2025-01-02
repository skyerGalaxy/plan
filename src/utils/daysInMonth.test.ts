import { describe, it, expect } from 'vitest';
import { daysInMonth } from './daysInMonth';
import dayjs from 'dayjs';

describe('how many day in the provided month', () => {
    it('should return 31 for January 2023', () => {
        expect(daysInMonth('2023-01-01')).toBe(31);
    });

    it('should return 28 for February 2023 (non-leap year)', () => {
        expect(daysInMonth('2023-02-01')).toBe(28);
    });

    it('should return 29 for February 2024 (leap year)', () => {
        expect(daysInMonth('2024-02-01')).toBe(29);
    });

    it('should return 30 for April 2023', () => {
        expect(daysInMonth('2023-04-01')).toBe(30);
    });

    it('should return the correct number of days for the current month if no date is provided', () => {
        const currentMonthDays = dayjs().daysInMonth();
        expect(daysInMonth()).toBe(currentMonthDays);
    });
});