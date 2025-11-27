import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { normalizeRuleSchema, type RuleSchema } from './types'

type RuleInputProps = {
  input: string
  setInput: (value: string) => void
  onRuleGenerated: (value: RuleSchema) => void
}

const API_URL_BASE = (() => {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (!raw) {
    return ''
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

const RuleInput = ({ input, setInput, onRuleGenerated }: RuleInputProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    const prompts = input
      .split(/\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (prompts.length === 0) {
      setError('Describe a rule before generating.')
      return
    }

    setLoading(true)
    setError(null)
    const results: unknown[] = []

    try {
      for (const [index, prompt] of prompts.entries()) {
        const response = await fetch(`${API_URL_BASE}/api/rulepipeline/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: prompt })
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          throw new Error(`Rule ${index + 1}: ${message}`)
        }

        const data = await response.json()
        results.push(data.result)
      }

      const payload = results.length === 1 ? results[0] : { rules: results }
      const normalized = normalizeRuleSchema(payload)

      onRuleGenerated(normalized)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Rule description</Typography>
      <TextField
        label="Describe your rule"
        multiline
        minRows={6}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        fullWidth
        disabled={loading}
      />

      <Button
        variant="contained"
        color="primary"
        onClick={() => void handleGenerate()}
        disabled={!input.trim() || loading}
        sx={{ alignSelf: 'flex-start' }}
      >
        {loading ? <CircularProgress size={20} /> : 'Generate Rule'}
      </Button>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Stack>
  )
}

export default RuleInput

async function extractErrorMessage(response: Response) {
  try {
    const text = await response.text()
    if (!text) {
      return 'Failed to reach rule pipeline endpoint.'
    }

    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string }
      return parsed.error || parsed.message || text
    } catch {
      return text
    }
  } catch {
    return 'Failed to reach rule pipeline endpoint.'
  }
}
