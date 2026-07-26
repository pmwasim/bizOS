import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const standaloneWebRoot = resolve(webRoot, ".next/standalone/apps/web");

async function copyDirectory(source, destination) {
  try {
    if (!(await stat(source)).isDirectory()) {
      return;
    }
  } catch {
    return;
  }

  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

await copyDirectory(resolve(webRoot, ".next/static"), resolve(standaloneWebRoot, ".next/static"));
await copyDirectory(resolve(webRoot, "public"), resolve(standaloneWebRoot, "public"));
