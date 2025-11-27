import { Alert, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { normalizeRuleSchema, type RuleSchema } from './types'

type EditableJsonProps = {
  rule: RuleSchema
  onRuleChange: (value: RuleSchema) => void
}

const EditableJson = ({ rule, onRuleChange }: EditableJsonProps) => {
  const [rawJson, setRawJson] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRawJson(JSON.stringify(rule, null, 2))
  }, [rule])

  const handleChange = (next: string) => {
    setRawJson(next)

    if (!next.trim()) {
      setError('Provide JSON that matches the rule schema.')
      return
    }

    try {
      const parsed = JSON.parse(next)
      const normalized = normalizeRuleSchema(parsed)
      onRuleChange(normalized)
      setError(null)
    } catch {
      setError('Enter valid JSON that matches the rule schema.')
    }
  }

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Edit Rule JSON
      </Typography>
      <TextField
        value={rawJson}
        onChange={(event) => handleChange(event.target.value)}
        multiline
        minRows={10}
        fullWidth
        placeholder="Tweak the JSON here before running a refine pass."
        InputProps={{
          sx: {
            fontFamily: '"Fira Code", "SFMono-Regular", Consolas, monospace',
            borderRadius: 2,
            backgroundColor: '#f9fafc',
            color: '#0f172a',
            '& textarea': {
              fontFamily: '"Fira Code", "SFMono-Regular", Consolas, monospace'
            }
          }
        }}
      />

      {error && (
        <Alert severity="warning" onClose={() => setError(null)} sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </>
  )
}

export default EditableJson
