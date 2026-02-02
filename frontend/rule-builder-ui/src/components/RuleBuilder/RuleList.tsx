import { List, ListItemButton, ListItemText, Typography } from '@mui/material'
import type { RuleSchema } from './types'

type RuleListProps = {
  rules: RuleSchema[]
  onSelect: (rule: RuleSchema) => void
  selectedRule?: RuleSchema | null
}

const RuleList = ({ rules, onSelect, selectedRule }: RuleListProps) => {
  if (!rules.length) {
    return null
  }

  return (
    <>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Extracted Rules ({rules.length})
      </Typography>
      <List disablePadding>
        {rules.map((rule, index) => {
          const action = rule.action?.trim() || 'Untitled action'
          const target = rule.target?.trim() || 'No target'
          const conditionsCount = Array.isArray(rule.conditions) ? rule.conditions.length : 0

          return (
            <ListItemButton
              key={`${action}-${target}-${index}`}
              onClick={() => onSelect(rule)}
              selected={selectedRule === rule}
            >
              <ListItemText
                primary={`${action} → ${target}`}
                secondary={`${conditionsCount} ${conditionsCount === 1 ? 'condition' : 'conditions'}`}
              />
            </ListItemButton>
          )
        })}
      </List>
    </>
  )
}

export default RuleList
