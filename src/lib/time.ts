// Server reset times. Daily reset is 04:00 server-local; weekly reset is Monday 04:00.
import type { Server } from "../data/types.ts";

const DAY = 86400;
const RESET_HOUR = 4;

export function nextDailyReset(server: Server, nowUnix: number): number {
  const off = server.utcOffsetMin * 60;
  const local = nowUnix + off;
  let reset = Math.floor(local / DAY) * DAY + RESET_HOUR * 3600;
  if (reset <= local) reset += DAY;
  return reset - off;
}

export function nextWeeklyReset(server: Server, nowUnix: number): number {
  let t = nextDailyReset(server, nowUnix);
  // weekday of the reset moment in server-local time (0 = Sunday)
  while (new Date((t + server.utcOffsetMin * 60) * 1000).getUTCDay() !== 1) t += DAY;
  return t;
}
