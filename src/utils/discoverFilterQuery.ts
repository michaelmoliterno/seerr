export const filtersToQuery = (
  filters: Record<string, string | undefined>
): string =>
  new URLSearchParams(
    Object.entries(filters).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  ).toString();

// Reads the query params of a pasted Discover page URL (or just its query
// string). Run the result through prepareFilterValues to keep only filters.
export const paramsFromDiscoverUrl = (
  input: string
): Record<string, string> => {
  const trimmed = input.trim();
  const query = (
    trimmed.includes('?')
      ? trimmed.slice(trimmed.indexOf('?') + 1)
      : trimmed.includes('=')
        ? trimmed
        : ''
  ).split('#')[0];

  return Object.fromEntries(new URLSearchParams(query));
};
