import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import type { User } from "../UsersClient";
import { getPremiumState, premiumUntilMillis } from "@/lib/premium";

interface PremiumDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  /** 空文字は無期限 */
  duration: string;
  onChangeDuration: (duration: string) => void;
  onGrant: () => void;
  onRevoke: () => void;
  pending: boolean;
}

/** 付与できる期間の選択肢（日数）。空文字は無期限 */
const DURATION_OPTIONS = ["", "30", "90", "180", "365"] as const;

/**
 * 管理者がユーザーにプレミアムを手動付与／取り消しするダイアログ
 */
export default function PremiumDialog({
  open,
  onClose,
  user,
  duration,
  onChangeDuration,
  onGrant,
  onRevoke,
  pending,
}: PremiumDialogProps) {
  const tAdmin = useTranslations("Admin.users");
  const state = getPremiumState(user);
  const untilMs = premiumUntilMillis(user?.premiumUntil ?? null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{tAdmin("premiumTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
          {tAdmin("premiumDesc")}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {tAdmin("premiumCurrent", {
            status:
              state === "none"
                ? tAdmin("premiumStatusNone")
                : state === "expired"
                  ? tAdmin("premiumStatusExpired")
                  : untilMs === null
                    ? tAdmin("premiumStatusUnlimited")
                    : tAdmin("premiumStatusUntil", { date: new Date(untilMs).toLocaleDateString() }),
          })}
        </Typography>
        <TextField
          select
          fullWidth
          label={tAdmin("premiumDurationLabel")}
          value={duration}
          onChange={(e) => onChangeDuration(e.target.value)}
          disabled={pending}
        >
          {DURATION_OPTIONS.map((days) => (
            <MenuItem key={days || "unlimited"} value={days}>
              {days ? tAdmin("premiumDurationDays", { days }) : tAdmin("premiumDurationUnlimited")}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={pending} color="inherit">
          {tAdmin("editBtnCancel")}
        </Button>
        <Button onClick={onRevoke} disabled={pending || state === "none"} color="error">
          {tAdmin("premiumBtnRevoke")}
        </Button>
        <Button onClick={onGrant} disabled={pending} variant="contained">
          {tAdmin("premiumBtnGrant")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
