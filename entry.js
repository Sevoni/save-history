const pluginModule = require("./main");

/**
 * Obsidian expects module.exports to be the plugin constructor.
 * Depending on bundling style, the constructor may be in:
 * - pluginModule.default
 * - pluginModule.SaveHistoryPlugin
 * - pluginModule itself
 */
const ctor =
  pluginModule?.default ??
  pluginModule?.SaveHistoryPlugin ??
  pluginModule;

module.exports = ctor;
