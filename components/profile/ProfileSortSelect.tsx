"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FormSelect from "@/components/ui/form/FormSelect";
import { useTranslations } from "next-intl";

export default function ProfileSortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Search.sort");
  
  const sort = searchParams?.get("sort") || "updated";

  const handleChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("sort", newSort);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <FormSelect
      size="small"
      label={t("label")}
      value={sort}
      onChange={(e) => handleChange(e.target.value as string)}
      options={[
        { value: "updated", label: t("updated") },
        { value: "downloads", label: t("downloads") },
        { value: "newest", label: t("newest") },
      ]}
      formControlProps={{ sx: { minWidth: 140 } }}
    />
  );
}
