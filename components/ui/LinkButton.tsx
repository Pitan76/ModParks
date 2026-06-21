"use client";

import Button, { ButtonProps } from "@mui/material/Button";
import { Link } from "@/i18n/routing";
import { ComponentProps } from "react";

type LinkButtonProps = ButtonProps & ComponentProps<typeof Link>;

export default function LinkButton({ prefetch = false, ...props }: LinkButtonProps) {
  return <Button component={Link} prefetch={prefetch} {...props} />;
}
