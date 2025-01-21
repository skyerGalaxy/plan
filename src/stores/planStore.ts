import { defineStore } from "pinia"
import {ref} from 'vue'
import dayjs from "dayjs"


export const usePlanerStore = defineStore('planer',()=>{
    const cycleValue = ref<number>(4)
    const year = ref<number>(0)
    const quarter = ref<number>(0)
    const month = ref<number>(0)
    const slideCount = ref<number>(0)
    const weekViewIndex = ref<number>(0)//current week index in month,1,2,3,4,...
    const dayViewIndex = ref<number>(0)
    
    //active index for every cycle view
    const quarterActiveIndex = ref<number>(0)
    const monthActiveIndex = ref<number>(0)
    const weekActiveIndex = ref<number>(0)
    const dayActiveIndex = ref<number>(0)

    //data for every cycle view
    const quarterData = ref([])
    const monthData = ref([])
    const weekData = ref([])
    const dayData = ref([])

    //Add plan model view's store
    const taskRangeInfo = ref<Object>({label: "重要且紧急", value: 1, class: "priority-urgent-important", symbol: "Ⅰ" })
    const taskRangeIndex = ref<number>(1)//1,2,3,4

    function getSlideCount(): number {
        switch(cycleValue.value){
            case 1:
                return 4;
            case 2:
                return 3;
            case 3:
                const weekOfMonth: number = Math.ceil(dayjs(`${year.value}-${month.value}-01`).daysInMonth() / 7);
                return weekOfMonth;
            case 4:
                const daysInSelectedMonth: number = dayjs(`${year.value}-${month.value}-01`).daysInMonth();
                if (weekViewIndex.value * 7 <= daysInSelectedMonth) {
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
        quarterActiveIndex,
        monthActiveIndex,
        weekActiveIndex,
        dayActiveIndex,
        taskRangeInfo,
        taskRangeIndex,
        quarterData,
        monthData,
        weekData,
        dayData,
        getSlideCount
    }
})