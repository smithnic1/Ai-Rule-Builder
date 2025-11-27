import { List, ListItem, Typography } from '@mui/material'

const RuleHints = () => (
  <>
    <Typography variant="h6" gutterBottom>
      Rule Examples
    </Typography>

    <List>
      <ListItem>“If a deckhand works over 12 hours, call someone from the casual pool first.”</ListItem>
      <ListItem>“Always call senior engineers before junior engineers.”</ListItem>
      <ListItem>“Only call cooks with valid food safety certification.”</ListItem>
    </List>

    <Typography variant="h6" gutterBottom sx={{ marginTop: 2 }}>
      Rule Schema
    </Typography>

    <pre style={{ fontSize: '0.75rem' }}>
{`{
  "action": "string",
  "target": "string",
  "conditions": [
    {
      "field": "string",
      "operator": "string",
      "value": "string"
    }
  ],
  "timeRange": "string | null",
  "priority": 1,
  "logic": "AND | OR"
}`}
    </pre>

    <Typography variant="subtitle2" gutterBottom sx={{ marginTop: 2 }}>
      Sample JSON
    </Typography>
    <pre style={{ fontSize: '0.75rem' }}>
{`{
  "action": "call",
  "target": "casual_pool",
  "priority": 1,
  "logic": "AND",
  "conditions": [
    {
      "field": "hours_worked",
      "operator": "greater_than",
      "value": "12"
    }
  ]
}`}
    </pre>

    <Typography variant="subtitle2" gutterBottom sx={{ marginTop: 2 }}>
      Multiple rules (optional)
    </Typography>
    <pre style={{ fontSize: '0.75rem' }}>
{`{
  "rules": [
    {
      "action": "call",
      "target": "casual_pool",
      "priority": 1,
      "logic": "AND",
      "conditions": [
        { "field": "hours_worked", "operator": "greater_than", "value": "12" }
      ]
    },
    {
      "action": "notify",
      "target": "supervisor",
      "priority": 2,
      "logic": "OR",
      "conditions": [
        { "field": "crew_shortage", "operator": "equals", "value": "true" }
      ]
    }
  ]
}`}
    </pre>
  </>
)

export default RuleHints
