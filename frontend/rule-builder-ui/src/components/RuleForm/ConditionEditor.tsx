import DeleteIcon from '@mui/icons-material/Delete'
import Autocomplete from '@mui/material/Autocomplete'
import { Grid, IconButton, MenuItem, Paper, TextField } from '@mui/material'
import type { RuleCondition } from '../RuleBuilder/types'
import {
  CONDITION_FIELD_SUGGESTIONS,
  CONDITION_OPERATORS,
  OPERATOR_DESCRIPTIONS,
  type ConditionOperator
} from './constants'

type ConditionEditorProps = {
  condition: RuleCondition
  index: number
  updateCondition: (index: number, value: RuleCondition) => void
  removeCondition: (index: number) => void
}

const ConditionEditor = ({ condition, index, updateCondition, removeCondition }: ConditionEditorProps) => {
  const handleUpdate = (name: keyof RuleCondition, value: string) => {
    updateCondition(index, { ...condition, [name]: value })
  }

  return (
    <Paper sx={{ padding: 2, mt: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={4}>
          <Autocomplete
            freeSolo
            options={CONDITION_FIELD_SUGGESTIONS}
            value={condition.field}
            inputValue={condition.field}
            onInputChange={(_, value) => handleUpdate('field', value)}
            onChange={(_, value) => handleUpdate('field', typeof value === 'string' ? value : '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Field"
                fullWidth
                helperText="Start typing to pick a common field or add your own."
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label="Operator"
            select
            fullWidth
            value={condition.operator}
            onChange={(event) => handleUpdate('operator', event.target.value)}
            helperText={
              (condition.operator
                ? OPERATOR_DESCRIPTIONS[condition.operator as ConditionOperator]
                : undefined) || 'Select how this field should be compared.'
            }
          >
            {CONDITION_OPERATORS.map((operator) => (
              <MenuItem key={operator} value={operator}>
                {operator}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={10} md={3}>
          <TextField
            label="Value"
            fullWidth
            value={condition.value}
            onChange={(event) => handleUpdate('value', event.target.value)}
          />
        </Grid>

        <Grid item xs={2} md={1}>
          <IconButton color="error" onClick={() => removeCondition(index)} aria-label="Remove condition">
            <DeleteIcon />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  )
}

export default ConditionEditor
