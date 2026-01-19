export function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export function contentChanged(oldContent: string, newContent: string): boolean {
  return simpleHash(oldContent) !== simpleHash(newContent);
}
