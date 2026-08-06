"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";

/**
 * 新規プロジェクト作成への導線。
 * sm 以上ではラベル付きボタン、スマホでは幅を取らない正方形アイコンボタンにする。
 */
const NewProjectButton = () => {
  const t = useTranslations("Nav");

  return (
    <>
      <LinkButton
        href="/projects/new"
        id="nav-new-project-desktop"
        variant="contained"
        size="small"
        startIcon={<AddIcon />}
        sx={{ ml: 1, display: { xs: "none", sm: "flex" } }}
      >
        <Box component="span" sx={{ mt: "1px" }}>{t("newProject")}</Box>
      </LinkButton>

      <Box sx={{ display: { xs: "flex", sm: "none" }, ml: 0 }}>
        <Link
          href="/projects/new"
          prefetch={false}
          style={{ display: "flex", textDecoration: "none" }}
          id="nav-new-project-mobile"
        >
          <IconButton
            size="small"
            sx={{
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": { bgcolor: "primary.dark" },
              borderRadius: 1,
              p: "6px"
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Link>
      </Box>
    </>
  );
};

export default NewProjectButton;
