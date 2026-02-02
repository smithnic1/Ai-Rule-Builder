import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Collapse, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material'
import RuleInput from './RuleInput'
import RulePreview from './RulePreview'
import RuleHints from './RuleHints'
import EditableJson from './EditableJson'
import RuleForm from '../RuleForm/RuleForm'
import RuleList from './RuleList'
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
  const [nlInput, setNlInput] = useState('')
  const [rule, setRuleObj] = useState<RuleSchema>(() => createEmptyRule())
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<RuleValidationResponse | null>(null)
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [naturalLanguageError, setNaturalLanguageError] = useState<string | null>(null)
  const [naturalLanguageLoading, setNaturalLanguageLoading] = useState(false)
  const [rules, setRules] = useState<RuleSchema[]>([])
  const [selectedRule, setSelectedRule] = useState<RuleSchema | null>(null)
  const [multiRulesError, setMultiRulesError] = useState<string | null>(null)
  const [multiRulesLoading, setMultiRulesLoading] = useState(false)
  const [clusterResult, setClusterResult] = useState<string | null>(null)
  const [clusterError, setClusterError] = useState<string | null>(null)
  const [clusterLoading, setClusterLoading] = useState(false)
  const scrollToFormOnUpdate = useRef(false)
  const ruleIncomplete = !isRuleEmpty(rule) && !rule.action?.trim()

  useEffect(() => {
    if (scrollToFormOnUpdate.current && !isRuleEmpty(rule)) {
      document.getElementById('rule-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      scrollToFormOnUpdate.current = false
    }
  }, [rule])

  const handleRuleGenerated = (next: RuleSchema) => {
    scrollToFormOnUpdate.current = true
    setSelectedRule(next)
    handleRuleUpdated(next)
    setToastOpen(false)
  }

  const handleNaturalLanguageGenerate = async () => {
    const prompt = nlInput.trim()
    if (!prompt) {
      return
    }

    setNaturalLanguageLoading(true)
    setNaturalLanguageError(null)

    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/fromtext`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt })
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const data = (await response.json()) as { result: string }
      const obj = JSON.parse(data.result)
      const normalized = normalizeRuleSchema(obj)
      scrollToFormOnUpdate.current = true
      handleRuleUpdated(normalized)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setNaturalLanguageError(message)
    } finally {
      setNaturalLanguageLoading(false)
    }
  }

  const handleExtractMultipleRules = async () => {
    const prompt = nlInput.trim()
    if (!prompt) {
      return
    }

    setMultiRulesLoading(true)
    setMultiRulesError(null)
    setClusterResult(null)
    setClusterError(null)

    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/extract-multiple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt })
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const data = (await response.json()) as { result: unknown }
      const payload = typeof data.result === 'string' ? JSON.parse(data.result) : data.result

      if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { rules?: unknown[] }).rules)) {
        throw new Error('Extractor returned no rules.')
      }

      const normalizedRules = (payload as { rules: unknown[] }).rules
        .map((entry) => {
          try {
            const materialized = typeof entry === 'string' ? JSON.parse(entry) : entry
            return normalizeRuleSchema(materialized)
          } catch {
            return null
          }
        })
        .filter((value): value is RuleSchema => value !== null)

      if (!normalizedRules.length) {
        throw new Error('No usable rules were extracted.')
      }

      setRules(normalizedRules)
      setSelectedRule(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setMultiRulesError(message)
      setRules([])
    } finally {
      setMultiRulesLoading(false)
    }
  }

  const handleClusterRules = async () => {
    if (!rules.length) {
      setClusterError('Extract multiple rules before clustering.')
      return
    }

    setClusterLoading(true)
    setClusterError(null)

    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/cluster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify({ rules }, null, 2) })
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const data = (await response.json()) as { result: unknown }
      let formatted: string

      if (typeof data.result === 'string') {
        const raw = data.result.trim()
        formatted = JSON.stringify(JSON.parse(raw), null, 2)
      } else {
        formatted = JSON.stringify(data.result, null, 2)
      }

      setClusterResult(formatted)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setClusterError(message)
      setClusterResult(null)
    } finally {
      setClusterLoading(false)
    }
  }

  const handleRuleUpdated = (next: RuleSchema) => {
    setRuleObj(next)
    setRefineError(null)
    setValidationError(null)
    setValidationResult(null)
    setValidationIssues([])
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

      setRuleObj(normalized)
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
      setValidationIssues([])
      return
    }

    setValidating(true)
    setValidationError(null)
    setValidationIssues([])

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
      if (parsed.valid) {
        setValidationResult(parsed)
        setValidationIssues([])
      } else {
        setValidationResult(null)
        setValidationIssues(parsed.issues ?? [])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setValidationError(message)
      setValidationResult(null)
      setValidationIssues([])
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

        <Paper id="rule-form" elevation={2} sx={{ padding: 3 }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h6">Natural Language Input Bar</Typography>
              <TextField
                label="Describe a rule in natural language"
                multiline
                minRows={3}
                fullWidth
                value={nlInput}
                onChange={(event) => setNlInput(event.target.value)}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => void handleNaturalLanguageGenerate()}
                  disabled={!nlInput.trim() || naturalLanguageLoading}
                >
                  {naturalLanguageLoading ? 'Generating…' : 'Generate Rule From Description'}
                </Button>
                <Button
                  variant="outlined"
                  color="info"
                  onClick={() => void handleExtractMultipleRules()}
                  disabled={!nlInput.trim() || multiRulesLoading}
                >
                  {multiRulesLoading ? 'Extracting…' : 'Extract Multiple Rules'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => void handleClusterRules()}
                  disabled={rules.length === 0 || clusterLoading}
                >
                  {clusterLoading ? 'Clustering…' : 'Cluster Rules'}
                </Button>
              </Stack>
              {naturalLanguageError && (
                <Alert severity="error" onClose={() => setNaturalLanguageError(null)}>
                  {naturalLanguageError}
                </Alert>
              )}
              {multiRulesError && (
                <Alert severity="error" onClose={() => setMultiRulesError(null)}>
                  {multiRulesError}
                </Alert>
              )}
              {clusterError && (
                <Alert severity="error" onClose={() => setClusterError(null)}>
                  {clusterError}
                </Alert>
              )}
              {rules.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <RuleList rules={rules} selectedRule={selectedRule} onSelect={handleRuleGenerated} />
                  <Typography variant="body2" color="text.secondary">
                    Select a rule to load it into the editor.
                  </Typography>
                </Paper>
              )}
              {clusterResult && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Clustered Rules
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      maxHeight: 240,
                      overflowY: 'auto',
                      fontSize: '0.85rem',
                      m: 0
                    }}
                  >
                    {clusterResult}
                  </Box>
                </Paper>
              )}
            </Stack>
            {ruleIncomplete && (
              <Alert severity="warning">Rule is incomplete — try adding more detail.</Alert>
            )}
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
            {validationResult && validationResult.valid && (
              <Alert severity="success" onClose={() => setValidationResult(null)}>
                Rule passes schema validation.
              </Alert>
            )}
            {validationIssues.length > 0 && (
              <Alert severity="error" onClose={() => setValidationIssues([])}>
                {validationIssues.map((issue) => (
                  <Box key={issue} sx={{ fontSize: '0.875rem' }}>
                    {issue}
                  </Box>
                ))}
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
