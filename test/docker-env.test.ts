import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const source = sourceFiles(join(root, "src"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const readByApp = (name: string) => source.includes(`process.env.${name}`);

describe("container configuration", () => {
  for (const file of ["Dockerfile", "docker-compose.yml", "docs/self-hosting.md"]) {
    it(`${file} only references NEXT_PUBLIC_ variables the app reads`, () => {
      const names = new Set(
        readFileSync(join(root, file), "utf8").match(/NEXT_PUBLIC_[A-Z0-9_]+/g)
      );
      expect(names.size).toBeGreaterThan(0);
      // Set by the build/CI rather than read from the environment by name.
      const unread = [...names].filter((n) => !readByApp(n));
      expect(unread).toEqual([]);
    });
  }

  it("configures the contract and site URLs under the names the app reads", () => {
    const docker = readFileSync(join(root, "Dockerfile"), "utf8");
    for (const name of [
      "NEXT_PUBLIC_CONTRACT_ID",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_APP_ORIGIN",
    ]) {
      expect(docker).toContain(`ARG ${name}`);
    }
  });

  it("does not default the browser bundle to a localhost backend", () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf8");
    expect(compose).not.toMatch(/NEXT_PUBLIC_BACKEND_URL[^\n]*localhost/);
  });
});
