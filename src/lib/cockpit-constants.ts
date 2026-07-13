// Toggle to demo the coverage footnote in cockpit financial KPIs.
export const MOCK_TIMESHEET_COVERAGE_PCT = 82;
export const COVERAGE_THRESHOLD_PCT = 95;

export const TASK_WEIGHT_OPEN = 1;
export const TASK_WEIGHT_HIGH = 1.5;
export const HEARING_WEIGHT = 2;

// Fictional bandwidth math: (open tasks * 1 + high tasks * 0.5 extra + hearings * 2 + hrs logged / 8) / 20 * 100.
export function computeLoadPct(inputs: { openTasks: number; highTasks: number; hearings: number; hoursLogged: number }): number {
  const raw = inputs.openTasks * TASK_WEIGHT_OPEN + inputs.highTasks * 0.5 + inputs.hearings * HEARING_WEIGHT + inputs.hoursLogged / 8;
  return Math.min(100, Math.round((raw / 20) * 100));
}