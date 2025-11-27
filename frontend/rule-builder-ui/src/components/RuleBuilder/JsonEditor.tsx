import { JsonView, defaultStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type JsonEditorProps = {
  json: JsonValue
}

const JsonEditor = ({ json }: JsonEditorProps) => {
  return (
    <JsonView data={json} style={defaultStyles} shouldExpandNode={() => true} />
  )
}

export default JsonEditor
