import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import type { TrustEventRow } from "@/lib/queries/adminTrust";
import TrustEventReverseButton from "./TrustEventReverseButton";

export type TrustEventTableProps = {
  events: TrustEventRow[];
  locale: string;
  userId: string;
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function deltaColor(value: number): "success.main" | "error.main" | "text.secondary" {
  if (value > 0) return "success.main";
  if (value < 0) return "error.main";
  return "text.secondary";
}

/**
 * 台帳。生の値と減衰後の寄与を併記することで、
 * 「なぜ今このスコアなのか」を画面だけで追えるようにする。
 */
export default async function TrustEventTable({ events, locale, userId }: TrustEventTableProps) {
  const t = await getTranslations("Admin");

  if (events.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        {t("trust.detail.empty")}
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t("trust.detail.columns.occurredAt")}</TableCell>
          <TableCell>{t("trust.detail.columns.kind")}</TableCell>
          <TableCell align="right">{t("trust.detail.columns.delta")}</TableCell>
          <TableCell align="right">{t("trust.detail.columns.effective")}</TableCell>
          <TableCell>{t("trust.detail.columns.subject")}</TableCell>
          <TableCell>{t("trust.detail.columns.reason")}</TableCell>
          <TableCell>{t("trust.detail.columns.actor")}</TableCell>
          <TableCell align="right" />
        </TableRow>
      </TableHead>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id} hover sx={{ opacity: event.reversed ? 0.5 : 1 }}>
            <TableCell>
              <Typography variant="caption" color="text.secondary">
                {event.occurredAt.toLocaleString(locale)}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{event.kind}</Typography>
              {event.reversed && (
                <Chip size="small" variant="outlined" label={t("trust.detail.reversed")} sx={{ ml: 1 }} />
              )}
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {signed(event.delta)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: deltaColor(event.effective) }}
              >
                {signed(event.effective)}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="caption" color="text.secondary">
                {event.subjectId ? `${event.subjectType}:${event.subjectId}` : "-"}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="caption">{event.reason ?? "-"}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="caption" color="text.secondary">{event.actorEmail ?? "-"}</Typography>
            </TableCell>
            <TableCell align="right">
              {/* 打ち消し行そのものと、既に無効化された行は却下できない */}
              {!event.reversed && event.kind !== "reversal" && (
                <TrustEventReverseButton userId={userId} eventId={event.id} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
