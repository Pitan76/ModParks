import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import type { UsageDaily } from "@/db/schema";

interface UsageHistoryTableProps {
  /** 古い順の日次行 */
  history: UsageDaily[];
}

/** epoch day を UTC の ISO 日付へ戻す */
function formatDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** 未取得（null）と 0 を見分けられるように表示を分ける */
function formatCount(value: number | null): string {
  return value === null ? "-" : value.toLocaleString();
}

/**
 * 日次推移の一覧。
 *
 * リクエスト数は実測値を主にし、内部集計は参考値として末尾に置く。
 * 両者を同じ重みで並べると、桁違いの値が並んで判断を誤らせる。
 *
 * ダウンロードは「到達数」と「計上数」を並べる。
 * 差が開いたら Bot 除外や防護中除外が効いているサインになる。
 */
export default function UsageHistoryTable({ history }: UsageHistoryTableProps) {
  const t = useTranslations("Admin.usage");

  if (history.length === 0) {
    return <Typography variant="body2" color="text.secondary">{t("noData")}</Typography>;
  }

  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t("date")}</TableCell>
            <TableCell align="right">{t("requests")}</TableCell>
            <TableCell align="right">{t("ownRequests")}</TableCell>
            <TableCell align="right">{t("downloads")}</TableCell>
            <TableCell align="right">{t("downloadsCounted")}</TableCell>
            <TableCell align="right">{t("botRequests")}</TableCell>
            <TableCell align="right">{t("botDownloads")}</TableCell>
            <TableCell align="right">{t("sampledRequests")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {[...history].reverse().map((row) => (
            <TableRow key={row.date} hover>
              <TableCell>{formatDay(row.date)}</TableCell>
              <TableCell align="right">{formatCount(row.cfRequests)}</TableCell>
              <TableCell align="right">{formatCount(row.cfRequestsOwn)}</TableCell>
              <TableCell align="right">{row.downloads.toLocaleString()}</TableCell>
              <TableCell align="right">{row.downloadsCounted.toLocaleString()}</TableCell>
              <TableCell align="right">{row.botRequests.toLocaleString()}</TableCell>
              <TableCell align="right">{row.botDownloads.toLocaleString()}</TableCell>
              <TableCell align="right">{row.requests.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
