import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getTranslations, getFormatter } from "next-intl/server";
import type { PointTransaction } from "@/db/schema";

/** ポイント取引の履歴。台帳は追記専用なので、行の編集・削除は用意しない */
export default async function PointHistoryTable({
  transactions,
}: {
  transactions: PointTransaction[];
}) {
  const t = await getTranslations("CreatorReward");
  const format = await getFormatter();

  if (transactions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("noTransactions")}
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t("txDate")}</TableCell>
            <TableCell>{t("txType")}</TableCell>
            <TableCell align="right">{t("txAmount")}</TableCell>
            <TableCell>{t("txReason")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{format.dateTime(tx.createdAt, "short")}</TableCell>
              <TableCell>{t(`txTypes.${tx.type}`)}</TableCell>
              <TableCell align="right" sx={{ color: tx.amount < 0 ? "error.main" : "success.main" }}>
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
              </TableCell>
              <TableCell>{tx.reason ?? tx.periodId ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
