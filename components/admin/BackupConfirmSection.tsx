import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import TextField from "@mui/material/TextField";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslations } from "next-intl";

type BackupConfirmSectionProps = {
  snapshotDownloaded: boolean;
  snapshot: { key: string; downloadUrl: string } | null;
  confirmPhrase: string;
  totpToken: string;
  isPending: boolean;
  activePhrase: string;
  onDownloadSnapshot: () => void;
  onChangeConfirmPhrase: (val: string) => void;
  onChangeTotpToken: (val: string) => void;
};

/**
 * 復元およびマージの実行前に必要となる、DBデータの事前バックアップ保存、
 * および誤操作防止のための確認フレーズとTOTP再認証トークン入力を促すコンポーネント。
 */
const BackupConfirmSection = ({
  snapshotDownloaded,
  snapshot,
  confirmPhrase,
  totpToken,
  isPending,
  activePhrase,
  onDownloadSnapshot,
  onChangeConfirmPhrase,
  onChangeTotpToken
}: BackupConfirmSectionProps) => {
  const tAdmin = useTranslations("Admin");

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Alert severity="info">
        <AlertTitle>{tAdmin("backup.downloadCurrentData")}</AlertTitle>
        <Box sx={{ mb: 1 }}>{tAdmin("backup.downloadCurrentDataDesc")}</Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={onDownloadSnapshot}
          disabled={isPending || snapshotDownloaded}
        >
          {tAdmin("backup.downloadCurrentData")}
        </Button>
        {snapshot && snapshotDownloaded && (
          <Box sx={{ mt: 1, fontSize: "0.85em", wordBreak: "break-all" }}>
            {tAdmin("backup.currentDataSaved", { key: snapshot.key })}
          </Box>
        )}
      </Alert>

      <TextField
        label={tAdmin("backup.confirmPhraseLabel", { phrase: activePhrase })}
        size="small"
        value={confirmPhrase}
        onChange={(e) => onChangeConfirmPhrase(e.target.value)}
        disabled={isPending}
        autoComplete="off"
      />
      <TextField
        label={tAdmin("backup.totpLabel")}
        size="small"
        value={totpToken}
        onChange={(e) => onChangeTotpToken(e.target.value)}
        disabled={isPending}
        autoComplete="one-time-code"
        inputMode="numeric"
      />
    </Stack>
  );
};

export default BackupConfirmSection;
