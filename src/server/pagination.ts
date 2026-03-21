export type PaginationInput = {
  page?: number | string | null | undefined;
  pageSize?: number | string | null | undefined;
  defaultPageSize?: number;
  maxPageSize?: number;
};

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function normalizePagination(input: PaginationInput = {}): Pagination {
  const defaultPageSize = Math.max(1, Math.floor(Number(input.defaultPageSize ?? 50)));
  const maxPageSize = Math.max(defaultPageSize, Math.floor(Number(input.maxPageSize ?? 100)));

  const parsedPage = Number.parseInt(String(input.page ?? "1"), 10);
  const parsedPageSize = Number.parseInt(String(input.pageSize ?? defaultPageSize), 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, maxPageSize)
      : defaultPageSize;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function buildPaginationMeta(total: number, pagination: Pagination) {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / pagination.pageSize));
  const page = Math.min(pagination.page, pageCount);
  const start = total === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, start + pagination.pageSize - 1);

  return {
    total,
    page,
    pageSize: pagination.pageSize,
    pageCount,
    hasPrev: page > 1,
    hasNext: page < pageCount,
    start,
    end
  };
}
