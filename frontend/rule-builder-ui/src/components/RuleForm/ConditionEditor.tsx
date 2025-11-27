import { Button, Stack, TextField, Typography } from '@mui/material'
import type { RuleCondition } from '../RuleBuilder/types'

type ConditionEditorProps = {
  conditions: RuleCondition[]
  onChange: (value: RuleCondition[]) => void
}

const ConditionEditor = ({ conditions, onChange }: ConditionEditorProps) => {
  const handleConditionChange = (index: number, field: keyof RuleCondition, value: string) => {
    const draft = [...conditions]
    draft[index] = {
      ...draft[index],
      [field]: value
    }
    onChange(draft)
  }

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, currentIndex) => currentIndex !== index))
  }

  const addCondition = () => {
    onChange([...conditions, { field: '', operator: '', value: '' }])
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Conditions</Typography>

      {conditions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Add conditions to describe filters like location, availability, or certifications.
        </Typography>
      ) : (
        conditions.map((condition, index) => (
          <Stack key={`condition-${index}`} spacing={1}>
            <Typography variant="subtitle2">Condition {index + 1}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                label="Field"
                value={condition.field}
                onChange={(event) => handleConditionChange(index, 'field', event.target.value)}
                fullWidth
              />
              <TextField
                label="Operator"
                value={condition.operator}
                onChange={(event) => handleConditionChange(index, 'operator', event.target.value)}
                fullWidth
              />
              <TextField
                label="Value"
                value={condition.value}
                onChange={(event) => handleConditionChange(index, 'value', event.target.value)}
                fullWidth
              />
            </Stack>
            <Button
              variant="text"
              color="error"
              onClick={() => removeCondition(index)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Remove condition
            </Button>
          </Stack>
        ))
      )}

      <Button variant="outlined" color="secondary" onClick={addCondition} sx={{ alignSelf: 'flex-start' }}>
        Add Condition
      </Button>
    </Stack>
  )
}

export default ConditionEditor
