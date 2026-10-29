import { format, isToday, isYesterday } from "date-fns";

/** KES 1,250 · KES 1,250.50 */
export function money(n: number | string | null | undefined, currency = "KES") {
  const v = Number(n ?? 0);
  return `${currency} ${v.toLocaleString("en-KE", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Number only, for places where the currency is printed separately. */
export function amount(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-KE", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function firstName(full?: string | null) {
  return full ? full.trim().split(/\s+/)[0] : "";
}

export function dayLabel(d: Date | string) {
  const x = new Date(d);
  if (isToday(x)) return "Today";
  if (isYesterday(x)) return "Yesterday";
  return format(x, "EEEE d MMMM");
}

export const shortDate = (d: Date | string) => format(new Date(d), "d MMM yyyy");
export const shortTime = (d: Date | string) => format(new Date(d), "d MMM, HH:mm");
