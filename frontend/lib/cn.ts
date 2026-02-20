/**
 * Simple utility to combine classNames conditionally
 * @param classes - Array of class strings to combine
 * @returns Combined class string
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
