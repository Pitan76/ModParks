"use client";

import TabbedPanel from "@/components/ui/TabbedPanel";

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
  const tabs = [
    { label: "基本情報", content: basicInfoForm },
    { label: "ファイル管理", content: versionsManager },
    { label: "メンバー管理", content: membersManager },
    { label: "権限移譲", content: ownershipTransfer, hidden: !isOwner },
  ];

  return <TabbedPanel items={tabs} />;
}
