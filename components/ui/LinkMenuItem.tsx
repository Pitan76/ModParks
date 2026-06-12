"use client";

import MenuItem, { MenuItemProps } from "@mui/material/MenuItem";
import { Link } from "@/i18n/routing";
import { ComponentProps } from "react";

type LinkMenuItemProps = MenuItemProps & ComponentProps<typeof Link>;

export default function LinkMenuItem(props: LinkMenuItemProps) {
  return <MenuItem component={Link} {...props} />;
}
