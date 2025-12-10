import { Button, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { RuleSchema } from '../RuleBuilder/types'
import ConditionEditor from './ConditionEditor'
import { CONDITION_OPERATORS } from './constants'

type RuleFormProps = {
  rule: RuleSchema
  setRule: (schema: RuleSchema) => void
}

const RuleForm = ({ rule, setRule }: RuleFormProps) => {
  const handleFieldChange = (field: keyof Pick<RuleSchema, 'action' | 'target' | 'timeRange'>, value: string) => {
    setRule({
      ...rule,
      [field]: field === 'timeRange' ? (value.trim() ? value : null) : value
    })
  }

  const handlePriorityChange = (value: string) => {
    if (!value.trim()) {
      setRule({ ...rule, priority: null })
      return
    }

    const numeric = Number(value)
    setRule({ ...rule, priority: Number.isFinite(numeric) ? numeric : null })
  }

  const handleLogicChange = (value: string) => {
    const normalized = value === 'AND' || value === 'OR' ? value : ''
    setRule({ ...rule, logic: normalized })
  }

  const addCondition = () => {
    setRule({
      ...rule,
      conditions: [...rule.conditions, { field: '', operator: CONDITION_OPERATORS[0], value: '' }]
    })
  }

  const updateCondition = (index: number, updated: RuleSchema['conditions'][number]) => {
    const next = [...rule.conditions]
    next[index] = updated
    setRule({ ...rule, conditions: next })
  }

  const removeCondition = (index: number) => {
    setRule({
      ...rule,
      conditions: rule.conditions.filter((_, currentIndex) => currentIndex !== index)
    })
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h6" gutterBottom>
          Form Builder
        </Typography>
        <Typography color="text.secondary">
          Describe the pieces of a rule without touching JSON. Form changes update the output immediately.
        </Typography>
      </div>

      <Stack spacing={2}>
        <TextField
          label="Action"
          value={rule.action}
          onChange={(event) => handleFieldChange('action', event.target.value)}
          helperText="What should happen when all conditions are met?"
          fullWidth
        />

        <TextField
          label="Target"
          value={rule.target}
          onChange={(event) => handleFieldChange('target', event.target.value)}
          helperText="Who or what does this rule apply to?"
          fullWidth
        />

        <TextField
          label="Priority"
          type="number"
          value={rule.priority ?? ''}
          onChange={(event) => handlePriorityChange(event.target.value)}
          helperText="Optional. Higher numbers can sort execution order."
          fullWidth
        />

        <TextField
          label="Logic"
          select
          value={rule.logic || ''}
          onChange={(event) => handleLogicChange(event.target.value)}
          helperText="Choose how multiple conditions should be evaluated."
          fullWidth
        >
          <MenuItem value="AND">AND (all conditions)</MenuItem>
          <MenuItem value="OR">OR (any condition)</MenuItem>
        </TextField>

        <TextField
          label="Time Range"
          value={rule.timeRange ?? ''}
          onChange={(event) => handleFieldChange('timeRange', event.target.value)}
          helperText="Optional. Example: business hours, weekends, 8am-5pm UTC."
          fullWidth
        />
      </Stack>

      <Divider />

      <div>
        <Typography variant="subtitle1" gutterBottom>
          Conditions
        </Typography>
        {rule.conditions.map((condition, index) => (
          <ConditionEditor
            key={`condition-${index}`}
            condition={condition}
            index={index}
            updateCondition={updateCondition}
            removeCondition={removeCondition}
          />
        ))}
        <Button variant="outlined" color="secondary" sx={{ mt: 2 }} onClick={addCondition}>
          Add Condition
        </Button>
      </div>
    </Stack>
  )
}

export default RuleForm
