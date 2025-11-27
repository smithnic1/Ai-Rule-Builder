import { Box, Typography } from '@mui/material'
import JsonEditor from './JsonEditor'
import { isRuleEmpty, type RuleSchema } from './types'

type RulePreviewProps = {
  rule: RuleSchema
}

const RulePreview = ({ rule }: RulePreviewProps) => {
  const empty = isRuleEmpty(rule)

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Rule Output
      </Typography>
      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: '#f7f8fb',
          minHeight: 200,
          padding: 2
        }}
      >
        {!empty ? (
          <JsonEditor json={rule} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Your rule will appear here.
          </Typography>
        )}
      </Box>
    </>
  )
}

export default RulePreview
