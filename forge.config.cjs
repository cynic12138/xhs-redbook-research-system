const excludedRoots = [
  ".git",
  ".env",
  ".env.local",
  ".playwright-cli",
  ".cache",
  ".vite",
  ".vite-temp",
  ".agents",
  ".gitignore",
  "AGENTS.md",
  "build",
  "coverage",
  "data",
  "design-system",
  "docs",
  "forge.config.cjs",
  "index.html",
  "out",
  "output",
  "README.md",
  "scripts",
  "src",
  "test",
  "tsconfig.json",
  "tsconfig.server.json",
  "vite.config.ts"
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const projectRootPattern = escapeRegExp(__dirname);
const electronChecksums = require("./node_modules/electron/checksums.json");

module.exports = {
  packagerConfig: {
    asar: true,
    download: {
      checksums: electronChecksums
    },
    ignore: excludedRoots.map((root) =>
      new RegExp(`^(?:${projectRootPattern})?[\\\\/]${escapeRegExp(root)}(?:[\\\\/]|$)`, "i")
    )
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "xiaohongshu-yunyingtai",
        setupExe: "小红书运营台-0.2.0-Setup.exe",
        noMsi: true
      }
    }
  ]
};
