import { buildMeta } from './pagination';

describe('buildMeta', () => {
  it('computes pages and neighbours for a middle page', () => {
    expect(buildMeta(45, 2, 20)).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('rounds a partial last page up', () => {
    expect(buildMeta(41, 3, 20).totalPages).toBe(3);
    expect(buildMeta(41, 3, 20).hasNext).toBe(false);
  });

  it('reports an empty result as zero pages, not one', () => {
    expect(buildMeta(0, 1, 20)).toMatchObject({
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('does not claim a previous page when the list is empty', () => {
    // page 3 of nothing is a client mistake, not a reason to offer page 2
    expect(buildMeta(0, 3, 20).hasPrev).toBe(false);
  });

  it('handles a page past the end', () => {
    expect(buildMeta(10, 99, 20)).toMatchObject({
      totalPages: 1,
      hasNext: false,
      hasPrev: true,
    });
  });
});
