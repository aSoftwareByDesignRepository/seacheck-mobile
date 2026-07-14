/**
 * F-Droid clones seacheck-mobile alone (no mobile/shared monorepo sibling).
 */
describe('metro.config.js', () => {
  it('does not require ../shared/', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../metro.config.js'), 'utf8');
    expect(source).not.toMatch(/\.\.\/shared\//);
  });

  it('loads under Node (same as Gradle createBundleReleaseJsAndAssets)', () => {
    const { execSync } = require('child_process');
    const path = require('path');
    const root = path.join(__dirname, '..');
    expect(() => {
      execSync("node -e \"require('./metro.config.js')\"", {
        cwd: root,
        env: {
          ...process.env,
          SEACHECK_APP_VARIANT: 'production',
          NODE_ENV: 'production',
        },
        stdio: 'pipe',
      });
    }).not.toThrow();
  });
});
