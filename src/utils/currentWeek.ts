import dayjs from 'dayjs';


export const currentWeek = () => {
    const dayNumber = dayjs().date();
    const weekNumber = Math.ceil(dayNumber / 7);
    return { dayNumber, weekNumber };
};