import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const viteConfig = readFileSync(resolve("vite.config.ts"), "utf8");
const htmlInputs = [...viteConfig.matchAll(/`\$\{webRoot\}([^`]+\.html)`/g)].map((match) => match[1]);

describe("Google Tag Manager", () => {
  test("discovers every HTML build input", () => {
    expect(htmlInputs).not.toHaveLength(0);
  });

  test.each(htmlInputs)("is installed in %s", (relativePath) => {
    const html = readFileSync(resolve(relativePath), "utf8");
    const headEnd = html.indexOf("</head>");
    const bodyStart = html.indexOf("<body>");
    const appRoot = html.indexOf('<div id="root">');
    const script = html.indexOf("https://www.googletagmanager.com/gtm.js?id=");
    const noscript = html.indexOf("https://www.googletagmanager.com/ns.html?id=GTM-PH8JJ6QB");

    expect(script).toBeGreaterThan(html.indexOf("<head>"));
    expect(script).toBeLessThan(headEnd);
    expect(noscript).toBeGreaterThan(bodyStart);
    expect(noscript).toBeLessThan(appRoot);
    expect(html.match(/GTM-PH8JJ6QB/g)).toHaveLength(2);
  });
});
