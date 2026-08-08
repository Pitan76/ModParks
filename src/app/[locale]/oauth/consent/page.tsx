import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import { getTranslations, setRequestLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { auth } from "@/lib/auth";
import { validateAuthorizeRequest } from "@/lib/oauth/authorizeRequest";
import { ConsentFormLazy } from "@/components/oauth/ConsentLazy";
import ConsentError from "@/components/oauth/ConsentError";

/** 認可フローの途中の画面なので検索結果には出さない */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** 受け取ったクエリをそのまま Server Action へ渡し、承認時に再検証する */
function toRawQuery(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params.toString();
}

export default async function OAuthConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = await searchParams;
  const rawQuery = toRawQuery(query);

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/api/oauth/authorize?${rawQuery}`)}`);

  const t = await getTranslations("OAuth");
  const validated = await validateAuthorizeRequest(new URLSearchParams(rawQuery));

  if (!validated.ok) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ConsentError title={t("consent.invalidTitle")} description={validated.failure.description} />
      </Container>
    );
  }

  const { client, scopes } = validated.value;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={{ OAuth: (messages as Record<string, unknown>).OAuth, Common: (messages as Record<string, unknown>).Common }}>
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ConsentFormLazy
          rawQuery={rawQuery}
          scopes={scopes}
          accountName={session.user.displayName ?? session.user.username ?? session.user.name ?? session.user.email ?? ""}
          client={{
            name: client.name,
            description: client.description,
            logoUrl: client.logoUrl,
            homepageUrl: client.homepageUrl,
            isTrusted: client.isTrusted,
          }}
        />
      </Container>
    </NextIntlClientProvider>
  );
}
