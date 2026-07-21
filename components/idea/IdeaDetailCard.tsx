"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useColorMode } from "@/components/ThemeRegistry";

interface IdeaDetailCardProps {
  children: React.ReactNode;
}

export default function IdeaDetailCard({ children }: IdeaDetailCardProps) {
  const { isNewTheme } = useColorMode();

  return (
    <Card
      variant="outlined"
      sx={{
        boxShadow: "none",
        ...(isNewTheme ? {
          border: "none",
          borderRadius: 0,
          background: "transparent",
          mb: 2,
        } : {
          borderRadius: 3,
          mb: 4,
        })
      }}
    >
      <CardContent 
        sx={{ 
          p: isNewTheme ? { xs: 2, md: 3 } : { xs: 3, md: 5 },
          "&:last-child": { pb: isNewTheme ? { xs: 2, md: 3 } : undefined }
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}
