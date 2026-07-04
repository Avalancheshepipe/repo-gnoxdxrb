// Metro config for a monorepo-style layout: the Expo app lives in /mobile but
// shares types with the web app at the repo root. We watch the root and resolve
// modules from both node_modules folders.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Hugeicons (and other modern packages) ship per-icon entry points behind the
// `exports` field. Enable package exports so we can import a single icon
// (`@hugeicons/core-free-icons/Search01Icon`) instead of pulling the whole set.
config.resolver.unstable_enablePackageExports = true;

// Native build artifacts under node_modules are ephemeral and crash Metro on Windows.
config.resolver.blockList = [
  /.*[/\\]\.cxx[/\\].*/,
  /.*[/\\]android[/\\]build[/\\].*/,
  /.*[/\\]\.gradle[/\\].*/,
];

module.exports = config;
