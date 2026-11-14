import type { Money, Quantity } from '../api/schemas';

const NBSP = '\u00a0';

function number(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(value).replaceAll('\u202f', NBSP).replaceAll(' ', NBSP);
}

export function formatMoney(money: Money): string {
  const body = `€${number(Math.abs(money.cents) / 100, 2, 2)}`;
  return money.cents < 0 ? `-${body}` : body;
}

export function formatQuantity(quantity: Quantity): string {
  return `${number(quantity.amount, 0, 2)}${NBSP}${quantity.unit}`;
}

function parts(input: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', ...options })
    .formatToParts(new Date(input))
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
}

export function formatTime(input: string): string {
  const dateParts = parts(input, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${dateParts.hour}:${dateParts.minute}`;
}

export function formatDate(input: string): string {
  const dateParts = parts(input, { weekday: 'short', day: '2-digit', month: 'short' });
  return `${dateParts.weekday} ${Number(dateParts.day)} ${dateParts.month}`;
}

export function formatDateTime(input: string): string {
  return `${formatDate(input)}, ${formatTime(input)}`;
}
