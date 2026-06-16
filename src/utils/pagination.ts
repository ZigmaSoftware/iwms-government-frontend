export type PaginationToken = number | "dots-left" | "dots-right";

const range = (start: number, end: number) => {
  const length = Math.max(0, end - start + 1);
  return Array.from({ length }, (_, idx) => idx + start);
};

export function buildPaginationRange(currentPage: number, totalPages: number, siblingCount = 1): PaginationToken[] {
  const normalizedTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), normalizedTotalPages);
  const totalPageNumbers = siblingCount * 2 + 5;

  if (normalizedTotalPages <= totalPageNumbers) {
    return range(1, normalizedTotalPages);
  }

  const leftSiblingIndex = Math.max(safeCurrentPage - siblingCount, 2);
  const rightSiblingIndex = Math.min(safeCurrentPage + siblingCount, normalizedTotalPages - 1);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < normalizedTotalPages - 1;

  // Only right dots
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftRange = range(1, 3 + 2 * siblingCount);
    return [...leftRange, "dots-right", normalizedTotalPages];
  }

  // Only left dots
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightRange = range(normalizedTotalPages - (3 + 2 * siblingCount) + 1, normalizedTotalPages);
    return [1, "dots-left", ...rightRange];
  }

  // Both sides have dots
  const middleRange = range(leftSiblingIndex, rightSiblingIndex);
  return [1, "dots-left", ...middleRange, "dots-right", normalizedTotalPages];
}
