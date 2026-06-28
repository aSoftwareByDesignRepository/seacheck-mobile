/** Whole hours and minutes for passage planning time labels. */
export function splitPlanningDuration(hours: number): { hours: number; minutes: number } {
  const totalMin = Math.max(0, Math.round(hours * 60));
  return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
}
