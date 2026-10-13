import {actions, config} from '../../config/loader';

interface NamedTool {
  name: string;
  description?: string;
}

// The template's own label reads best. An id with no label becomes plain words,
// so "createTicket" and "create_ticket" both read "Create ticket".
export function toolDisplayName(name: string): string {
  const tools = (config as unknown as {tools?: NamedTool[]}).tools ?? [];
  const label =
    tools.find(tool => tool.name === name)?.description ??
    actions.find(action => action.id === name)?.label;
  if (label) return label;
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
