import type { Analytics } from "./port";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export type Ga4 = Analytics & { consent(granted: boolean): void };

/** 13 months, in seconds: the longest life the CNIL accepts for an audience cookie. */
const cookieLife = 395 * 24 * 60 * 60;

export function ga4(id: string, host: Window = window): Ga4 {
  const doc = host.document;
  const layer = (host.dataLayer ??= []);
  // gtag.js acts on `arguments` objects only: it takes an array for a Tag Manager message.
  function gtag(..._command: unknown[]) {
    layer.push(arguments);
  }
  gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  gtag("js", new Date());
  gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: cookieLife });
  const script = doc.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  doc.head.append(script);
  return {
    track: ({ name, ...params }) => gtag("event", name, params),
    consent(granted) {
      // With storage denied alone, gtag.js still sends pings without cookies: the flag stops it for the page.
      Reflect.set(host, `ga-disable-${id}`, !granted);
      gtag("consent", "update", { analytics_storage: granted ? "granted" : "denied" });
      if (!granted) eraseCookies(doc, host.location.hostname);
    },
  };
}

function eraseCookies(doc: Document, hostname: string) {
  const names = doc.cookie.split(";").map((pair) => pair.split("=")[0]!.trim()).filter((name) => name.startsWith("_ga"));
  // gtag.js sets its cookies on the parent domain: a deletion without that domain leaves them.
  for (const name of names) for (const domain of ["", `; domain=${hostname}`]) doc.cookie = `${name}=; max-age=0; path=/${domain}`;
}
