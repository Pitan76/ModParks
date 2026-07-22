"use client";

import CardActionArea from "@mui/material/CardActionArea";
import type { CardActionAreaProps } from "@mui/material/CardActionArea";
import { Link } from "@/i18n/routing";
import type { ComponentProps } from "react";

/**
 * リンクカードアクションエリアコンポーネントのProps型
 */
type LinkCardActionAreaProps = CardActionAreaProps & ComponentProps<typeof Link>;

/**
 * MUI の CardActionArea コンポーネントの見た目で、next-intl の Link 遷移を行うコンポーネント。
 */
const LinkCardActionArea = ({ prefetch = false, ...props }: LinkCardActionAreaProps) => {
  // eslint-disable-next-line no-restricted-syntax
  return <CardActionArea component={Link} prefetch={prefetch} {...props} />;
};

export default LinkCardActionArea;
