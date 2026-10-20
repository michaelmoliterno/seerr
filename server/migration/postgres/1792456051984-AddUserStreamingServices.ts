import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStreamingServices1792456051984 implements MigrationInterface {
  name = 'AddUserStreamingServices1792456051984';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "streamingServices" text`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "hideStreamingServices" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "hideStreamingServices"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "streamingServices"`
    );
  }
}
