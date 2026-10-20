// Accepts a bare ID or a URL like https://www.themoviedb.org/list/28-best-picture
export const parseTmdbListId = (input: string): string => {
  const match = input.trim().match(/^(?:.*\/list\/)?(\d+)(?:[-/?#].*)?$/);
  return match ? match[1] : '';
};
