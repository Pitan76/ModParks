import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

/**
 * 認可リクエストが不正で、クライアントへ戻すこともできない場合の表示。
 */
export default function ConsentError({ title, description }: { title: string; description: string }) {
  return (
    <Alert severity="error">
      <AlertTitle>{title}</AlertTitle>
      {description}
    </Alert>
  );
}
