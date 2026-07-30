import { redirect } from "next/navigation";

/** 設定のトップは最初のセクションへ送る。セクションの選択はサイドバーが担う */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/settings/profile`);
}
