"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import PlayCircleFilledIcon from "@mui/icons-material/PlayCircleFilled";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";
import type { ProjectMedia } from "@/db/schema";

interface ProjectMediaTabProps {
  media: ProjectMedia[];
}

const getYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const getNicoVideoId = (url: string): string | null => {
  const regExp = /^.*(nicovideo\.jp\/watch\/|nico\.ms\/)(sm\d+|so\d+|\d+).*/;
  const match = url.match(regExp);
  return match ? match[2] : null;
};

export default function ProjectMediaTab({ media }: ProjectMediaTabProps) {
  const [selectedItem, setSelectedItem] = useState<ProjectMedia | null>(null);

  const handleOpen = (item: ProjectMedia) => {
    setSelectedItem(item);
  };

  const handleClose = () => {
    setSelectedItem(null);
  };

  const selectedYtId = selectedItem ? getYouTubeId(selectedItem.url) : null;
  const selectedNicoId = selectedItem ? getNicoVideoId(selectedItem.url) : null;

  return (
    <Box sx={{ py: 2 }}>
      <Grid container spacing={2}>
        {media.map((item) => {
          const ytId = getYouTubeId(item.url);
          const nicoId = getNicoVideoId(item.url);
          const thumbnailUrl = ytId
            ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
            : item.url;

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
              <Card
                sx={{
                  position: "relative",
                  borderRadius: 2,
                  overflow: "hidden",
                  boxShadow: 2,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 4,
                  },
                }}
              >
                <CardActionArea onClick={() => handleOpen(item)}>
                  <Box sx={{ position: "relative", pt: "56.25%", bgcolor: "#1e1e1e" }}>
                    {nicoId ? (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          p: 2,
                        }}
                      >
                        <PlayCircleFilledIcon sx={{ fontSize: 50, color: "#fff", opacity: 0.8, mb: 0.5 }} />
                        <Typography variant="caption" sx={{ color: "#aaa", fontWeight: "bold", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                          NICONICO VIDEO
                        </Typography>
                      </Box>
                    ) : (
                      <CardMedia
                        component="img"
                        image={thumbnailUrl}
                        alt={item.caption || "Project media"}
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                    {ytId && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "rgba(0, 0, 0, 0.3)",
                        }}
                      >
                        <PlayCircleFilledIcon sx={{ fontSize: 60, color: "common.white", opacity: 0.9 }} />
                      </Box>
                    )}
                  </Box>
                  {item.caption && (
                    <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" noWrap color="text.secondary">
                        {item.caption}
                      </Typography>
                    </Box>
                  )}
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ライトボックスダイアログ */}
      <Dialog
        open={!!selectedItem}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "background.default",
              backgroundImage: "none",
              borderRadius: 2,
              overflow: "hidden",
              position: "relative",
            },
          },
        }}
      >
        {selectedItem && (
          <>
            <IconButton
              onClick={handleClose}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                color: "common.white",
                bgcolor: "rgba(0, 0, 0, 0.5)",
                "&:hover": { bgcolor: "rgba(0, 0, 0, 0.7)" },
                zIndex: 10,
              }}
            >
              <CloseIcon />
            </IconButton>
            <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", bgcolor: "#000" }}>
              {selectedYtId ? (
                <Box sx={{ width: "100%", aspectRatio: "16/9", maxHeight: "80vh" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedYtId}?autoplay=1`}
                    title={selectedItem.caption || "YouTube video"}
                    style={{ border: 0, width: "100%", height: "100%" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </Box>
              ) : selectedNicoId ? (
                <Box sx={{ width: "100%", aspectRatio: "16/9", maxHeight: "80vh" }}>
                  <iframe
                    src={`https://embed.nicovideo.jp/watch/${selectedNicoId}?autoplay=1`}
                    title={selectedItem.caption || "NicoNico video"}
                    style={{ border: 0, width: "100%", height: "100%" }}
                    allowFullScreen
                  />
                </Box>
              ) : (
                <Box
                  component="img"
                  src={selectedItem.url}
                  alt={selectedItem.caption || "Project media"}
                  sx={{
                    maxWidth: "100%",
                    width: "auto",
                    maxHeight: "80vh",
                    objectFit: "contain",
                    display: "block",
                    mx: "auto",
                  }}
                />
              )}
              {selectedItem.caption && (
                <Box sx={{ p: 2, bgcolor: "background.paper", color: "text.primary" }}>
                  <Typography variant="body1">{selectedItem.caption}</Typography>
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
