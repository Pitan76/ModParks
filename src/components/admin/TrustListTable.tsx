import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import type { TrustListRow } from "@/lib/queries/adminTrust";
import { TIER_COLORS } from "./trustTierColors";

export type TrustListTableProps = {
  rows: TrustListRow[];
  locale: string;
};

/** 一覧。対処が要るのはスコアの低い側なので、昇順で並んだものをそのまま出す */
export default async function TrustListTable({ rows, locale }: TrustListTableProps) {
  const t = await getTranslations("Admin");

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        {t("trust.empty")}
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t("trust.columns.user")}</TableCell>
          <TableCell align="right">{t("trust.columns.score")}</TableCell>
          <TableCell>{t("trust.columns.tier")}</TableCell>
          <TableCell>{t("trust.columns.state")}</TableCell>
          <TableCell>{t("trust.columns.computedAt")}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId} hover>
            <TableCell>
              <Link href={`/${locale}/admin/trust/${row.userId}`} style={{ textDecoration: "none" }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                  {row.username ?? row.email ?? row.userId}
                </Typography>
              </Link>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {row.score}
              </Typography>
            </TableCell>
            <TableCell>
              <Chip size="small" label={t(`trust.filters.${row.tier}`)} color={TIER_COLORS[row.tier]} />
            </TableCell>
            <TableCell>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {row.frozen && <Chip size="small" variant="outlined" label={t("trust.frozen")} />}
                {row.overridden && (
                  <Chip size="small" variant="outlined" color="warning" label={t("trust.overridden")} />
                )}
              </Box>
            </TableCell>
            <TableCell>
              <Typography variant="caption" color="text.secondary">
                {row.computedAt ? row.computedAt.toLocaleString(locale) : t("trust.notComputed")}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
