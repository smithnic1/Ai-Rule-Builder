import { useState } from 'react'
import { Alert, Box, Button, Collapse, Paper, Snackbar, Stack, Typography } from '@mui/material'
import RuleInput from './RuleInput'
import RulePreview from './RulePreview'
import RuleHints from './RuleHints'
import EditableJson from './EditableJson'
import RuleForm from '../RuleForm/RuleForm'
import { createEmptyRule, isRuleEmpty, normalizeRuleSchema, type RuleSchema } from './types'

const API_URL_BASE = (() => {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (!raw) {
    return ''
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

const RULE_PIPELINE_BASE_URL = `${API_URL_BASE}/api/rulepipeline`

type RuleValidationResponse = {
  valid: boolean
  issues: string[]
}

const RuleBuilder = () => {
  const [input, setInput] = useState('')
  const [rule, setRule] = useState<RuleSchema>(() => createEmptyRule())
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<RuleValidationResponse | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)

  const handleRuleGenerated = (next: RuleSchema) => {
    handleRuleUpdated(next)
    setToastOpen(false)
  }

  const handleRuleUpdated = (next: RuleSchema) => {
    setRule(next)
    setRefineError(null)
    setValidationError(null)
    setValidationResult(null)
    setExplainError(null)
    setExplanation(null)
  }

  const handleRefine = async () => {
    if (isRuleEmpty(rule)) {
      setRefineError('Provide rule details before refining.')
      return
    }

    setRefining(true)
    setRefineError(null)

    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify(rule, null, 2) })
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const data = (await response.json()) as { result: unknown }
      const normalized = normalizeRuleSchema(data.result)

      setRule(normalized)
      setToastOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setRefineError(message)
    } finally {
      setRefining(false)
    }
  }

  const handleValidate = async () => {
    if (isRuleEmpty(rule)) {
      setValidationError('Provide rule details before validating.')
      setValidationResult(null)
      return
    }

    setValidating(true)
    setValidationError(null)

    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify(rule, null, 2) })
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const parsed = (await response.json()) as RuleValidationResponse
      setValidationResult(parsed)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setValidationError(message)
      setValidationResult(null)
    } finally {
      setValidating(false)
    }
  }

  const handleExplain = async () => {
    if (isRuleEmpty(rule)) {
      setExplainError('Provide rule details before requesting an explanation.')
      setExplanation(null)
      return
    }

    setExplaining(true)
    setExplainError(null)

    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify(rule, null, 2) })
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const data = (await response.json()) as { explanation: string }
      setExplanation(data.explanation)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setExplainError(message)
      setExplanation(null)
    } finally {
      setExplaining(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: { xs: 3, md: 5 }, px: { xs: 2, md: 4 } }}>
      <Typography variant="overline" color="text.secondary">
        AI Rule Builder
      </Typography>
      <Typography variant="h4" component="h1" gutterBottom>
        Turn natural language into validated rule JSON
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Describe what should happen, who it applies to, and any conditions. The backend pipeline summarizes, extracts
        intent, repairs malformed JSON, and validates the output.
      </Typography>

      <Stack spacing={3}>
        <Paper elevation={2} sx={{ padding: 3 }}>
          <RuleInput input={input} setInput={setInput} onRuleGenerated={handleRuleGenerated} />
        </Paper>

        <Paper elevation={2} sx={{ padding: 3 }}>
          <Stack spacing={3}>
            <RulePreview rule={rule} />
            <RuleForm rule={rule} setRule={handleRuleUpdated} />
            <EditableJson rule={rule} onRuleChange={handleRuleUpdated} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => void handleRefine()}
                disabled={isRuleEmpty(rule) || refining}
              >
                {refining ? 'Refining…' : 'Refine Rule'}
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => void handleValidate()}
                disabled={isRuleEmpty(rule) || validating}
              >
                {validating ? 'Validating…' : 'Validate Rule'}
              </Button>
              <Button
                variant="outlined"
                color="info"
                onClick={() => void handleExplain()}
                disabled={isRuleEmpty(rule) || explaining}
              >
                {explaining ? 'Explaining…' : 'Explain Rule'}
              </Button>
            </Stack>
            {validationResult && (
              <Alert severity={validationResult.valid ? 'success' : 'warning'} onClose={() => setValidationResult(null)}>
                {validationResult.valid ? 'Rule passes schema validation.' : 'Validation issues detected.'}
                {!validationResult.valid && validationResult.issues.length > 0 && (
                  <Stack component="ul" sx={{ pl: 2, mb: 0, mt: 1 }}>
                    {validationResult.issues.map((issue) => (
                      <Box key={issue} component="li" sx={{ fontSize: '0.875rem' }}>
                        {issue}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Alert>
            )}
            {validationError && (
              <Alert severity="error" onClose={() => setValidationError(null)}>
                {validationError}
              </Alert>
            )}
            {refineError && (
              <Alert severity="error" onClose={() => setRefineError(null)}>
                {refineError}
              </Alert>
            )}
            {explanation && (
              <Alert severity="info" onClose={() => setExplanation(null)}>
                {explanation}
              </Alert>
            )}
            {explainError && (
              <Alert severity="error" onClose={() => setExplainError(null)}>
                {explainError}
              </Alert>
            )}
          </Stack>
        </Paper>

        <Box>
          <Button variant="text" onClick={() => setShowExamples((prev) => !prev)}>
            {showExamples ? 'Hide examples & schema' : 'Show examples & schema'}
          </Button>
          <Collapse in={showExamples}>
            <Paper elevation={1} sx={{ padding: 3, mt: 2 }}>
              <RuleHints />
            </Paper>
          </Collapse>
        </Box>
      </Stack>
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        message="Rule refined successfully."
      />
    </Box>
  )
}

export default RuleBuilder

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
