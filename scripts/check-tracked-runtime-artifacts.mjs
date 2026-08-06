import { execFileSync } from "node:child_process";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const forbiddenFiles = trackedFiles.filter((path) => path.startsWith("apps/api/.data/"));

if (forbiddenFiles.length > 0) {
  console.error("Runtime object-store files are tracked by Git:");
  for (const path of forbiddenFiles) {
    console.error(`- ${path}`);
  }
  console.error("Remove these files from Git and keep apps/api/.data/ ignored.");
  process.exitCode = 1;
} else {
  console.log("Tracked runtime artifact check passed.");
}
