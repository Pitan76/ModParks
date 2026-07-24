import { getTranslations } from "next-intl/server";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IdeaCommentForm from "@/components/idea/IdeaCommentForm";
import IdeaCommentItem from "@/components/idea/IdeaCommentItem";
import type { IdeaDetail } from "./ideaDetailData";

type Props = {
  ideaId: string;
  comments: IdeaDetail["comments"];
  currentUserId?: string;
  isLoggedIn: boolean;
  canManage: boolean;
};

export default async function IdeaComments({ ideaId, comments, currentUserId, isLoggedIn, canManage }: Props) {
  const tComment = await getTranslations("Comment");

  return (
    <Box>
      {isLoggedIn ? (
        <Box sx={{ mb: 4 }}>
          <IdeaCommentForm ideaId={ideaId} commentsCount={comments.length} />
        </Box>
      ) : (
        <>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
            {tComment("titleWithCount", { count: comments.length })}
          </Typography>
          <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider", mb: 4 }}>
            <Typography color="text.secondary">{tComment("loginPrompt")}</Typography>
          </Box>
        </>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {comments
          .filter((c) => !c.parentId)
          .map((comment) => {
            const isCommentAuthor = currentUserId === comment.authorId;
            return (
              <IdeaCommentItem
                key={comment.id}
                id={comment.id}
                ideaId={ideaId}
                content={comment.content}
                contentFormat={comment.contentFormat}
                createdAt={comment.createdAt}
                updatedAt={comment.updatedAt}
                authorName={comment.authorName}
                authorAvatar={comment.authorAvatar}
                authorUsername={comment.authorUsername}
                canEdit={isCommentAuthor}
                canDelete={isCommentAuthor || canManage}
                isLoggedIn={isLoggedIn}
                replies={comments
                  .filter((r) => r.parentId === comment.id)
                  .map((r) => ({
                    id: r.id,
                    content: r.content,
                    contentFormat: r.contentFormat,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                    authorName: r.authorName,
                    authorAvatar: r.authorAvatar,
                    authorUsername: r.authorUsername,
                    canEdit: currentUserId === r.authorId,
                    canDelete: currentUserId === r.authorId || canManage,
                  }))}
              />
            );
          })}
        {comments.length === 0 && <Typography color="text.secondary">{tComment("empty")}</Typography>}
      </Box>
    </Box>
  );
}
