import { createClient } from '@supabase/supabase-js';
import { notification } from 'ant-design-vue';
import exp from 'constants';

const supabaseUrl = import.meta.env.VITE_supabaseProjectUrl;
const supabaseKey = import.meta.env.VITE_anonKey;
const supabase = createClient(supabaseUrl, supabaseKey);

//////////inser task to supabase table
//insert task to quarter table
export async function insertTaskToQuarter(
  task: string,
  year: number,
  quarter: number,
  isLoop: boolean = false,
  range: number = 1
) {
  try {
    const { data, error } = await supabase
      .from('QuarterlyPlans')
      .insert({ year: year, quarter: quarter, task: task, isLoop: isLoop, range: range })
      .select();
    return data ? data[0] : null;
  } catch (error) {
    console.log('error', error);
  }
}

//insert task to month table
export async function insertTaskToMonth(
  quarter_id: number,
  year: number,
  month: number,
  quarter: number,
  task: string,
  isLoop: boolean = false,
  range: number = 1
) {
  try {
    const { data } = await supabase
      .from('MonthlyPlans')
      .insert({
        quarterly_id: quarter_id,
        year: year,
        month: month,
        quarter: quarter,
        task: task,
        isLoop: isLoop,
        range: range,
      })
      .select();
    return data ? data[0] : null;
  } catch (error) {
    console.log('error', error);
  }
}

//insert task to week table
export async function insertTaskToWeek(
  monthly_id: number,
  year: number,
  month: number,
  week: number,
  task: string,
  isLoop: boolean = false,
  range: number = 1
) {
  try {
    const { data } = await supabase
      .from('WeeklyPlans')
      .insert({
        monthly_id: monthly_id,
        year: year,
        month: month,
        week: week,
        task: task,
        isLoop: isLoop,
        range: range,
      })
      .select();
    return data ? data[0] : null;
  } catch (error) {
    console.log('error', error);
  }
}

//insert task to day table
export async function insertTaskToDay(
  weekly_id: number,
  year: number,
  month: number,
  week: number,
  day: String,
  task: string,
  pomodoro_count: number,
  range: number = 1
) {
  try {
    const { data } = await supabase
      .from('DailyPlans')
      .insert({
        weekly_id: weekly_id,
        year: year,
        month: month,
        week: week,
        day: day,
        task: task,
        pomodoro_count: pomodoro_count,
        range: range,
      })
      .select();
    return data ? data[0] : null;
  } catch (error) {
    console.log('Supabase Error:', error);
  }
}

//////////query task from supabase table
//query task from quarter table
export async function getTaskFromQuarter(year: number): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('QuarterlyPlans')
      .select('id,year, quarter, task, isLoop, range')
      .eq('year', year);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}

//query task from month table
export async function getTaskFromMonth(year: number, quarter: number): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('MonthlyPlans')
      .select('id,quarterly_id, year, month, task, isLoop, range')
      .eq('year', year)
      .eq('quarter', quarter);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}

//query task from week table
export async function getTaskFromWeek(year: number, month: number): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('WeeklyPlans')
      .select('id,monthly_id, year, month, week, task, isLoop, range')
      .eq('year', year)
      .eq('month', month);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}

//query task from day table
export async function getTaskFromDay(year: number, month: number, week: number): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('DailyPlans')
      .select(
        'id,weekly_id, year, month, week, day, task, pomodoro_count, finish_pomodoro, isFinished, range'
      )
      .eq('year', year)
      .eq('month', month)
      .eq('week', week);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}

//Unified interface for updating tasks: quarterly, monthly, weekly, daily
export async function updateTask(task: any, table: string) {
  try {
    await supabase.from(table).update(task).eq('id', task.id);
  } catch (error) {
    console.log('error', error);
  }
}

//define delete task function
export async function deleteTask(id: number, tableIndex: number) {
  let table: string;
  //define table name according to tableIndex
  switch (tableIndex) {
    case 1:
      table = 'QuarterlyPlans';
      break;
    case 2:
      table = 'MonthlyPlans';
      break;
    case 3:
      table = 'WeeklyPlans';
      break;
    case 4:
      table = 'DailyPlans';
      break;
    default:
      console.log('Invalid table index');
      return;
  }
  try {
    await supabase.from(table).delete().eq('id', id);
    notification.success({
      message: 'Delete Success',
      description: 'Task deleted successfully',
    });
  } catch (error) {
    console.log('error', error);
    notification.error({
      message: 'Delete Failed',
      description: 'Failed to delete task',
    });
  }
}

///////////////query task for taskModal's parent task
//query task from week table when view in daily view
export async function getTaskFromWeekByDay(
  year: number,
  month: number,
  week: number
): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('WeeklyPlans')
      .select('id, task, range')
      .eq('year', year)
      .eq('month', month)
      .eq('week', week)
      .neq('isLoop', true);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}

//query task from month table when view in weekly view
export async function getTaskFromMonthByWeek(year: number, month: number): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('MonthlyPlans')
      .select('id, task, range')
      .eq('year', year)
      .eq('month', month)
      .neq('isLoop', true);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}

//query task from quarter table when view in monthly view
export async function getTaskFromQuarterByMonth(year: number, quarter: number): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('QuarterlyPlans')
      .select('id, task, range')
      .eq('year', year)
      .eq('quarter', quarter)
      .neq('isLoop', true);
    return data || [];
  } catch (error) {
    console.log('error', error);
    return [];
  }
}
