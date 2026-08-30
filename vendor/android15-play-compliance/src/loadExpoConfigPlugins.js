/**
 * Resolve expo/config-plugins from a consumer app.
 *
 * file: installs of this package symlink into node_modules, but Node resolves
 * modules from the realpath under mobile/shared/, which has no expo.
 */
const { createRequire } = require('module');
const path = require('path');

function loadExpoConfigPlugins(options = {}) {
  const cwd = options.cwd || process.cwd();
  const selfFilename = options.selfFilename || __filename;
  const requireImpl = options.requireImpl || require;
  const createRequireImpl = options.createRequireImpl || createRequire;

  const tried = [];
  const tryFrom = (filename) => {
    tried.push(filename);
    try {
      return createRequireImpl(filename)('expo/config-plugins');
    } catch {
      return null;
    }
  };

  const fromCwd = tryFrom(path.join(cwd, 'package.json'));
  if (fromCwd) return fromCwd;

  const fromSelf = tryFrom(selfFilename);
  if (fromSelf) return fromSelf;

  try {
    return requireImpl('expo/config-plugins');
  } catch (err) {
    const hint = tried.join(', ');
    err.message = `${err.message} (also tried createRequire from: ${hint})`;
    throw err;
  }
}

module.exports = { loadExpoConfigPlugins };
