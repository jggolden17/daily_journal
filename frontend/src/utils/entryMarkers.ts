export const ENTRY_MARKER_PREFIX = '\u200B\u200BENTRY:';
export const ENTRY_MARKER_SUFFIX = '\u200B\u200B';

const markerPattern = new RegExp(`${ENTRY_MARKER_PREFIX}(.*?)${ENTRY_MARKER_SUFFIX}`, 'g');
const hiddenSpanPattern = /<span data-entry-marker="(.*?)"[^>]*><\/span>/g;

export function markersToHiddenSpans(markdown: string): string {
  return markdown.replace(markerPattern, (_match, id) => `
<span data-entry-marker="${id}" style="display:none;"></span>
`.trim());
}

export function hiddenSpansToMarkers(htmlOrMarkdown: string): string {
  return htmlOrMarkdown.replace(hiddenSpanPattern, (_match, id) => `${ENTRY_MARKER_PREFIX}${id}${ENTRY_MARKER_SUFFIX}`);
}
