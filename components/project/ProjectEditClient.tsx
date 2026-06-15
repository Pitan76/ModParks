"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

export interface ProjectEditClientProps {
  isOwner: boolean;
  basicInfoForm: React.ReactNode;
  versionsManager: React.ReactNode;
  membersManager: React.ReactNode;
  ownershipTransfer?: React.ReactNode;
}

export default function ProjectEditClient({
  isOwner,
  basicInfoForm,
  versionsManager,
  membersManager,
  ownershipTransfer
}: ProjectEditClientProps) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
        <Tabs 
          value={tab} 
          onChange={(_, newValue) => setTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="基本情報" />
          <Tab label="ファイル管理" />
          <Tab label="メンバー管理" />
          {isOwner && <Tab label="権限移譲" />}
        </Tabs>
      </Box>

      {tab === 0 && (
        <Box>
          {basicInfoForm}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          {versionsManager}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          {membersManager}
        </Box>
      )}

      {tab === 3 && isOwner && (
        <Box>
          {ownershipTransfer}
        </Box>
      )}
    </Box>
  );
}
