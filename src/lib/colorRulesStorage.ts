// Color rules storage utility
// Stores user-defined color rules in localStorage

export interface ColorRule {
  id: string;
  keywords: string[];  // Match if event title contains any of these
  color: string;       // Hex color
  name: string;        // Rule name for display (e.g., "Classes", "Homework")
}

const STORAGE_KEY = 'aicalander_color_rules';

// Default rules - intelligent auto-coloring
const DEFAULT_RULES: ColorRule[] = [
  { id: '1', name: 'Classes', keywords: ['lecture', 'class', 'discussion', 'CS', 'MATH', 'EECS', 'STAT'], color: '#3b82f6' },
  { id: '2', name: 'Homework', keywords: ['homework', 'assignment', 'due', 'submission', 'HW'], color: '#22c55e' },
  { id: '3', name: 'Exams', keywords: ['exam', 'midterm', 'final', 'quiz', 'test'], color: '#ef4444' },
  { id: '4', name: 'Meetings', keywords: ['meeting', '1:1', 'standup', 'sync', 'call'], color: '#8b5cf6' },
  { id: '5', name: 'Social', keywords: ['lunch', 'coffee', 'dinner', 'social', 'party'], color: '#f97316' },
  { id: '6', name: 'Office Hours', keywords: ['office hours', 'OH', 'tutoring', 'help'], color: '#06b6d4' },
];

export function getColorRules(): ColorRule[] {
  if (typeof window === 'undefined') return DEFAULT_RULES;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_RULES;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_RULES;
  }
}

export function saveColorRules(rules: ColorRule[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function resetToDefaults(): ColorRule[] {
  saveColorRules(DEFAULT_RULES);
  return DEFAULT_RULES;
}

// Get color for an event based on its title
export function getColorForEvent(title: string, rules?: ColorRule[]): string | null {
  const colorRules = rules || getColorRules();
  const lowerTitle = title.toLowerCase();

  for (const rule of colorRules) {
    for (const keyword of rule.keywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return rule.color;
      }
    }
  }
  return null; // No match - use default coloring
}
