/** Tiny classname merger — drops falsy values and joins with a space. */
export function cn(
  ...classes: Array<string | undefined | null | false | 0>
): string {
  return classes.filter(Boolean).join(" ");
}
