import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import GitHubIcon from "@mui/icons-material/GitHub";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      id="app-footer"
      sx={{
        mt:         "auto",
        py:         4,
        background: "#0f172a",
        borderTop:  "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "center", md: "flex-start" },
          }}
        >
          {/* ブランド */}
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "primary.main", mb: 0.5 }}
            >
              ModParks
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Minecraft Java Edition向けMod・Pluginプラットフォーム
            </Typography>
          </Box>

          {/* リンク */}
          <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
            <Link
              href="https://github.com/ptms76/modparks"
              target="_blank"
              rel="noopener noreferrer"
              id="footer-github"
              sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <GitHubIcon fontSize="small" />
              GitHub
            </Link>
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography variant="caption" color="text.disabled" align="center" display="block">
          © {year} ModParks. MIT License.
        </Typography>
      </Container>
    </Box>
  );
}
