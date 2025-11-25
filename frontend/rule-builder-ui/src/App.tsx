import { useCallback, useMemo, useState } from 'react'
import './App.css'

type AskAiResponse = {
  response: string
}

type SummarizeResponse = {
  summary: string
}

type RulePipelineResponse = {
  result: string
}

const API_BASE_URL = (() => {
  const raw =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/ai'
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

const PLUGIN_BASE_URL = (() => {
  const raw =
    (import.meta.env.VITE_PLUGIN_BASE_URL as string | undefined) ?? '/api/plugin'
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

const RULE_PIPELINE_BASE_URL = (() => {
  const raw =
    (import.meta.env.VITE_RULE_PIPELINE_BASE_URL as string | undefined) ??
    '/api/rulepipeline'
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

function App() {
  const [input, setInput] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disableControls = useMemo(() => loading, [loading])

  const formatReply = useCallback((value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return ''
      }
      try {
        const parsed = JSON.parse(trimmed)
        return JSON.stringify(parsed, null, 2)
      } catch {
        return value
      }
    }

    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [])

  const askAi = useCallback(async () => {
    if (!input.trim()) {
      setError('Enter a prompt before sending.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input })
      })

      if (!response.ok) {
        throw new Error('The API did not return a successful response.')
      }

      const data = (await response.json()) as AskAiResponse
      setReply(formatReply(data.response))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [input, formatReply])

  const runSummarize = useCallback(async () => {
    if (!input.trim()) {
      setError('Enter text to summarize.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${PLUGIN_BASE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      })
      if (!response.ok) {
        throw new Error('Failed to reach summarize endpoint.')
      }
      const data = (await response.json()) as SummarizeResponse
      setReply(formatReply(data))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [input, formatReply])

  const runRulePipeline = useCallback(async () => {
    if (!input.trim()) {
      setError('Enter text to extract rule intent.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${RULE_PIPELINE_BASE_URL}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      })
      if (!response.ok) {
        throw new Error('Failed to reach rule pipeline endpoint.')
      }
      const data = (await response.json()) as RulePipelineResponse
      setReply(formatReply(data.result))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [input, formatReply])

  return (
    <div style={{ padding: 20 }}>
      <h2>AI Rule Builder</h2>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          alignItems: 'stretch'
        }}
      >
        <textarea
          id="prompt-input"
          name="prompt"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI..."
          rows={4}
          style={{ width: '60%', resize: 'vertical', padding: 8 }}
        />
        <button
          onClick={() => void askAi()}
          disabled={disableControls}
          style={{ alignSelf: 'flex-start', height: 'fit-content' }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => void runRulePipeline()} disabled={disableControls}>
          Extract Rule Intent
        </button>
        <button onClick={() => void runSummarize()} disabled={disableControls}>
          Summarize Input (Plugin)
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <pre
        style={{
          background: '#101010',
          color: '#fff',
          padding: 12,
          textAlign: 'left'
        }}
      >
        {reply || 'The AI response will appear here.'}
      </pre>
    </div>
  )
}

export default App
