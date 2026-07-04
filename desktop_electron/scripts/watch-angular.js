const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");

const angularDist = path.resolve(__dirname, "../../client/dist/client");
const rendererDir = path.resolve(__dirname, "../renderer");

let electronProcess = null;
let electronStarted = false;
let syncTimeout = null;

async function syncFiles() {
  try {
    if (await fs.pathExists(angularDist)) {
      await fs.emptyDir(rendererDir);
      await fs.copy(angularDist, rendererDir);
      console.log("✅ Angular dist synchronisé dans Electron");
    }
  } catch (err) {
    console.error("❌ Erreur de synchronisation :", err.message);
  }
}

function startElectron() {
  if (electronStarted) return;
  electronStarted = true;
  console.log("🚀 Lancement de Electron...");
  electronProcess = spawn("npx", ["electron", "."], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });
  electronProcess.on("close", () => {
    process.exit();
  });
}

function onBuildComplete() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    await syncFiles();
    startElectron();
  }, 500);
}

const ngBuild = spawn("npx", ["ng", "build", "--configuration", "development", "--base-href", "./", "--deploy-url", "./", "--watch"], {
  cwd: path.resolve(__dirname, "../../client"),
  stdio: "pipe",
  shell: true,
});

ngBuild.stdout.on("data", (data) => {
  const output = data.toString();
  process.stdout.write(output);
  if (output.includes("Build at:") || output.includes("complete")) {
    onBuildComplete();
  }
});

ngBuild.stderr.on("data", (data) => {
  process.stderr.write(data.toString());
});

ngBuild.on("close", (code) => {
  console.log(`ng build --watch terminé avec le code ${code}`);
  if (electronProcess) electronProcess.kill();
  process.exit(code);
});

process.on("SIGINT", () => {
  ngBuild.kill();
  if (electronProcess) electronProcess.kill();
  process.exit();
});
