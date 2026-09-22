"use client";

import { createIdeaComment } from "@/lib/http/ideaApi";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import CommentForm from "@/components/ui/CommentForm";

export default function IdeaCommentForm({ ideaId, commentsCount, defaultCommentBodyFormat }: { ideaId: string; commentsCount: number; defaultCommentBodyFormat?: string }) {
  const tComment = useTranslations("Comment");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const handleSubmit = async (content: string, format: string) => {
    const formData = new FormData();
    formData.append("content", content);
    formData.append("contentFormat", format);

    const res = await createIdeaComment(ideaId, formData);
    if (res?.error) {
      const errMsg = "server" in res.error ? res.error.server?.[0] : undefined;
      alert(errMsg || tCommon("error"));
      return false;
    }
    // Server Action のときは、中の auth() が Cookie を書き直すことで Next が画面を
    // 自動で再取得しており、投稿したコメントがそれで一覧に出ていた。fetch では
    // 起きないので自分で取り直す
    router.refresh();
  };

  return (
    <CommentForm
      title={tComment("titleWithCount", { count: commentsCount })}
      placeholder={tComment("ideaPlaceholder")}
      submitLabel={tComment("submit")}
      initialFormat={defaultCommentBodyFormat}
      onSubmit={handleSubmit}
    />
  );
}
