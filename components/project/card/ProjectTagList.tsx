"use client";

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import ProjectTagBadge from "../ProjectTagBadge";

export type ProjectTagListProps = {
  tags: string[];
  /** 展開して表示する件数。超過分は「+N」にまとめる */
  visibleCount: number;
  /** カード上端の余白調整。グリッド表示では不要 */
  marginTop?: object | number;
};

/** プロジェクトのタグを一定数まで並べ、残りを「+N」のツールチップにまとめる */
const ProjectTagList = ({ tags, visibleCount, marginTop = 0 }: ProjectTagListProps) => {
  const tTags = useTranslations("Tags");
  const router = useRouter();

  if (tags.length === 0) return null;

  const getTagLabel = (tag: string) => {
    const key = tag.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return tTags.has(key) ? tTags(key) : tag;
  };

  const hidden = tags.slice(visibleCount);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        mt: marginTop,
        flexWrap: "wrap",
        justifyContent: "flex-end",
        flexShrink: 0,
      }}
    >
      {tags.slice(0, visibleCount).map((tag) => (
        <ProjectTagBadge
          key={tag}
          tag={tag}
          clickable
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(`/projects?tags=${encodeURIComponent(tag)}`);
          }}
        />
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.map(getTagLabel).join(", ")} arrow placement="top">
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              height: 18,
              cursor: "help",
              color: "text.disabled",
              fontSize: "0.65rem",
              lineHeight: 1,
            }}
          >
            +{hidden.length}
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

export default ProjectTagList;
