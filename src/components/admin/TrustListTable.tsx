"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useTranslations } from "next-intl";
import type { TrustListRow } from "@/lib/queries/adminTrust";
import { adjustTrustScores, recomputeTrustAction } from "@/lib/actions/adminTrust";
import { TIER_COLORS } from "./trustTierColors";

export type TrustListTableProps = {
  rows: TrustListRow[];
  locale: string;
};

/**
 * 信頼スコアの一覧テーブル（クライアントコンポーネント）
 * チェックボックスで複数ユーザーを選択し、一括でスコアを変更できる機能を持つ。
 * また、未計算のユーザーに対してはその場で初期スコアを計算できる「計算」ボタンを配置。
 */
export default function TrustListTable({ rows, locale }: TrustListTableProps) {
  const t = useTranslations("Admin");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        {t("trust.empty")}
      </Typography>
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(rows.map((r) => r.userId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, userId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleBulkSubmit = () => {
    setError(null);
    if (selectedIds.length === 0) {
      setError(t("trust.actions.noUsersSelected"));
      return;
    }
    const parsedDelta = Number(delta);
    if (isNaN(parsedDelta) || parsedDelta === 0) {
      setError(t("trust.actions.invalidDelta"));
      return;
    }
    if (!reason.trim()) {
      setError(t("trust.actions.reasonRequired"));
      return;
    }

    startTransition(async () => {
      const result = await adjustTrustScores(selectedIds, parsedDelta, reason);
      if ("error" in result) {
        setError(t(`trust.actions.${result.error}`));
      } else {
        setSelectedIds([]);
        setDelta("");
        setReason("");
      }
    });
  };

  const handleRecompute = (userId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await recomputeTrustAction(userId);
      if ("error" in result) {
        setError(t(`trust.actions.${result.error}`));
      }
    });
  };

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < rows.length;

  return (
    <Box>
      {/* 一括操作パネル */}
      {selectedIds.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "action.hover" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t("trust.actions.bulkAdjust.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            {t("trust.actions.bulkAdjust.hint")}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 150 }}>
              {t("trust.actions.bulkAdjust.selectedCount", { count: selectedIds.length })}
            </Typography>
            <TextField
              size="small"
              type="number"
              label={t("trust.actions.adjust.delta")}
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              sx={{ width: 150, bgcolor: "background.paper" }}
              disabled={pending}
            />
            <TextField
              size="small"
              label={t("trust.actions.reason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              sx={{ bgcolor: "background.paper" }}
              disabled={pending}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleBulkSubmit}
              disabled={pending}
              sx={{ whiteSpace: "nowrap" }}
            >
              {t("trust.actions.bulkAdjust.submit")}
            </Button>
          </Stack>
        </Paper>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={someSelected}
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                disabled={pending}
              />
            </TableCell>
            <TableCell>{t("trust.columns.user")}</TableCell>
            <TableCell align="right">{t("trust.columns.score")}</TableCell>
            <TableCell>{t("trust.columns.tier")}</TableCell>
            <TableCell>{t("trust.columns.state")}</TableCell>
            <TableCell>{t("trust.columns.computedAt")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const isSelected = selectedIds.includes(row.userId);
            return (
              <TableRow key={row.userId} hover selected={isSelected}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => handleSelectOne(row.userId, e.target.checked)}
                    disabled={pending}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/${locale}/admin/trust/${row.userId}`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                      {row.displayName ?? row.username ?? row.email ?? row.userId}
                    </Typography>
                    {(row.displayName || row.username) && (
                      <Typography variant="caption" color="text.secondary" component="div">
                        {row.username ? `@${row.username}` : ""} {row.userId ? `(${row.userId})` : ""}
                      </Typography>
                    )}
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
                  {row.computedAt ? (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(row.computedAt).toLocaleString(locale)}
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="caption" color="error">
                        {t("trust.notComputed")}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ py: 0, px: 1, minWidth: 0, fontSize: "0.75rem", textTransform: "none" }}
                        onClick={() => handleRecompute(row.userId)}
                        disabled={pending}
                      >
                        {t("trust.actions.recompute.submitShort")}
                      </Button>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
