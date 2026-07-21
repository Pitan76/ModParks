"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useColorMode } from "@/components/ThemeRegistry";
import IdeaCard, { IdeaCardData } from "./IdeaCard";
import { useTranslations } from "next-intl";

interface IdeaCardListProps {
  ideas: IdeaCardData[];
}

export default function IdeaCardList({ ideas }: IdeaCardListProps) {
  const { isNewTheme } = useColorMode();
  const tIdea = useTranslations("Idea");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: isNewTheme ? 0 : 2 }}>
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} />
      ))}
      {ideas.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {tIdea("noIdeas")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tIdea("postFirstIdea")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
