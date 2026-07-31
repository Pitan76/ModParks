"use client";

import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ExtensionIcon from "@mui/icons-material/Extension";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LOADERS_DATA } from "@/lib/data/loaderIds";
import { MC_VERSIONS } from "@/lib/data/minecraftVersions";
import { useCart } from "./cartStore";
import { buildProjectDownloadUrl } from "@/lib/utils/downloadUrl";
import ProjectTypeBadge from "../project/ProjectTypeBadge";
import { useColorMode } from "@/components/ThemeRegistry";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const t = useTranslations("Cart");
  const { items, remove, clear } = useCart();
  const { mode, isNewTheme } = useColorMode();

  const borderColor = isNewTheme
    ? (mode === "light" ? "#e0e0e0" : "#3c4043")
    : (mode === "light" ? "#e2e8f0" : "#334155");

  // 空文字は「指定なし」。条件に合うバージョンが無い場合はサーバ側が最新版へフォールバックする
  const [loader, setLoader] = useState("");
  const [mcVersion, setMcVersion] = useState("");

  const handleDownloadAll = async () => {
    const pref = {
      loaders:    loader ? [loader] : undefined,
      mcVersions: mcVersion ? [mcVersion] : undefined,
    };

    // iframe は CSP の frame-src に阻まれるため、<a download> のクリックで開始する
    for (const item of items) {
      const a = document.createElement("a");
      a.href = buildProjectDownloadUrl(item.slug, pref);
      a.download = "";
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Delay slightly between requests to ease browser load (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        // AppHeader が zIndex.drawer + 1 なので、それより手前に出す
        zIndex: (theme) => theme.zIndex.modal
      }}
      slotProps={{
        paper: {
          sx: { width: { xs: "100%", sm: 400 }, display: "flex", flexDirection: "column" }
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          // ヘッダーの区切り線とちょうど揃うよう、境界線分の1pxを足す
          minHeight: { xs: 57, sm: 65 },
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: borderColor,
          boxSizing: "border-box"
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("title")} ({items.length})
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Cart List */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {items.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              {t("empty")}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((item) => (
              <ListItem
                key={item.id}
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => remove(item.id)} color="error" size="small">
                    <DeleteIcon />
                  </IconButton>
                }
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  py: 1.5,
                  px: 0.5
                }}
              >
                <ListItemAvatar sx={{ minWidth: 48 }}>
                  <Avatar
                    src={item.iconUrl ?? undefined}
                    alt={item.title}
                    variant="rounded"
                    sx={{ width: 36, height: 36 }}
                  >
                    <ExtensionIcon fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pr: 2 }}>
                      {item.title}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <ProjectTypeBadge type={item.type as any} />
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Footer Actions */}
      {items.length > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          {/* ダウンロードするバージョンの絞り込み（合致が無ければ最新版になる） */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
            <TextField
              select
              size="small"
              fullWidth
              label={t("loader")}
              value={loader}
              onChange={(e) => setLoader(e.target.value)}
            >
              <MenuItem value="">{t("anyFilter")}</MenuItem>
              {LOADERS_DATA.map((l) => (
                <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              fullWidth
              label={t("mcVersion")}
              value={mcVersion}
              onChange={(e) => setMcVersion(e.target.value)}
              slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } } }}
            >
              <MenuItem value="">{t("anyFilter")}</MenuItem>
              {MC_VERSIONS.map((v) => (
                <MenuItem key={v} value={v}>{v}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Alert severity="info" sx={{ mb: 2, "& .MuiAlert-message": { fontSize: "0.75rem" } }}>
            {t("downloadWarning")}
          </Alert>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="outlined"
              color="inherit"
              fullWidth
              startIcon={<DeleteSweepIcon />}
              onClick={clear}
              sx={{ py: 1 }}
            >
              {t("clear")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={handleDownloadAll}
              sx={{ py: 1 }}
            >
              {t("downloadAll")}
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
