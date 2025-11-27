export type RuleCondition = {
  field: string
  operator: string
  value: string
}

export type RuleSchema = {
  action: string
  target: string
  conditions: RuleCondition[]
  timeRange: string | null
  priority: number | null
  logic: 'AND' | 'OR' | ''
}

export const createEmptyRule = (): RuleSchema => ({
  action: '',
  target: '',
  conditions: [],
  timeRange: null,
  priority: null,
  logic: 'AND'
})

export const isRuleEmpty = (rule: RuleSchema) => {
  const hasConditions = Array.isArray(rule.conditions) && rule.conditions.length > 0
  return !rule.action && !rule.target && !rule.timeRange && !rule.priority && !hasConditions
}

export const normalizeRuleSchema = (value: unknown): RuleSchema => {
  if (typeof value === 'string') {
    try {
      return normalizeRuleSchema(JSON.parse(value))
    } catch {
      throw new Error('Returned JSON could not be parsed.')
    }
  }

  if (value && typeof value === 'object') {
    const candidate = value as Partial<RuleSchema> & { rules?: unknown }

    if (Array.isArray(candidate.rules) && candidate.rules.length > 0) {
      return normalizeRuleSchema(candidate.rules[0])
    }

    const normalizedConditions = Array.isArray(candidate.conditions)
      ? candidate.conditions
          .map((condition) => normalizeCondition(condition))
          .filter((condition): condition is RuleCondition => condition !== null)
      : []

    const timeRange =
      typeof candidate.timeRange === 'string' && candidate.timeRange.trim().length > 0
        ? candidate.timeRange
        : null

    const priorityFromString =
      typeof candidate.priority === 'string' && candidate.priority.trim().length > 0
        ? Number(candidate.priority)
        : null
    const parsedPriority =
      typeof candidate.priority === 'number'
        ? candidate.priority
        : priorityFromString !== null && Number.isFinite(priorityFromString)
        ? priorityFromString
        : null

    const logic =
      typeof candidate.logic === 'string'
        ? (candidate.logic.toUpperCase() as RuleSchema['logic'])
        : ('AND' as RuleSchema['logic'])

    return {
      action: typeof candidate.action === 'string' ? candidate.action : '',
      target: typeof candidate.target === 'string' ? candidate.target : '',
      conditions: normalizedConditions,
      timeRange,
      priority: parsedPriority,
      logic: logic === 'AND' || logic === 'OR' ? logic : ''
    }
  }

  throw new Error('Unable to normalize rule JSON.')
}

const normalizeCondition = (value: unknown): RuleCondition | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<RuleCondition>

  const field = typeof candidate.field === 'string' ? candidate.field : ''
  const operator = typeof candidate.operator === 'string' ? candidate.operator : ''
  const normalizedValue = typeof candidate.value === 'string' ? candidate.value : ''

  if (!field && !operator && !normalizedValue) {
    return null
  }

  return {
    field,
    operator,
    value: normalizedValue
  }
}
