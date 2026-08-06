"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ProjectCardProps } from "@/components/project/ProjectCard";
import PlainProjectCard from "./PlainProjectCard";
import styles from "../plain.module.css";

export type PlainProjectCardListProps = {
  projects: ProjectCardProps["project"][];
  layout: "list" | "grid";
  onLayoutChange: (layout: "list" | "grid") => void;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  emptyContent?: ReactNode;
  footer?: ReactNode;
};

/**
 * Plain Theme 用のプロジェクト一覧表示。
 * 表示形式の保持は呼び出し元（ProjectCardList）が担い、ここは描画のみを行う。
 */
const PlainProjectCardList = ({
  projects,
  layout,
  onLayoutChange,
  headerLeft,
  headerRight,
  emptyContent,
  footer,
}: PlainProjectCardListProps) => {
  const tCommon = useTranslations("Common");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {headerLeft}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {headerRight}
          {projects.length > 0 && (
            <select value={layout} onChange={(e) => onLayoutChange(e.target.value as "list" | "grid")}>
              <option value="list">{tCommon("view.list")}</option>
              <option value="grid">{tCommon("view.grid")}</option>
            </select>
          )}
        </span>
      </div>

      {projects.length === 0 ? (
        emptyContent
      ) : (
        <div className={layout === "grid" ? styles.grid : styles.list}>
          {projects.map((project) => (
            <PlainProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {footer && <div style={{ marginTop: "1rem" }}>{footer}</div>}
    </div>
  );
};

export default PlainProjectCardList;
