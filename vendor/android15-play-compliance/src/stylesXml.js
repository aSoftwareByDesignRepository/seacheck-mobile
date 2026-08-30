/**
 * Pure styles.xml helpers for Android 15 edge-to-edge Play findings.
 */

const DEPRECATED_BAR_ITEM =
  /\s*<item\s+name="android:(?:statusBarColor|navigationBarColor|windowOptOutEdgeToEdgeEnforcement)"\s*>[^<]*<\/item>/g;

function hasDeprecatedEdgeToEdgeItems(xml) {
  return /<item\s+name="android:(?:statusBarColor|navigationBarColor)"\s*>/.test(String(xml));
}

function stripDeprecatedEdgeToEdgeItems(xml) {
  return String(xml).replace(DEPRECATED_BAR_ITEM, '');
}

module.exports = {
  hasDeprecatedEdgeToEdgeItems,
  stripDeprecatedEdgeToEdgeItems,
  DEPRECATED_BAR_ITEM,
};
