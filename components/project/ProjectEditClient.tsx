"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import TabbedPanel from "@/components/ui/TabbedPanel";

export interface ProjectEditClientProps {
  isOwner: boolean;
  basicInfoForm: React.ReactNode;
  versionsManager: React.ReactNode;
  membersManager: React.ReactNode;
  dependenciesManager: React.ReactNode;
  ownershipTransfer?: React.ReactNode;
}

export default function ProjectEditClient({
  isOwner,
  basicInfoForm,
  versionsManager,
  membersManager,
  dependenciesManager,
  ownershipTransfer
}: ProjectEditClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabQuery = searchParams?.get("tab");

  const tabs = [
    { id: "info", label: "基本情報", content: basicInfoForm },
    { id: "files", label: "ファイル管理", content: versionsManager },
    { id: "members", label: "メンバー管理", content: membersManager },
    { id: "dependencies", label: "依存関係", content: dependenciesManager },
    { id: "ownership", label: "権限移譲", content: ownershipTransfer, hidden: !isOwner },
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
}
