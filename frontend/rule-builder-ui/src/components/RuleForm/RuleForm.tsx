import { Divider, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { RuleSchema } from '../RuleBuilder/types'
import ConditionEditor from './ConditionEditor'

type RuleFormProps = {
  schema: RuleSchema
  onSchemaChange: (schema: RuleSchema) => void
}

const RuleForm = ({ schema, onSchemaChange }: RuleFormProps) => {
  const handleTextChange = (field: keyof Pick<RuleSchema, 'action' | 'target' | 'timeRange'>, value: string) => {
    onSchemaChange({
      ...schema,
      [field]: field === 'timeRange' ? (value.trim() ? value : null) : value
    })
  }

  const handlePriorityChange = (value: string) => {
    if (!value.trim()) {
      onSchemaChange({ ...schema, priority: null })
      return
    }

    const numeric = Number(value)
    onSchemaChange({ ...schema, priority: Number.isFinite(numeric) ? numeric : null })
  }

  const handleLogicChange = (value: string) => {
    const normalized = value === 'AND' || value === 'OR' ? value : ''
    onSchemaChange({ ...schema, logic: normalized })
  }

  const handleConditionsChange = (conditions: RuleSchema['conditions']) => {
    onSchemaChange({ ...schema, conditions })
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
          value={schema.action}
          onChange={(event) => handleTextChange('action', event.target.value)}
          helperText="What should happen when all conditions are met?"
          fullWidth
        />

        <TextField
          label="Target"
          value={schema.target}
          onChange={(event) => handleTextChange('target', event.target.value)}
          helperText="Who or what does this rule apply to?"
          fullWidth
        />

        <TextField
          label="Priority"
          type="number"
          value={schema.priority ?? ''}
          onChange={(event) => handlePriorityChange(event.target.value)}
          helperText="Optional. Higher numbers can sort execution order."
          fullWidth
        />

        <TextField
          label="Logic"
          select
          value={schema.logic || ''}
          onChange={(event) => handleLogicChange(event.target.value)}
          helperText="Choose how multiple conditions should be evaluated."
          fullWidth
        >
          <MenuItem value="AND">AND (all conditions)</MenuItem>
          <MenuItem value="OR">OR (any condition)</MenuItem>
        </TextField>

        <TextField
          label="Time Range"
          value={schema.timeRange ?? ''}
          onChange={(event) => handleTextChange('timeRange', event.target.value)}
          helperText="Optional. Example: business hours, weekends, 8am-5pm UTC."
          fullWidth
        />
      </Stack>

      <Divider />

      <ConditionEditor conditions={schema.conditions} onChange={handleConditionsChange} />
    </Stack>
  )
}

export default RuleForm
