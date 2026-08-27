import { describe, it, expect } from 'vitest';
import { getCurrentDate } from './getCurrentDate';

// 注意：getCurrentDate 依赖 Pinia store 和 Supabase，无法在纯单元测试环境运行
// 以下为待完善的集成测试骨架，暂跳过
describe.skip('getCurrentDate', () => {
    it('should return the current year', async () => {
        const { year } = await getCurrentDate();
        expect(year).toBeGreaterThan(2020);
    });

    it('should return the current quarter', async () => {
        const { quarter } = await getCurrentDate();
        expect(quarter).toBeGreaterThanOrEqual(1);
        expect(quarter).toBeLessThanOrEqual(4);
    });

    it('should return the current month', async () => {
        const { month } = await getCurrentDate();
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
    });

    it('should return the days in the current week', async () => {
        const { daysOfWeek } = await getCurrentDate();
        expect(daysOfWeek).toBeGreaterThan(0);
        expect(daysOfWeek).toBeLessThanOrEqual(7);
    });

    it('should return the day index in the current week', async () => {
        const { daysInWeek } = await getCurrentDate();
        expect(daysInWeek).toBeGreaterThan(0);
        expect(daysInWeek).toBeLessThanOrEqual(7);
    });
});
