import test from "node:test";
import assert from "node:assert/strict";
import { buildPaginationMeta, normalizePagination } from "../src/server/pagination";

test("normalizePagination clamps invalid values", () => {
  const pagination = normalizePagination({
    page: "-5",
    pageSize: "999",
    defaultPageSize: 25,
    maxPageSize: 100
  });

  assert.deepEqual(pagination, {
    page: 1,
    pageSize: 100,
    skip: 0,
    take: 100
  });
});

test("buildPaginationMeta reports bounds correctly", () => {
  const pagination = normalizePagination({ page: 3, pageSize: 20 });
  const meta = buildPaginationMeta(55, pagination);

  assert.equal(meta.page, 3);
  assert.equal(meta.pageCount, 3);
  assert.equal(meta.start, 41);
  assert.equal(meta.end, 55);
  assert.equal(meta.hasPrev, true);
  assert.equal(meta.hasNext, false);
});
