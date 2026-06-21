"use client";

import CardActionArea, { CardActionAreaProps } from "@mui/material/CardActionArea";
import { Link } from "@/i18n/routing";
import { ComponentProps } from "react";

type LinkCardActionAreaProps = CardActionAreaProps & ComponentProps<typeof Link>;

export default function LinkCardActionArea({ prefetch = false, ...props }: LinkCardActionAreaProps) {
  return <CardActionArea component={Link} prefetch={prefetch} {...props} />;
}
