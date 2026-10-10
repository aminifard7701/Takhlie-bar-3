export type JalaliDate = { year: number; month: number; day: number };

const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' });
export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const fa = (value: string | number) => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
export const en = (value: string) => value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export function toJalali(date: Date): JalaliDate {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}
export function keyOf({ year, month, day }: JalaliDate): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function fromKey(key: string): JalaliDate {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}
export function compare(a: JalaliDate, b: JalaliDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}
export function toGregorian(j: JalaliDate): Date {
  let lo = new Date(j.year + 621, 2, 15, 12).getTime();
  let hi = new Date(j.year + 622, 2, 25, 12).getTime();
  while (hi - lo > 86400000) {
    const mid = lo + Math.floor((hi - lo) / 172800000) * 86400000;
    if (compare(toJalali(new Date(mid)), j) < 0) lo = mid;
    else hi = mid;
  }
  return new Date(compare(toJalali(new Date(lo)), j) === 0 ? lo : hi);
}
export function daysInMonth(year: number, month: number): number {
  const next = month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  return Math.round((toGregorian(next).getTime() - toGregorian({ year, month, day: 1 }).getTime()) / 86400000);
}
export function dateLabel(key: string): string {
  const { year, month, day } = fromKey(key);
  return `${fa(day)} ${MONTHS[month - 1]} ${fa(year)}`;
}
export const todayKey = () => keyOf(toJalali(new Date()));
