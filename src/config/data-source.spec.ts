import dataSource from './data-source';

describe('the CLI DataSource', () => {
  it('globs one source tree, not both', () => {
    // Listing src/**/*.ts and dist/**/*.js together loads every entity and
    // migration twice the moment `pnpm build` has produced dist/, and TypeORM
    // refuses to start: "Duplicate migrations: InitialSchema...". Which makes
    // it fail precisely on a deploy, where a build always precedes migrating.
    expect(dataSource.options.migrations).toHaveLength(1);
    expect(dataSource.options.entities).toHaveLength(1);
  });

  it('never synchronizes', () => {
    // The CLI's whole job is replacing schema guesswork with reviewed SQL.
    expect(dataSource.options.synchronize).toBe(false);
  });
});
