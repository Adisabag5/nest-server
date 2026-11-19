import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1795103554642 implements MigrationInterface {
  name = 'InitialSchema1795103554642';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`email\` varchar(100) NOT NULL, \`password_hash\` varchar(255) NOT NULL, \`role\` enum ('ADMIN', 'USER') NOT NULL DEFAULT 'USER', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` bigint NOT NULL, \`token_hash\` varchar(64) NOT NULL, \`expires_at\` datetime NOT NULL, \`revoked_at\` datetime NULL, \`revoked_reason\` enum ('ROTATED', 'SIGNED_OUT') NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_a7838d2ba25be1342091b6695f\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`collections\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` bigint NOT NULL, \`name\` varchar(60) NOT NULL, \`description\` varchar(280) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_e42c3328523c8c83900f656243\` (\`user_id\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`beats\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` bigint NOT NULL, \`collection_id\` bigint NULL, \`title\` varchar(100) NOT NULL, \`data\` json NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`profiles\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` bigint NOT NULL, \`username\` varchar(30) NOT NULL, \`display_name\` varchar(50) NOT NULL, \`bio\` varchar(280) NULL, \`avatar_url\` varchar(500) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_9e432b7df0d182f8d292902d1a\` (\`user_id\`), UNIQUE INDEX \`IDX_d1ea35db5be7c08520d70dc03f\` (\`username\`), UNIQUE INDEX \`REL_9e432b7df0d182f8d292902d1a\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_3ddc983c5f7bcf132fd8732c3f4\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`collections\` ADD CONSTRAINT \`FK_728c4a63e823bcd4c687fe46747\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`beats\` ADD CONSTRAINT \`FK_700f3c9a243a46b8aea58a4c8c1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`beats\` ADD CONSTRAINT \`FK_20acc443ba98c1ea37623a9650e\` FOREIGN KEY (\`collection_id\`) REFERENCES \`collections\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profiles\` ADD CONSTRAINT \`FK_9e432b7df0d182f8d292902d1a2\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`profiles\` DROP FOREIGN KEY \`FK_9e432b7df0d182f8d292902d1a2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`beats\` DROP FOREIGN KEY \`FK_20acc443ba98c1ea37623a9650e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`beats\` DROP FOREIGN KEY \`FK_700f3c9a243a46b8aea58a4c8c1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`collections\` DROP FOREIGN KEY \`FK_728c4a63e823bcd4c687fe46747\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_3ddc983c5f7bcf132fd8732c3f4\``,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_9e432b7df0d182f8d292902d1a\` ON \`profiles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_d1ea35db5be7c08520d70dc03f\` ON \`profiles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9e432b7df0d182f8d292902d1a\` ON \`profiles\``,
    );
    await queryRunner.query(`DROP TABLE \`profiles\``);
    await queryRunner.query(`DROP TABLE \`beats\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_e42c3328523c8c83900f656243\` ON \`collections\``,
    );
    await queryRunner.query(`DROP TABLE \`collections\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_a7838d2ba25be1342091b6695f\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
