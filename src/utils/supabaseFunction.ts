import { createClient } from "@supabase/supabase-js";



const supabaseUrl = import.meta.env.VITE_supabaseProjectUrl
const supabaseKey = import.meta.env.VITE_anonKey
const supabase = createClient(supabaseUrl, supabaseKey)


//////////inser task to supabase table
//insert task to quarter table
export async function insertTaskToQuarter(task: string, year: number, quarter: number, isLoop: boolean = false, range: number=1) {
    try {
        await supabase.from("QuarterlyPlans").insert({ year: year, quarter: quarter, task: task, isLoop: isLoop, range: range });
    } catch (error) {
        console.log("error", error);
    }
}

//insert task to month table
export async function insertTaskToMonth(quarter_id: number, year: number, month: number,quarter:number, task: string, isLoop: boolean =false, range: number=1) {
    try {
        await supabase.from("MonthlyPlans").insert({ quarterly_id: quarter_id, year: year, month: month,quarter:quarter, task: task, isLoop: isLoop, range: range });
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



//////////query task from supabase table
//query task from quarter table
export async function getTaskFromQuarter(year: number): Promise<any[]> {
    try {
        const { data } = await supabase
            .from('QuarterlyPlans')
            .select('year, quarter, task, isLoop, range')
            .eq('year', year)
        return data||[];
    } catch (error) {
        console.log("error", error);
        return [];
    }
}

//query task from month table
export async function getTaskFromMonth(year: number, quarter: number): Promise<any[]> {
    try {
        const { data } = await supabase
            .from('MonthlyPlans')
            .select('quarterly_id, year, month, task, isLoop, range')
            .eq('year', year)
            .eq('quarter', quarter);
        return data||[];
    } catch (error) {
        console.log("error", error);
        return [];
    }
}

//query task from week table
export async function getTaskFromWeek(year: number, month: number): Promise<any[]> {
    try {
        const { data } = await supabase
            .from('WeeklyPlans')
            .select('monthly_id, year, month, week, task, isLoop, range')
            .eq('year', year)
            .eq('month', month);
        return data||[];
    } catch (error) {
        console.log("error", error);
        return [];
    }
}

//query task from day table
export async function getTaskFromDay(year: number, month: number, week: number): Promise<any[]> {
    try {
        const { data } = await supabase
            .from('DailyPlans')
            .select('weekly_id, year, month, week, day, task, pomodoro_count, finish_pomodoro, isFinished, range')
            .eq('year', year)
            .eq('month', month)
            .eq('week', week);
        return data||[];
    } catch (error) {
        console.log("error", error);
        return [];
    }
}