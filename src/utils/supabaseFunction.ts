import { createClient } from "@supabase/supabase-js";



const supabaseUrl = import.meta.env.VITE_supabaseProjectUrl
const supabaseKey = import.meta.env.VITE_anonKey
const supabase = createClient(supabaseUrl, supabaseKey)

//insert task to quarter table
export async function insertTaskToQuarter(task: string, year: number, quarter: number, isLoop: boolean = false, range: number=1) {
    try {
        await supabase.from("QuarterlyPlans").insert({ year: year, quarter: quarter, task: task, isLoop: isLoop, range: range });
    } catch (error) {
        console.log("error", error);
    }
}

//insert task to month table
export async function insertTaskToMonth(quarter_id: number, year: number, month: number, task: string, isLoop: boolean =false, range: number=1) {
    try {
        await supabase.from("MonthlyPlans").insert({ quarterly_id: quarter_id, year: year, month: month, task: task, isLoop: isLoop, range: range });
    } catch (error) {
        console.log("error", error);
    }
}

//insert task to week table
export async function insertTaskToWeek(monthly_id: number, year: number, month: number, week: number, task: string, isLoop: boolean = false, range: number = 1) {
    try {
        await supabase.from("WeeklyPlans").insert({ monthly_id: monthly_id, year: year, month: month, week: week, task: task, isLoop: isLoop, range: range });
    } catch (error) {
        console.log("error", error);
    }
}

//insert task to day table
export async function insertTaskToDay(weekly_id: number, year: number, month: number, week: number, day: String, task: string, pomodoro_count: number, range: number = 1) {
    try {
        await supabase.from("DailyPlans").insert({ weekly_id: weekly_id, year: year, month: month, week: week, day: day, task: task, pomodoro_count: pomodoro_count, range: range });
    } catch (error) {
        console.log("error", error);
    }
}
