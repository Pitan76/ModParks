"use client";

import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";
import { tableContainerSx, tableHeadSx, tableRootSx, TABLE_MIN_WIDTH } from "@/components/ui/tableStyles";
import { AUDIT_PAGE_SIZE, type AuditLogPage } from "./useAuditLogPage";

export type AuditLogTableProps<T extends { id: string }> = {
  state: AuditLogPage<T>;
  /** 展開用の空カラムを除いた見出し。左端の空セルは常に付く */
  headers: string[];
  emptyLabel: string;
  renderRow: (log: T) => React.ReactNode;
};

/**
 * 監査ログ一覧の表とページネーション。
 * 列の見出しと行の描画だけが種類ごとに違うので、その2つを受け取る形にしている。
 */
const AuditLogTable = <T extends { id: string }>({
  state,
  headers,
  emptyLabel,
  renderRow,
}: AuditLogTableProps<T>) => {
  const { logs, loading, total, page, onPageChange } = state;

  return (
    <Box sx={{ position: "relative" }}>
      {loading && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      <TableContainer component={Paper} sx={[tableContainerSx, { opacity: loading ? 0.6 : 1 }]}>
        <Table sx={[tableRootSx, { minWidth: TABLE_MIN_WIDTH }]}>
          <TableHead sx={tableHeadSx}>
            <TableRow>
              <TableCell />
              {headers.map((header) => (
                <TableCell key={header}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length + 1} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              logs.map(renderRow)
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {total > AUDIT_PAGE_SIZE && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={Math.ceil(total / AUDIT_PAGE_SIZE)}
            page={page}
            onChange={onPageChange}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default AuditLogTable;
