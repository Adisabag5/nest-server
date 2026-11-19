import { DataSource } from 'typeorm';

/**
 * DataSource for the TypeORM **CLI** only — `migration:generate`, `:run`,
 * `:revert`. The running app configures TypeORM through
 * `TypeOrmModule.forRootAsync` in app.module.ts; this file exists because the
 * CLI starts no Nest context and so cannot reach ConfigService.
 *
 * `.env` is supplied by `node --env-file=.env` in the package scripts rather
 * than a dotenv import, so this adds no dependency and cannot read a different
 * file than the app does.
 * Entities are globbed from the compiled output or the source depending on how
 * the CLI is invoked, which is why both patterns are listed.
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/**/entities/*.ts', 'dist/**/entities/*.js'],
  migrations: ['src/migrations/*.ts', 'dist/migrations/*.js'],
  // Never true here. The CLI's whole job is to replace schema guessing with
  // reviewed, versioned SQL.
  synchronize: false,
});
