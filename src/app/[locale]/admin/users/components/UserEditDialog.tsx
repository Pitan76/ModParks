import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

interface UserEditDialogProps {
  open: boolean;
  onClose: () => void;
  username: string;
  onChangeUsername: (username: string) => void;
  onSave: () => void;
  pending: boolean;
}

/**
 * ユーザーID (username) を編集するモーダルダイアログ
 */
export default function UserEditDialog({
  open,
  onClose,
  username,
  onChangeUsername,
  onSave,
  pending,
}: UserEditDialogProps) {
  const tAdmin = useTranslations("Admin.users");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{tAdmin("editTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
          {tAdmin("editDesc")}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label={tAdmin("editLabel")}
          value={username}
          onChange={(e) => onChangeUsername(e.target.value)}
          disabled={pending}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={pending} color="inherit">
          {tAdmin("editBtnCancel")}
        </Button>
        <Button onClick={onSave} disabled={pending || !username} variant="contained">
          {tAdmin("editBtnSave")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
