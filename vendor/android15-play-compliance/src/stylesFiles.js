/**
 * Filesystem helpers for styles.xml under android res/values*.
 */
const fs = require('fs');
const path = require('path');
const { stripDeprecatedEdgeToEdgeItems } = require('./stylesXml');

/**
 * @param {string} resRoot  e.g. .../app/src/main/res
 * @returns {string[]} absolute paths to styles.xml under values*
 */
function findStylesXmlPaths(resRoot) {
  if (!fs.existsSync(resRoot)) return [];
  const out = [];
  for (const ent of fs.readdirSync(resRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || !/^values(-|$)/.test(ent.name)) continue;
    const stylesPath = path.join(resRoot, ent.name, 'styles.xml');
    if (fs.existsSync(stylesPath)) out.push(stylesPath);
  }
  return out;
}

/**
 * Strip deprecated edge-to-edge bar color items from a styles.xml file.
 * @returns {boolean} true when the file was modified
 */
function stripStylesFile(stylesPath) {
  if (!fs.existsSync(stylesPath)) return false;
  let xml = fs.readFileSync(stylesPath, 'utf8');
  const before = xml;
  xml = stripDeprecatedEdgeToEdgeItems(xml);
  if (xml !== before) {
    fs.writeFileSync(stylesPath, xml);
    return true;
  }
  return false;
}

module.exports = {
  findStylesXmlPaths,
  stripStylesFile,
};
