"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import ExtensionIcon from "@mui/icons-material/Extension";
import { Link } from "@/lib/i18n/routing";
import ProjectTypeBadge from "../project/ProjectTypeBadge";
import type { CartItem } from "./cartStore";

export interface CartItemRowProps {
  item: CartItem;
  /** 行の削除ボタン押下時の処理。カートと履歴で削除先が異なる */
  onRemove: () => void;
  /** 行クリックでプロジェクトへ遷移する際にドロワーを閉じる */
  onNavigate: () => void;
  /** 履歴タブでのダウンロード日時など、補助的に出す文言 */
  secondary?: string;
}

/**
 * カート／ダウンロード履歴の1行を描画する。両タブで見た目を揃えるため共通化している。
 */
export default function CartItemRow({ item, onRemove, onNavigate, secondary }: CartItemRowProps) {
  return (
    <ListItem
      secondaryAction={
        <IconButton edge="end" aria-label="delete" onClick={onRemove} color="error" size="small">
          <DeleteIcon />
        </IconButton>
      }
      disablePadding
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <ListItemButton
        component={Link}
        href={`/projects/${item.slug}`}
        onClick={onNavigate}
        sx={{ py: 0.75, pl: 0.5, pr: 5, borderRadius: 1 }}
      >
        <ListItemAvatar sx={{ minWidth: 44 }}>
          <Avatar
            src={item.iconUrl ?? undefined}
            alt={item.title}
            variant="rounded"
            sx={{ width: 32, height: 32 }}
          >
            <ExtensionIcon fontSize="small" />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          disableTypography
          primary={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, pr: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
              >
                {item.title}
              </Typography>
              <ProjectTypeBadge type={item.type} />
            </Box>
          }
          secondary={
            secondary ? <Typography variant="caption" color="text.secondary">{secondary}</Typography> : undefined
          }
        />
      </ListItemButton>
    </ListItem>
  );
}
