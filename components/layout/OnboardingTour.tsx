"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MobileStepper from "@mui/material/MobileStepper";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import SearchIcon from "@mui/icons-material/Search";
import PublishIcon from "@mui/icons-material/Publish";
import LanguageIcon from "@mui/icons-material/Language";
import { useSession } from "next-auth/react";
import { completeOnboarding } from "@/lib/actions/settings";

export default function OnboardingTour() {
  const t = useTranslations("Onboarding");
  const { data: session, status, update } = useSession();
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const syncAttempted = useRef(false);

  // 未ログインユーザーには表示せず、アカウント単位で1回のみ表示する
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setOpen(false);
      return;
    }
    setOpen(!session.user.onboardingCompleted);
  }, [status, session]);

  const handleClose = async () => {
    setOpen(false);
    if (syncAttempted.current) return;

    syncAttempted.current = true;
    try {
      await completeOnboarding();
      await update();
    } catch (e) {
      console.error("Failed to update onboarding status:", e);
    }
  };

  const steps = [
    {
      title: t("step1.title"),
      content: t("step1.content"),
      icon: <SearchIcon sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />,
    },
    {
      title: t("step2.title"),
      content: t("step2.content"),
      icon: <PublishIcon sx={{ fontSize: 60, color: "secondary.main", mb: 2 }} />,
    },
    {
      title: t("step3.title"),
      content: t("step3.content"),
      icon: <LanguageIcon sx={{ fontSize: 60, color: "success.main", mb: 2 }} />,
    }
  ];

  const maxSteps = steps.length;

  const handleNext = () => {
    if (activeStep === maxSteps - 1) {
      handleClose();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: "center", fontWeight: "bold" }}>
        {steps[activeStep].title}
      </DialogTitle>
      <DialogContent sx={{ textAlign: "center", py: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {steps[activeStep].icon}
          <Typography variant="body1">
            {steps[activeStep].content}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, flexDirection: "column" }}>
        <MobileStepper
          variant="dots"
          steps={maxSteps}
          position="static"
          activeStep={activeStep}
          sx={{ width: "100%", bgcolor: "transparent" }}
          nextButton={
            <Button size="small" onClick={handleNext}>
              {activeStep === maxSteps - 1 ? t("finish") : t("next")}
              {activeStep !== maxSteps - 1 && <KeyboardArrowRight />}
            </Button>
          }
          backButton={
            <Button size="small" onClick={handleBack} disabled={activeStep === 0}>
              <KeyboardArrowLeft />
              {t("back")}
            </Button>
          }
        />
        <Button size="small" color="inherit" onClick={handleClose} sx={{ mt: 1 }}>
          {t("skip")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
