import dayjs from 'dayjs';

export const weekInMonth = (dateString: string = dayjs().format('YYYY-MM-DD')): number => {
  const number = dayjs(dateString).daysInMonth();
  return Math.ceil(number / 7);
}


