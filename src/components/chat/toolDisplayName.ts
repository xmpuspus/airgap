// Tool ids are snake_case; people read them as plain words.
export function toolDisplayName(name: string): string {
  return name.replaceAll('_', ' ');
}
