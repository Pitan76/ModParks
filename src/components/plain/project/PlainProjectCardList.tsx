"use client";

import type { ReactNode } from "react";
import type { ProjectCardProps } from "@/components/project/ProjectCard";
import PlainProjectTable from "./PlainProjectTable";

export type PlainProjectCardListProps = {
  projects: ProjectCardProps["project"][];
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  emptyContent?: ReactNode;
  footer?: ReactNode;
};

/**
 * Plain Theme 用のプロジェクト一覧の外枠。
 * リスト/グリッドの切り替えは持たず、常にテーブル表示にする。
 */
const PlainProjectCardList = ({ projects, headerLeft, headerRight, emptyContent, footer }: PlainProjectCardListProps) => (
  <div>
    {(headerLeft || headerRight) && (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {headerLeft}
        <span style={{ marginLeft: "auto" }}>{headerRight}</span>
      </div>
    )}

    {projects.length === 0 ? emptyContent : <PlainProjectTable projects={projects} />}

    {footer && <div style={{ marginTop: "1rem" }}>{footer}</div>}
  </div>
);

export default PlainProjectCardList;
