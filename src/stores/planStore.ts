import { defineStore } from "pinia"
import {ref} from 'vue'
export const usePlanerStore = defineStore('planer',()=>{
    const cycleValue = ref<number>(4)
    const year = ref<number>(2024)
    const season = ref<number>(1)
    const month = ref<number>(1)
    const week = ref<number>(1)
})