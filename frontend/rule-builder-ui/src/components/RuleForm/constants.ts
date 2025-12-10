export const CONDITION_OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'] as const

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

export const CONDITION_FIELD_SUGGESTIONS: string[] = [
  'hours_worked',
  'position_type',
  'certification_status',
  'location',
  'availability',
  'role',
  'shift',
  'priority',
  'department',
  'seniority',
  'skill',
  'crew_shortage',
  'contract_type'
]

export const OPERATOR_DESCRIPTIONS: Record<ConditionOperator, string> = {
  equals: 'True when the field matches the value exactly.',
  not_equals: 'True when the field does not match the value.',
  contains: 'True when the field includes the value as a substring or entry.',
  greater_than: 'True when the field is numerically greater than the value.',
  less_than: 'True when the field is numerically less than the value.'
}
