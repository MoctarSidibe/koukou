export function isoWeekStart(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const mondayIndex = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayIndex);
  return d.toISOString().slice(0, 10);
}
