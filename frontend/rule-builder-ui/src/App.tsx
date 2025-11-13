import { useCallback, useState } from 'react'
import './App.css'

type AskAiResponse = {
  response: string
}

const API_BASE_URL = (() => {
  const raw =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/ai'
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

function App() {
  const [input, setInput] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setReply(data.response)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [input])

  return (
    <div style={{ padding: 20 }}>
      <h2>AI Rule Builder Demo</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI..."
          style={{ width: '60%' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void askAi()
            }
          }}
        />
        <button onClick={() => void askAi()} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <pre style={{ background: '#101010', color: '#fff', padding: 12 }}>
        {reply || 'The AI response will appear here.'}
      </pre>
    </div>
  )
}

export default App
