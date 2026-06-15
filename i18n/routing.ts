import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales:       ["ja", "en"],
  defaultLocale: "ja",
  localePrefix:  "never",
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
