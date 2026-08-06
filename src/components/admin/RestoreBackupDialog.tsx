import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Checkbox from "@mui/material/Checkbox";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import BackupConfirmSection from "./BackupConfirmSection";
import { useTranslations } from "next-intl";

export type RestoreBackupDialogProps = {
  open: boolean;
  onClose: () => void;
  targetName: string | null;
  snapshotDownloaded: boolean;
  snapshot: { key: string; downloadUrl: string } | null;
  confirmPhrase: string;
  totpToken: string;
  isPending: boolean;
  restoreMode: "all" | "downloads_only" | "selected_tables";
  selectedTables: string[];
  onChangeRestoreMode: (mode: "all" | "downloads_only" | "selected_tables") => void;
  onChangeSelectedTables: (tables: string[]) => void;
  onDownloadSnapshot: () => void;
  onChangeConfirmPhrase: (val: string) => void;
  onChangeTotpToken: (val: string) => void;
  onConfirm: () => void;
};

const RESTORE_CONFIRM_PHRASE = "RESTORE";

const SCHEMA_TABLES_LIST = [
  "users",
  "user_profiles",
  "user_settings",
  "account",
  "session",
  "verificationToken",
  "api_keys",
  "projects",
  "categories",
  "project_categories",
  "versions",
  "version_loaders",
  "version_mc_versions",
  "project_tags",
  "project_dependencies",
  "project_members",
  "project_favorites",
  "project_media",
  "project_hidden_recipes",
  "collections",
  "collection_items",
  "reports",
  "ideas",
  "idea_likes",
  "idea_comments",
  "version_ideas",
  "tags",
  "platforms",
  "authenticator",
  "rate_limits",
  "github_installations",
  "user_follows",
  "collection_follows",
  "project_comments",
  "password_reset_tokens",
  "project_subscriptions",
  "developer_subscriptions",
  "notifications",
  "scan_appeals",
  "profile_pins",
];

/**
 * データベースの復元を実行するための確認ダイアログ。
 * 部分復元モード（ダウンロード数のみ復元、選択したテーブルのみ復元）の選択をサポートします。
 */
const RestoreBackupDialog = ({
  open,
  onClose,
  targetName,
  snapshotDownloaded,
  snapshot,
  confirmPhrase,
  totpToken,
  isPending,
  restoreMode,
  selectedTables,
  onChangeRestoreMode,
  onChangeSelectedTables,
  onDownloadSnapshot,
  onChangeConfirmPhrase,
  onChangeTotpToken,
  onConfirm
}: RestoreBackupDialogProps) => {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const canRestore =
    snapshotDownloaded &&
    totpToken.trim().length > 0 &&
    confirmPhrase.trim() === RESTORE_CONFIRM_PHRASE &&
    (restoreMode !== "selected_tables" || selectedTables.length > 0) &&
    !isPending;

  const handleTableToggle = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      onChangeSelectedTables(selectedTables.filter((t) => t !== tableName));
    } else {
      onChangeSelectedTables([...selectedTables, tableName]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle color="warning.main">{tAdmin("backup.restore")}</DialogTitle>
      <DialogContent>
        <DialogContentText color="error.main" sx={{ fontWeight: "bold", mb: 2 }}>
          {tAdmin("backup.restoreWarning")}
        </DialogContentText>
        <DialogContentText sx={{ mb: 3 }}>
          {tAdmin("backup.confirmRestore")}
          {targetName && (
            <Box sx={{ mt: 1, fontWeight: "bold", fontFamily: "monospace", wordBreak: "break-all" }}>
              {targetName.replace("backup/", "")}
            </Box>
          )}
        </DialogContentText>

        <Divider sx={{ my: 2 }} />

        {/* 復元モード選択セクション */}
        <FormControl component="fieldset" sx={{ width: "100%", mb: 3 }}>
          <FormLabel component="legend" sx={{ fontWeight: "bold", mb: 1, color: "text.primary" }}>
            復元範囲の設定 (Restore Scope Mode)
          </FormLabel>
          <RadioGroup
            value={restoreMode}
            onChange={(e) => onChangeRestoreMode(e.target.value as any)}
          >
            <FormControlLabel
              value="all"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                    データベース全体を復元 (Full Database Restore)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    既存の全データを削除し、バックアップ時点の状態に完全に置き換えます。
                  </Typography>
                </Box>
              }
              sx={{ mb: 2, alignItems: "flex-start" }}
            />
            <FormControlLabel
              value="downloads_only"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                    ダウンロード数のみ復元 (Download Counts Only)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    既存データは一切削除せず、DDoS等でインフレしたプロジェクト・バージョンのダウンロード数値のみをバックアップから復旧・修正します。
                  </Typography>
                </Box>
              }
              sx={{ mb: 2, alignItems: "flex-start" }}
            />
            <FormControlLabel
              value="selected_tables"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                    一部のテーブルのみ削除して復元 (Selected Tables)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    選択したテーブルのデータのみをクリアし、バックアップから復旧します。
                  </Typography>
                </Box>
              }
              sx={{ mb: 1, alignItems: "flex-start" }}
            />
          </RadioGroup>
        </FormControl>

        {/* テーブル選択エリア (selected_tables モード時のみ表示) */}
        {restoreMode === "selected_tables" && (
          <Box sx={{ pl: 4, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
              対象テーブルを選択してください (Select Tables):
            </Typography>
            <Box
              sx={{
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 2,
                backgroundColor: "action.hover"
              }}
            >
              <FormGroup>
                <Grid container spacing={1}>
                  {SCHEMA_TABLES_LIST.map((tableName) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tableName}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedTables.includes(tableName)}
                            onChange={() => handleTableToggle(tableName)}
                          />
                        }
                        label={tableName}
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <BackupConfirmSection
          snapshotDownloaded={snapshotDownloaded}
          snapshot={snapshot}
          confirmPhrase={confirmPhrase}
          totpToken={totpToken}
          isPending={isPending}
          activePhrase={RESTORE_CONFIRM_PHRASE}
          onDownloadSnapshot={onDownloadSnapshot}
          onChangeConfirmPhrase={onChangeConfirmPhrase}
          onChangeTotpToken={onChangeTotpToken}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          {tCommon("cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          color="warning"
          variant="contained"
          disabled={!canRestore}
        >
          {tAdmin("backup.restore")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestoreBackupDialog;
