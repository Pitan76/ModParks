import { getRequestConfig } from "next-intl/server";
import { routing, localeToFileMap, AppLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as AppLocale)) {
    locale = routing.defaultLocale;
  }

  const messageFile = localeToFileMap[locale as AppLocale] || locale;

  return {
    locale,
    messages: (await import(`../messages/${messageFile}.json`)).default,
  };
});
