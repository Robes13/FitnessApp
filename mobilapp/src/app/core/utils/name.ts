/** Names are compared trimmed and case-insensitively ("Meal prep" = " meal PREP "). */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('da');
}
