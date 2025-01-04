import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { usePlanerStore } from '@/stores/planStore';

dayjs.extend(quarterOfYear);

export const getCurrentDate = () => {
    //fetch the current date
    const currentYear = dayjs().year();
    const currentQuarter = dayjs().quarter();
    //.month() returns 0-11, so we add 1 to get 1-12
    const currentMonth = dayjs().month()+1;


    // //get the month index in the current quarter
    // const weeksOfMonth = Math.ceil(dayjs().daysInMonth() / 7);


    //get the week index in the current month
    const weekInMonth = Math.ceil(dayjs().date() / 7);
    //Open the app to display the number of days, the default is in the day view
    const daysOfWeek = getDaysOfWeek(weekInMonth);
    //Initial slideIndex
    const daysInWeek = dayjs().date()%7;

    const planStore = usePlanerStore();
    planStore.$patch({
        year: currentYear,
        quarter: currentQuarter,
        month: currentMonth,
        slideCount: daysOfWeek,
        weekViewIndex: weekInMonth,
        dayViewIndex: daysInWeek,
    });

    return {
        year: currentYear,
        quarter: currentQuarter,
        month: currentMonth,
        daysOfWeek: daysOfWeek,
        daysInWeek: daysInWeek
    };
    
};

function getDaysOfWeek(currentWeek: number) {
    const daysInMonth = dayjs().daysInMonth();
    if(currentWeek*7<=daysInMonth){
        return 7;
    }else{
        return daysInMonth - (currentWeek-1)*7;
    }
}