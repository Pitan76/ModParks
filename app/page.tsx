import { redirect } from "next/navigation";

// ルートは /ja にリダイレクト
const RootPage = () => {
  redirect("/ja");
};

export default RootPage;
