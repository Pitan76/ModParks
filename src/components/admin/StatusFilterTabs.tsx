import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { Link } from "@/lib/i18n/routing";

export type StatusFilterOption = {
  value: string;
  label: string;
  count?: number;
};

type StatusFilterTabsProps = {
  basePath: string;
  options: StatusFilterOption[];
  active: string;
};

/**
 * 一覧のステータス絞り込み。
 * クエリ文字列にしておくと URL を共有でき、サーバー側で取得を切り替えられる。
 */
export default function StatusFilterTabs({ basePath, options, active }: StatusFilterTabsProps) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
      {options.map((option) => (
        <Link key={option.value} href={`${basePath}?status=${option.value}`} style={{ textDecoration: "none" }}>
          <Chip
            label={option.count === undefined ? option.label : `${option.label} (${option.count})`}
            color={option.value === active ? "primary" : "default"}
            variant={option.value === active ? "filled" : "outlined"}
            clickable
          />
        </Link>
      ))}
    </Box>
  );
}
