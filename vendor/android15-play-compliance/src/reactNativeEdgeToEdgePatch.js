/**
 * Strip Play-flagged Android 15 deprecated Window APIs from React Native sources.
 *
 * Play Console lists call sites in StatusBarModule + WindowUtilKt.enableEdgeToEdge.
 * App styles.xml stripping is necessary but not sufficient — RN framework bytecode
 * still references setStatusBarColor / getStatusBarColor and deprecated cutout modes.
 *
 * Marker comments keep the transform idempotent across npm install cycles.
 */

const MARKER = 'CHECK-ANDROID15-EDGE-PATCH';

function alreadyPatched(src) {
  return src.includes(MARKER);
}

/**
 * Replace a Kotlin function body starting at `signature` through its matching close brace.
 * @param {string} src
 * @param {RegExp} signatureRe must match start of the function (including modifiers)
 * @param {string} replacement full function text (no trailing requirement)
 */
function replaceKotlinFunction(src, signatureRe, replacement) {
  const m = signatureRe.exec(src);
  if (!m) return null;
  const start = m.index;
  let i = m.index + m[0].length;
  // Find opening brace of the function
  while (i < src.length && src[i] !== '{') i += 1;
  if (i >= src.length) return null;
  let depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const end = i + 1;
        return src.slice(0, start) + replacement + src.slice(end);
      }
    }
  }
  return null;
}

/**
 * @param {string} src WindowUtil.kt contents
 * @returns {{ text: string, changed: boolean }}
 */
function patchWindowUtilKt(src) {
  if (alreadyPatched(src)) {
    return { text: src, changed: false };
  }

  let text = src;

  const hideRepl = `// ${MARKER}: statusBarHide without deprecated cutout modes / FLAG_FULLSCREEN
private fun Window.statusBarHide() {
  WindowInsetsControllerCompat(this, decorView).run {
    systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    hide(WindowInsetsCompat.Type.statusBars())
  }
}`;
  const showRepl = `// ${MARKER}: statusBarShow without deprecated cutout modes / FLAG_FULLSCREEN
private fun Window.statusBarShow() {
  WindowInsetsControllerCompat(this, decorView).run {
    systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    show(WindowInsetsCompat.Type.statusBars())
  }
}`;
  const edgeRepl = `// ${MARKER}: enableEdgeToEdge without Window bar colors or DEFAULT/SHORT_EDGES cutout modes
internal fun Window.enableEdgeToEdge() {
  WindowCompat.setDecorFitsSystemWindows(this, false)

  val isDarkMode = UiModeUtils.isDarkMode(context)

  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    isStatusBarContrastEnforced = false
    isNavigationBarContrastEnforced = true
  }

  WindowInsetsControllerCompat(this, decorView).run {
    isAppearanceLightNavigationBars = !isDarkMode
  }

  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
    attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
  }
}`;

  const hideNext = replaceKotlinFunction(
    text,
    /@Suppress\("DEPRECATION"\)\s*\nprivate fun Window\.statusBarHide\s*\(/,
    hideRepl,
  );
  if (!hideNext) {
    throw new Error('WindowUtil.kt: statusBarHide not found (RN version mismatch?)');
  }
  text = hideNext;

  const showNext = replaceKotlinFunction(
    text,
    /@Suppress\("DEPRECATION"\)\s*\nprivate fun Window\.statusBarShow\s*\(/,
    showRepl,
  );
  if (!showNext) {
    throw new Error('WindowUtil.kt: statusBarShow not found (RN version mismatch?)');
  }
  text = showNext;

  const edgeNext = replaceKotlinFunction(
    text,
    /@Suppress\("DEPRECATION"\)\s*\ninternal fun Window\.enableEdgeToEdge\s*\(/,
    edgeRepl,
  );
  if (!edgeNext) {
    throw new Error('WindowUtil.kt: enableEdgeToEdge not found (RN version mismatch?)');
  }
  text = edgeNext;

  // Drop unused scrim color constants (only referenced by removed bar color setters).
  text = text.replace(
    /\/\/ The light scrim color[\s\S]*?internal val DarkNavigationBarColor = Color\.argb\([^)]+\)\n+/,
    `// ${MARKER}: scrim color constants removed (were only used by deprecated bar color setters)\n\n`,
  );
  text = text.replace(
    /internal val LightNavigationBarColor = Color\.argb\([^)]+\)\n(?:\/\/[^\n]*\n)*internal val DarkNavigationBarColor = Color\.argb\([^)]+\)\n+/,
    `// ${MARKER}: scrim color constants removed (were only used by deprecated bar color setters)\n\n`,
  );
  text = text.replace(/\nimport android\.graphics\.Color\n/, '\n');

  const banned = [
    '.statusBarColor',
    '.navigationBarColor',
    'LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT',
    'LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES',
    'LightNavigationBarColor',
    'DarkNavigationBarColor',
  ];
  for (const token of banned) {
    if (text.includes(token)) {
      throw new Error(`WindowUtil.kt still references banned token after patch: ${token}`);
    }
  }

  return { text, changed: true };
}

/**
 * @param {string} src StatusBarModule.kt contents
 * @returns {{ text: string, changed: boolean }}
 */
function patchStatusBarModuleKt(src) {
  if (alreadyPatched(src)) {
    return { text: src, changed: false };
  }

  let text = src;

  const constantsRepl = `// ${MARKER}: do not read Window.getStatusBarColor (deprecated on API 35+; Play flags it)
  override fun getTypedExportedConstants(): Map<String, Any> {
    val currentActivity = reactApplicationContext.currentActivity
    return mapOf(
        HEIGHT_KEY to PixelUtil.toDIPFromPixel(getStatusBarHeightPx(currentActivity).toFloat()),
        DEFAULT_BACKGROUND_COLOR_KEY to "transparent",
    )
  }`;

  const setColorRepl = `// ${MARKER}: no-op — Window.setStatusBarColor is deprecated/no-effect under edge-to-edge
  override fun setColor(colorDouble: Double, animated: Boolean) {
    // Intentionally empty: avoid emitting deprecated Window bar-color setters in bytecode.
  }`;

  const constantsNext = replaceKotlinFunction(
    text,
    /@Suppress\("DEPRECATION"\)\s*\n\s*override fun getTypedExportedConstants\s*\(/,
    constantsRepl,
  );
  if (!constantsNext) {
    throw new Error('StatusBarModule.kt: getTypedExportedConstants not found (RN version mismatch?)');
  }
  text = constantsNext;

  const setColorNext = replaceKotlinFunction(
    text,
    /@Suppress\("DEPRECATION"\)\s*\n\s*override fun setColor\s*\(/,
    setColorRepl,
  );
  if (!setColorNext) {
    throw new Error('StatusBarModule.kt: setColor not found (RN version mismatch?)');
  }
  text = setColorNext;

  text = text.replace(/\nimport android\.animation\.ArgbEvaluator\n/, '\n');
  text = text.replace(/\nimport android\.animation\.ValueAnimator\n/, '\n');
  text = text.replace(/\nimport android\.view\.WindowManager\n/, '\n');

  // Property / local name — not the words inside "setStatusBarColor" API comments.
  if (/\.statusBarColor\b|val statusBarColor\b/.test(text)) {
    throw new Error('StatusBarModule.kt still references statusBarColor after patch');
  }

  return { text, changed: true };
}

/**
 * @param {{ windowUtil?: string, statusBarModule?: string }} files
 */
function isReactNativeEdgeToEdgeClean(files) {
  const windowUtil = files.windowUtil || '';
  const statusBarModule = files.statusBarModule || '';
  if (!windowUtil || !statusBarModule) return false;
  const bannedWindow = [
    '.statusBarColor',
    '.navigationBarColor',
    'LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT',
    'LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES',
  ];
  for (const t of bannedWindow) {
    if (windowUtil.includes(t)) return false;
  }
  if (/\.statusBarColor\b|val statusBarColor\b/.test(statusBarModule)) return false;
  return true;
}

module.exports = {
  MARKER,
  replaceKotlinFunction,
  patchWindowUtilKt,
  patchStatusBarModuleKt,
  isReactNativeEdgeToEdgeClean,
};
