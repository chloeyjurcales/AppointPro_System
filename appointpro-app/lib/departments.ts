// The departments a user can choose from. `label` is what is shown and saved.
export const DEPARTMENT_OPTIONS = [
  { code: 'CTE', label: 'CTE' },
  { code: 'CCS', label: 'CCS' },
  { code: 'CBE', label: 'CBE' },
  { code: 'CCJE', label: 'CCJE' },
  { code: 'PSYCH', label: 'PSYCH' },
] as const;

export function departmentKey(value?: string | null): string {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return '';
  for (const option of DEPARTMENT_OPTIONS) {
    if (text === option.label.toLowerCase() || text === option.code.toLowerCase()) return option.code;
  }
  const inBrackets = text.match(/\(([a-z]+)\)\s*$/)?.[1];
  if (inBrackets) {
    const hit = DEPARTMENT_OPTIONS.find((option) => option.code.toLowerCase() === inBrackets);
    if (hit) return hit.code;
  }
  if (text === 'psychology' || text === 'psychology program') return 'PSYCH';
  return text;
}

export const isSameDepartmentValue = (a?: string | null, b?: string | null): boolean => {
  const x = departmentKey(a);
  return x !== '' && x === departmentKey(b);
};