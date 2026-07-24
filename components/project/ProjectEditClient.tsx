"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import TabbedPanel from "@/components/ui/TabbedPanel";
import type { ReactNode } from "react";

export type ProjectEditClientProps = {
  isOwner: boolean;
  basicInfoForm: ReactNode;
  versionsManager: ReactNode;
  mediaManager: ReactNode;
  membersManager: ReactNode;
  dependenciesManager: ReactNode;
  ownershipTransfer?: ReactNode;
};

/** プロジェクト編集画面のタブ切り替えを管理するクライアントコンポーネント */
const ProjectEditClient = ({
  isOwner,
  basicInfoForm,
  versionsManager,
  mediaManager,
  membersManager,
  dependenciesManager,
  ownershipTransfer
}: ProjectEditClientProps) => {
  const tProject = useTranslations("Project");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabQuery = searchParams?.get("tab");

  const tabs = [
    { id: "info", label: tProject("editTabs.info"), content: basicInfoForm },
    { id: "files", label: tProject("editTabs.files"), content: versionsManager },
    { id: "media", label: tProject("editTabs.media"), content: mediaManager },
    { id: "members", label: tProject("editTabs.members"), content: membersManager },
    { id: "dependencies", label: tProject("editTabs.dependencies"), content: dependenciesManager },
    { id: "ownership", label: tProject("editTabs.ownership"), content: ownershipTransfer, hidden: !isOwner },
  ];

  const visibleTabs = tabs.filter(t => !t.hidden);
  const initialIndex = visibleTabs.findIndex(t => t.id === tabQuery);
  const activeIndex = initialIndex !== -1 ? initialIndex : 0;

  const handleTabChange = (newValue: number) => {
    const selectedTab = visibleTabs[newValue];
    if (selectedTab && selectedTab.id) {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", selectedTab.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  return <TabbedPanel items={tabs} value={activeIndex} onChange={handleTabChange} />;
};

export default ProjectEditClient;
