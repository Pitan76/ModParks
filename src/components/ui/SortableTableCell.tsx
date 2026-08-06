"use client";

import TableCell from "@mui/material/TableCell";
import type { TableCellProps } from "@mui/material/TableCell";
import TableSortLabel from "@mui/material/TableSortLabel";
import type { SortOrder } from "@/lib/hooks/useTableSort";

type Props<K extends string> = Omit<TableCellProps, "onClick"> & {
  columnKey: K;
  activeKey: string | null;
  order: SortOrder;
  onSort: (key: K) => void;
};

/**
 * クリックで並び替えできるテーブルヘッダセル。
 * useTableSortのstate(activeKey/order/handleSort)と組み合わせて使う。
 */
export default function SortableTableCell<K extends string>({ columnKey, activeKey, order, onSort, children, ...rest }: Props<K>) {
  const active = activeKey === columnKey;
  return (
    <TableCell {...rest} sortDirection={active ? order : false}>
      <TableSortLabel active={active} direction={active ? order : "asc"} onClick={() => onSort(columnKey)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );
}
