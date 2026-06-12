import { redirect } from "next/navigation";

// ルートは /ja にリダイレクト
export default function RootPage() {
  redirect("/ja");
}
