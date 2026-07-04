const path = require("path");
const fs = require("fs-extra");

async function main() {
  const angularDist = path.resolve(
    __dirname,
    "../../client/dist/client"
  );

  const rendererDir = path.resolve(
    __dirname,
    "../renderer"
  );

  if (!(await fs.pathExists(angularDist))) {
    console.error("❌ Angular dist introuvable :", angularDist);
    process.exit(1);
  }

  await fs.emptyDir(rendererDir);
  await fs.copy(angularDist, rendererDir);

  console.log("✅ Angular dist copié dans Electron");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
