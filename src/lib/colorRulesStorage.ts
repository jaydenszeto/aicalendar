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
  { id: '1', name: 'Classes', keywords: ['lecture', 'class', 'discussion', 'section', 'seminar', 'lab section'], color: '#3b82f6' },
  { id: '2', name: 'Homework', keywords: ['homework', 'assignment', 'due', 'submission', 'problem set', 'pset', 'project'], color: '#22c55e' },
  { id: '3', name: 'Exams', keywords: ['exam', 'midterm', 'final', 'quiz', 'test', 'assessment'], color: '#ef4444' },
  { id: '4', name: 'Meetings', keywords: ['meeting', '1:1', 'standup', 'sync', 'call', 'interview', 'check-in'], color: '#8b5cf6' },
  { id: '5', name: 'Social', keywords: ['lunch', 'coffee', 'dinner', 'social', 'party', 'hangout', 'brunch'], color: '#f97316' },
  { id: '6', name: 'Office Hours', keywords: ['office hours', 'OH', 'tutoring', 'help session', 'study group'], color: '#06b6d4' },
  { id: '7', name: 'Work', keywords: ['work', 'shift', 'job', 'internship', 'research'], color: '#eab308' },
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

// Colors for TYPE tags in event descriptions (override keyword rules)
const TYPE_TAG_COLORS: Record<string, string> = {
  'homework': '#22c55e',   // Green
  'assignment': '#22c55e', // Green
  'lab': '#06b6d4',        // Cyan
  'quiz': '#f97316',       // Orange
  'exam': '#ef4444',       // Red
  'project': '#a855f7',    // Purple
};

// Get color for an event based on its title and description
// Priority: TYPE tags in description > keyword rules > null
export function getColorForEvent(title: string, rules?: ColorRule[], description?: string): string | null {
  // First check for TYPE tags in description (highest priority)
  if (description) {
    const lowerDesc = description.toLowerCase();
    const typeMatch = lowerDesc.match(/\[type:\s*(\w+)\]/);
    if (typeMatch) {
      const typeValue = typeMatch[1].toLowerCase();
      if (TYPE_TAG_COLORS[typeValue]) {
        return TYPE_TAG_COLORS[typeValue];
      }
    }
  }

  // Fall back to keyword rules
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
