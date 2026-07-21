"use client";

import { createIdeaComment } from "@/lib/actions/idea";
import { useTranslations } from "next-intl";
import CommentForm from "@/components/ui/CommentForm";

export default function IdeaCommentForm({ ideaId, commentsCount }: { ideaId: string; commentsCount: number }) {
  const tIdea = useTranslations("Idea");
  const tCommon = useTranslations("Common");

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
  };

  return (
    <CommentForm
      title={tIdea("comments", { count: commentsCount })}
      placeholder={tIdea("addCommentPlaceholder")}
      submitLabel={tCommon("submit")}
      onSubmit={handleSubmit}
    />
  );
}
