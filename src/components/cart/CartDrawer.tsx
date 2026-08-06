"use client";

import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBorderColor } from "@/lib/hooks/useBorderColor";
import { useCart } from "./cartStore";
import { useDownloadHistory } from "./downloadHistory";
import { useBulkDownload } from "./useBulkDownload";
import CartItemRow from "./CartItemRow";
import CartDownloadFilter from "./CartDownloadFilter";
import CartExportDialog from "./CartExportDialog";
import SaveCartToCollectionModal from "./SaveCartToCollectionModal";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** 未ログインなら null。コレクションへの保存導線の出し分けに使う */
  userId?: string | null;
}

/** カート内容とダウンロード履歴を切り替えて表示する右側ドロワー */
export default function CartDrawer({ open, onClose, userId }: CartDrawerProps) {
  const t = useTranslations("Cart");
  const tCommon = useTranslations("Common");
  const { items, remove, clear } = useCart();
  const history = useDownloadHistory();
  const borderColor = useBorderColor();

  const [tab, setTab] = useState<"cart" | "history">("cart");

  // 空文字は「指定なし」。条件に合うバージョンが無い場合はサーバ側が最新版へフォールバックする
  const [loader, setLoader] = useState("");
  const [mcVersion, setMcVersion] = useState("");

  const [exportOpen, setExportOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDownloadAll = useBulkDownload(items, { loader, mcVersion }, history.record);

  const isCartTab = tab === "cart";
  const title = isCartTab ? `${t("title")} (${items.length})` : `${t("history")} (${history.items.length})`;

  function renderEmpty(text: string) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">{text}</Typography>
      </Box>
    );
  }

  function renderList() {
    if (isCartTab) {
      if (items.length === 0) return renderEmpty(t("empty"));
      return (
        <List disablePadding>
          {items.map((item) => (
            <CartItemRow key={item.id} item={item} onRemove={() => remove(item.id)} onNavigate={onClose} />
          ))}
        </List>
      );
    }

    if (history.items.length === 0) return renderEmpty(t("historyEmpty"));
    return (
      <List disablePadding>
        {history.items.map((entry) => (
          <CartItemRow
            key={entry.id}
            item={entry}
            onRemove={() => history.remove(entry.id)}
            onNavigate={onClose}
            secondary={new Date(entry.downloadedAt).toLocaleString()}
          />
        ))}
      </List>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // AppHeader が zIndex.drawer + 1 なので、それより手前に出す
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      slotProps={{
        paper: { sx: { width: { xs: "100%", sm: 400 }, display: "flex", flexDirection: "column" } }
      }}
    >
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
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
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

      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1 }}>{renderList()}</Box>

      {isCartTab && items.length > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <CartDownloadFilter
            loader={loader}
            mcVersion={mcVersion}
            onLoaderChange={setLoader}
            onMcVersionChange={setMcVersion}
          />

          <Box sx={{ display: "flex", gap: 1, alignItems: "stretch" }}>
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
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label={tCommon("moreActions")}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <MenuItem onClick={() => { setMenuAnchor(null); setExportOpen(true); }}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              {t("export")}
            </MenuItem>
            {userId && (
              <MenuItem onClick={() => { setMenuAnchor(null); setSaveOpen(true); }}>
                <ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon>
                {t("saveToCollection")}
              </MenuItem>
            )}
            <MenuItem onClick={() => { setMenuAnchor(null); clear(); }}>
              <ListItemIcon><DeleteSweepIcon fontSize="small" color="error" /></ListItemIcon>
              {t("clear")}
            </MenuItem>
          </Menu>
        </Box>
      )}

      {!isCartTab && history.items.length > 0 && (
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

      <CartExportDialog open={exportOpen} onClose={() => setExportOpen(false)} items={items} />

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
