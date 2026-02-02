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
    const candidate = toCaseInsensitiveRecord(value)
    if (!candidate) {
      throw new Error('Unable to normalize rule JSON.')
    }

    const rulesPayload = candidate.rules
    if (Array.isArray(rulesPayload) && rulesPayload.length > 0) {
      return normalizeRuleSchema(rulesPayload[0])
    }

    const normalizedConditions = Array.isArray(candidate.conditions)
      ? candidate.conditions
          .map((condition) => normalizeCondition(condition))
          .filter((condition): condition is RuleCondition => condition !== null)
      : []

    const timeRangeValue = candidate.timerange
    const timeRange =
      typeof timeRangeValue === 'string' && timeRangeValue.trim().length > 0 ? timeRangeValue : null

    const priorityValue = candidate.priority
    const priorityFromString =
      typeof priorityValue === 'string' && priorityValue.trim().length > 0 ? Number(priorityValue) : null
    const parsedPriority =
      typeof priorityValue === 'number'
        ? priorityValue
        : priorityFromString !== null && Number.isFinite(priorityFromString)
        ? priorityFromString
        : null

    const logicValue = candidate.logic
    const logic =
      typeof logicValue === 'string'
        ? (logicValue.toUpperCase() as RuleSchema['logic'])
        : ('AND' as RuleSchema['logic'])

    const actionValue = candidate.action
    const targetValue = candidate.target

    return {
      action: typeof actionValue === 'string' ? actionValue : '',
      target: typeof targetValue === 'string' ? targetValue : '',
      conditions: normalizedConditions,
      timeRange,
      priority: parsedPriority,
      logic: logic === 'AND' || logic === 'OR' ? logic : ''
    }
  }

  throw new Error('Unable to normalize rule JSON.')
}

const normalizeCondition = (value: unknown): RuleCondition | null => {
  const candidate = toCaseInsensitiveRecord(value)
  if (!candidate) {
    return null
  }

  const fieldValue = candidate.field
  const operatorValue = candidate.operator
  const compareValue = candidate.value
  const field = typeof fieldValue === 'string' ? fieldValue : ''
  const operator = typeof operatorValue === 'string' ? operatorValue : ''
  const normalizedValue = typeof compareValue === 'string' ? compareValue : ''

  if (!field && !operator && !normalizedValue) {
    return null
  }

  return {
    field,
    operator,
    value: normalizedValue
  }
}

const toCaseInsensitiveRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const normalized: Record<string, unknown> = {}

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    normalized[key.toLowerCase()] = entryValue
  }

  return normalized
}
