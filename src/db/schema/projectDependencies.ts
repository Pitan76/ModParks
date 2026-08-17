/**
 * プロジェクト間・バージョン間の依存関係テーブル。
 * projects と versions の両方を参照するため、双方から独立したファイルに置く。
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { versions } from "./versions";

export const projectDependencies = sqliteTable(
  "project_dependencies",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    targetProjectId: text("target_project_id").references(() => projects.id, { onDelete: "cascade" }),
    /**
     * 依存を適用するバージョン。null ならプロジェクト全体の依存として扱う。
     *
     * 前提モジュールは MC バージョンやローダーの更新で入れ替わるため、
     * 「どのファイルに何が要るか」はバージョン単位でしか正確に書けない。
     * 別テーブルにせず列を足しているのは、被依存（逆引き）を 1 本のクエリで
     * 取れる形を保つため。
     */
    versionId: text("version_id").references(() => versions.id, { onDelete: "cascade" }),
    /**
     * 依存が要るプラットフォーム（JSON: string[]）。null または空配列で全プラットフォーム。
     *
     * 前提 MOD はローダーごとに違う（Fabric なら Fabric API、Forge なら別物）ため、
     * プロジェクト全体の依存を 1 本に潰すと、どちらの利用者にも嘘になる。
     * versions.loaders と同じ JSON 文字列配列で持ち、突き合わせは配列の交差で行う。
     */
    loaders: text("loaders"),
    externalUrl: text("external_url"),
    externalName: text("external_name"),
    dependencyType: text("dependency_type").notNull().default("required"), // required, optional, incompatible, embedded
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index("project_deps_project_idx").on(t.projectId),
    index("project_deps_target_idx").on(t.targetProjectId),
    index("project_deps_version_idx").on(t.versionId),
  ]
);

export type ProjectDependency = typeof projectDependencies.$inferSelect;
