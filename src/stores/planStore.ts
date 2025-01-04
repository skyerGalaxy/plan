import { defineStore } from "pinia"
import {ref} from 'vue'
export const usePlanerStore = defineStore('planer',()=>{
    const year = ref<number>(0)
    const quarter = ref<number>(0)
    const month = ref<number>(0)
    const weeksOfMonth = ref<number>(0)//how many weeks in current month
    const weekInMonth = ref<number>(0)//week index in current month
    const daysOfWeek = ref<number>(0)//days in current week
    const daysInWeek = ref<number>(0)//day index in current week

    return {
        year,
        quarter,
        month,
        weeksOfMonth,
        weekInMonth,
        daysOfWeek,
        daysInWeek
    }
})