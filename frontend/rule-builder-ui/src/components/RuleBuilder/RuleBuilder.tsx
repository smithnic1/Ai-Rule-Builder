import { SyntheticEvent, useState } from 'react'
import { Alert, Box, Button, Collapse, Paper, Snackbar, Stack, Tab, Tabs, Typography } from '@mui/material'
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

type EditorMode = 'natural' | 'json' | 'form'

const RuleBuilder = () => {
  const [input, setInput] = useState('')
  const [rule, setRule] = useState<RuleSchema>(() => createEmptyRule())
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('natural')

  const handleRuleGenerated = (next: RuleSchema) => {
    setRule(next)
    setRefineError(null)
    setToastOpen(false)
  }

  const handleEditorModeChange = (_: SyntheticEvent, value: string) => {
    setEditorMode(value as EditorMode)
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
          <Tabs
            value={editorMode}
            onChange={handleEditorModeChange}
            aria-label="Rule editing modes"
            variant="scrollable"
            allowScrollButtonsMobile
          >
            <Tab label="Natural language" value="natural" />
            <Tab label="JSON editor" value="json" />
            <Tab label="Form builder" value="form" />
          </Tabs>
          <Box sx={{ mt: 3 }}>
            {editorMode === 'natural' && (
              <RuleInput input={input} setInput={setInput} onRuleGenerated={handleRuleGenerated} />
            )}
            {editorMode === 'json' && <EditableJson rule={rule} onRuleChange={handleRuleGenerated} />}
            {editorMode === 'form' && <RuleForm schema={rule} onSchemaChange={handleRuleGenerated} />}
          </Box>
        </Paper>

        <Paper elevation={2} sx={{ padding: 3 }}>
          <Stack spacing={2}>
            <RulePreview rule={rule} />
            <div>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => void handleRefine()}
                disabled={isRuleEmpty(rule) || refining}
              >
                {refining ? 'Refining…' : 'Refine Rule'}
              </Button>
            </div>
            {refineError && (
              <Alert severity="error" onClose={() => setRefineError(null)}>
                {refineError}
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
