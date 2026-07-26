"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import TabbedPanel from "@/components/ui/TabbedPanel";
import { type ReactNode, useTransition, useState, useEffect } from "react";
import Box from "@mui/material/Box";

import dynamic from "next/dynamic";
import CircularProgress from "@mui/material/CircularProgress";

export type ProjectEditClientProps = {
  isOwner: boolean;
  basicInfoForm: ReactNode;
  versionsManager: ReactNode;
  mediaManager: ReactNode;
  membersManager: ReactNode;
  dependenciesManager: ReactNode;
  ownershipTransfer?: ReactNode;
  projectId: string;
  projectSlug: string;
  recipeNamespaces?: string[] | null;
  locale: string;
};



const ProjectRecipesManager = dynamic(() => import("@/components/project/ProjectRecipesManager"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
      <CircularProgress />
    </Box>
  ),
});

/** プロジェクト編集画面のタブ切り替えを管理するクライアントコンポーネント */
const ProjectEditClient = ({
  isOwner,
  basicInfoForm,
  versionsManager,
  mediaManager,
  membersManager,
  dependenciesManager,
  ownershipTransfer,
  projectId,
  projectSlug,
  recipeNamespaces,
  locale
}: ProjectEditClientProps) => {
  const tProject = useTranslations("Project");
  const [isPending, startTransition] = useTransition();
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
    {
      id: "recipes",
      label: tProject("editTabs.recipes"),
      content: (
        <ProjectRecipesManager
          projectId={projectId}
          projectSlug={projectSlug}
          recipeNamespaces={recipeNamespaces}
          locale={locale}
        />
      ),
    },
    { id: "ownership", label: tProject("editTabs.ownership"), content: ownershipTransfer, hidden: !isOwner },
  ];

  const visibleTabs = tabs.filter(t => !t.hidden);
  const initialIndex = visibleTabs.findIndex(t => t.id === tabQuery);
  const targetIndex = initialIndex !== -1 ? initialIndex : 0;

  // タブのインジケーター（見た目）を即座に動かすためのローカルステート
  const [localActiveIndex, setLocalActiveIndex] = useState(targetIndex);

  // URLのクエリパラメータ変更とローカル表示状態の同期
  useEffect(() => {
    setLocalActiveIndex(targetIndex);
  }, [targetIndex]);

  const handleTabChange = (newValue: number) => {
    setLocalActiveIndex(newValue);

    const selectedTab = visibleTabs[newValue];
    if (selectedTab && selectedTab.id) {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", selectedTab.id);
      
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }
  };

  return (
    <Box sx={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s", pointerEvents: isPending ? "none" : "auto" }}>
      <TabbedPanel items={visibleTabs} value={localActiveIndex} onChange={handleTabChange} />
    </Box>
  );
};

export default ProjectEditClient;
