import dayjs from 'dayjs';

export const daysInMonth = (dateString: string = dayjs().format('YYYY-MM-DD')): number => {
    return dayjs(dateString).daysInMonth();
};