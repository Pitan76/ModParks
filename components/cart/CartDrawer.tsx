"use client";

import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import { Link } from "@/lib/i18n/routing";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Snackbar from "@mui/material/Snackbar";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ExtensionIcon from "@mui/icons-material/Extension";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LOADERS_DATA } from "@/lib/data/loaderIds";
import { MC_VERSIONS } from "@/lib/data/minecraftVersions";
import { useCart, type CartItem } from "./cartStore";
import { useDownloadHistory } from "./downloadHistory";
import { exportCart, EXPORT_FORMATS, type ExportFormat } from "./cartExport";
import SaveCartToCollectionModal from "./SaveCartToCollectionModal";
import { buildProjectDownloadUrl } from "@/lib/utils/downloadUrl";
import ProjectTypeBadge from "../project/ProjectTypeBadge";
import { useColorMode } from "@/components/ThemeRegistry";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** 未ログインなら null。コレクションへの保存導線の出し分けに使う */
  userId?: string | null;
}

export default function CartDrawer({ open, onClose, userId }: CartDrawerProps) {
  const t = useTranslations("Cart");
  const { items, remove, clear } = useCart();
  const history = useDownloadHistory();
  const { mode, isNewTheme } = useColorMode();

  const borderColor = isNewTheme
    ? (mode === "light" ? "#e0e0e0" : "#3c4043")
    : (mode === "light" ? "#e2e8f0" : "#334155");

  const [tab, setTab] = useState<"cart" | "history">("cart");

  // 空文字は「指定なし」。条件に合うバージョンが無い場合はサーバ側が最新版へフォールバックする
  const [loader, setLoader] = useState("");
  const [mcVersion, setMcVersion] = useState("");

  const [format, setFormat] = useState<ExportFormat>("json");
  const [saveOpen, setSaveOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

    history.record(items, { loader, mcVersion });
  };

  function handleExport() {
    exportCart(items, format);
  }

  function renderRow(item: CartItem, onRemove: () => void, secondary?: string) {
    return (
      <ListItem
        key={item.id}
        secondaryAction={
          <IconButton edge="end" aria-label="delete" onClick={onRemove} color="error" size="small">
            <DeleteIcon />
          </IconButton>
        }
        disablePadding
        sx={{
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <ListItemButton
          component={Link}
          href={`/projects/${item.slug}`}
          onClick={onClose}
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
                <Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {item.title}
                </Typography>
                <ProjectTypeBadge type={item.type as any} />
              </Box>
            }
            secondary={
              secondary ? (
                <Typography variant="caption" color="text.secondary">{secondary}</Typography>
              ) : undefined
            }
          />
        </ListItemButton>
      </ListItem>
    );
  }

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
          {tab === "cart" ? `${t("title")} (${items.length})` : `${t("history")} (${history.items.length})`}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: "divider", minHeight: 42 }}
      >
        <Tab value="cart" label={t("title")} sx={{ minHeight: 42 }} />
        <Tab value="history" label={t("history")} sx={{ minHeight: 42 }} />
      </Tabs>

      {/* List */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1 }}>
        {tab === "cart" ? (
          items.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                {t("empty")}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {items.map((item) => renderRow(item, () => remove(item.id)))}
            </List>
          )
        ) : history.items.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              {t("historyEmpty")}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {history.items.map((entry) =>
              renderRow(
                entry,
                () => history.remove(entry.id),
                new Date(entry.downloadedAt).toLocaleString()
              )
            )}
          </List>
        )}
      </Box>

      {/* Footer Actions */}
      {tab === "cart" && items.length > 0 && (
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
              // テーマ既定の disablePortal だとドロワー内に埋め込まれて表示位置が崩れる
              slotProps={{ select: { MenuProps: { disablePortal: false, slotProps: { paper: { sx: { maxHeight: 320 } } } } } }}
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
              slotProps={{ select: { MenuProps: { disablePortal: false, slotProps: { paper: { sx: { maxHeight: 320 } } } } } }}
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
          <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
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

          {/* エクスポート（mod名とURLの一覧） */}
          <Box sx={{ display: "flex", gap: 1.5, mb: userId ? 1.5 : 0 }}>
            <TextField
              select
              size="small"
              label={t("exportFormat")}
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              sx={{ minWidth: 130 }}
              slotProps={{ select: { MenuProps: { disablePortal: false } } }}
            >
              {EXPORT_FORMATS.map((f) => (
                <MenuItem key={f} value={f}>{t(`format.${f}`)}</MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<FileDownloadIcon />}
              onClick={handleExport}
            >
              {t("export")}
            </Button>
          </Box>

          {userId && (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PlaylistAddIcon />}
              onClick={() => setSaveOpen(true)}
              sx={{ py: 1 }}
            >
              {t("saveToCollection")}
            </Button>
          )}
        </Box>
      )}

      {tab === "history" && history.items.length > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Button
            variant="outlined"
            color="inherit"
            fullWidth
            startIcon={<DeleteSweepIcon />}
            onClick={history.clear}
            sx={{ py: 1 }}
          >
            {t("clearHistory")}
          </Button>
        </Box>
      )}

      {userId && (
        <SaveCartToCollectionModal
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          userId={userId}
          items={items}
          onSaved={(added) => setMessage(added > 0 ? t("savedItems", { count: added }) : t("allInCollection"))}
        />
      )}

      <Snackbar
        open={message !== null}
        autoHideDuration={3000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setMessage(null)} sx={{ width: "100%" }}>
          {message}
        </Alert>
      </Snackbar>
    </Drawer>
  );
}
