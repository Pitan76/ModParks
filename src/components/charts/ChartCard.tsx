import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

/** グラフ 1 枚ぶんの枠。タイトルと余白をダッシュボード内で揃える */
export default function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: "1.05rem" }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
