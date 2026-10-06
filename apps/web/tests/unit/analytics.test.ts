import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4 } from "../../src/analytics/ga4";
import { track } from "../../src/analytics/port";

function fakeWindow(cookies: string[] = []) {
  const appended: { async?: boolean; src?: string }[] = [];
  const jar = new Map(cookies.map((name) => [name, "1"]));
  const written: string[] = [];
  const document = {
    head: { append: (element: { src?: string }) => appended.push(element) },
    createElement: () => ({}),
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(line: string) {
      written.push(line);
      if (line.includes("max-age=0")) jar.delete(line.split("=")[0]!);
    },
  };
  const host = { document, location: { hostname: "holy-pdf.com" } } as unknown as Window;
  return { host, appended, jar, written };
}

const commands = (host: Window) => host.dataLayer!.map((entry) => [...(entry as IArguments)]);

afterEach(() => {
  globalThis.holyPdfAnalytics = undefined;
});

describe("track", () => {
  it("does nothing while no measurement tool is plugged in", () => {
    expect(() => track({ name: "tool_done", tool: "merge" })).not.toThrow();
  });

  it("hands the measure to the plugged-in tool", () => {
    const seen = vi.fn();
    globalThis.holyPdfAnalytics = { track: seen };
    track({ name: "tool_done", tool: "compress" });
    expect(seen).toHaveBeenCalledWith({ name: "tool_done", tool: "compress" });
  });
});

describe("ga4", () => {
  it("queues gtag commands as arguments objects, consent first, ads off", () => {
    const { host } = fakeWindow();
    ga4("G-TEST1234", host);
    expect(host.dataLayer!.every((entry) => Object.prototype.toString.call(entry) === "[object Arguments]")).toBe(true);
    const [consent, js, config] = commands(host);
    expect(consent).toEqual(["consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]);
    expect(js?.[0]).toBe("js");
    expect(config).toEqual(["config", "G-TEST1234", { allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 395 * 24 * 60 * 60 }]);
  });

  it("loads gtag.js once, for its own measurement ID", () => {
    const { host, appended } = fakeWindow();
    ga4("G-TEST1234", host);
    expect(appended).toEqual([{ async: true, src: "https://www.googletagmanager.com/gtag/js?id=G-TEST1234" }]);
  });

  it("sends the tool's name and nothing else", () => {
    const { host } = fakeWindow();
    ga4("G-TEST1234", host).track({ name: "tool_done", tool: "split" });
    expect(commands(host).at(-1)).toEqual(["event", "tool_done", { tool: "split" }]);
  });

  it("stops and erases its cookies when the visitor withdraws, then starts again", () => {
    const { host, jar, written } = fakeWindow(["_ga", "_ga_TEST1234", "other"]);
    const tool = ga4("G-TEST1234", host);
    tool.consent(false);
    expect(Reflect.get(host, "ga-disable-G-TEST1234")).toBe(true);
    expect(commands(host).at(-1)).toEqual(["consent", "update", { analytics_storage: "denied" }]);
    expect([...jar.keys()]).toEqual(["other"]);
    expect(written).toContain("_ga=; max-age=0; path=/; domain=holy-pdf.com");
    tool.consent(true);
    expect(Reflect.get(host, "ga-disable-G-TEST1234")).toBe(false);
    expect(commands(host).at(-1)).toEqual(["consent", "update", { analytics_storage: "granted" }]);
  });
});
