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
import { useTranslations } from "next-intl";
import { useCart } from "./cartStore";
import ProjectTypeBadge from "../project/ProjectTypeBadge";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const t = useTranslations("Cart");
  const { items, remove, clear } = useCart();

  const handleDownloadAll = async () => {
    for (const item of items) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/api/download?slug=${encodeURIComponent(item.slug)}`;
      document.body.appendChild(iframe);
      
      // Delay slightly between requests to ease browser load (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      // Cleanup iframe after download starts
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: "100%", sm: 400 }, display: "flex", flexDirection: "column" }
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
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
