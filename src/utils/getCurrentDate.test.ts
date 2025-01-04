import { describe, it, expect } from 'vitest';
import { getCurrentDate } from './getCurrentDate';




describe('getCurrentDate', () => {
    it('should return the current year', () => {
        const { year } = getCurrentDate();
        expect(year).toBe(2025);
    });

    it('should return the current quarter', () => {
        const { quarter } = getCurrentDate();
        expect(quarter).toBe(1);
    });

    it('should return the current month', () => {
        const { month } = getCurrentDate();
        expect(month).toBe(1);
    });

    it('should return the weeks of the current month', () => {
        const { weeksOfMonth } = getCurrentDate();
        expect(weeksOfMonth).toBe(5);
    });

    it('should return the week index in the current month', () => {
        const { weekInMonth } = getCurrentDate();
        expect(weekInMonth).toBe(1);
    });

    it('should return the days in the current week', () => {
        const { daysOfWeek } = getCurrentDate();
        expect(daysOfWeek).toBe(7);
    });

    it('should return the day index in the current week', () => {
        const { daysInWeek } = getCurrentDate();
        expect(daysInWeek).toBe(3);
    });
});
