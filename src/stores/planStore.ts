import { defineStore } from "pinia"
import {ref} from 'vue'
import dayjs from "dayjs"


export const usePlanerStore = defineStore('planer',()=>{
    const cycleValue = ref<number>(4)
    const year = ref<number>(0)
    const quarter = ref<number>(0)
    const month = ref<number>(0)
    const slideCount = ref<number>(0)
    const weekViewIndex = ref<number>(0)
    const dayViewIndex = ref<number>(0)

    function getSlideCount(): number {
        switch(cycleValue.value){
            case 1:
                return 4;
            case 2:
                return 3;
            case 3:
                const weekOfMonth: number = Math.ceil(dayjs(`${year.value}-${month.value}-01`).daysInMonth() / 7);
                console.log("weekofmonth",weekOfMonth)
                return weekOfMonth;
            case 4:
                const daysInSelectedMonth: number = dayjs(`${year.value}-${month.value}-01`).daysInMonth();
                if (weekViewIndex.value * 7 <= daysInSelectedMonth) {
                    console.log("${year.value}-${month.value}-${weekViewIndex.value}",7)
                    return 7;
                } else {
                    return daysInSelectedMonth - (weekViewIndex.value-1) * 7;
                }
            default:
                return 7;
        }
    }

    return {
        cycleValue,
        year,
        quarter,
        month,
        slideCount,
        weekViewIndex,
        dayViewIndex,
        getSlideCount
    }
})