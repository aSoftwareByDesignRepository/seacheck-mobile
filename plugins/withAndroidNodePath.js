const { withSettingsGradle, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'seacheckNodeExecutable';

const nodeResolver = `def ${MARKER} = {
  def nodeBinary = System.getenv("NODE_BINARY")
  if (nodeBinary != null && !nodeBinary.isEmpty()) {
    return nodeBinary
  }
  def localProps = new Properties()
  def localPropsFile = new File(rootDir, "local.properties")
  if (localPropsFile.exists()) {
    localPropsFile.withInputStream { localProps.load(it) }
    def nodeDir = localProps.getProperty("node.dir")
    if (nodeDir != null && !nodeDir.isEmpty()) {
      return new File(nodeDir, "node").absolutePath
    }
  }
  return "node"
}()
`;

const settingsTail = `
${nodeResolver}
def seacheckProjectRoot = rootDir.parentFile

def seacheckReactNativeDir = new File(
  providers.exec {
    workingDir(seacheckProjectRoot)
    commandLine(${MARKER}, "--print", "require.resolve('react-native/package.json')")
  }.standardOutput.asText.get().trim()
).parentFile

def seacheckRnGradlePluginDir = new File(
  providers.exec {
    workingDir(seacheckProjectRoot)
    commandLine(${MARKER}, "--print", "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })")
  }.standardOutput.asText.get().trim()
).parentFile

extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  if (System.getenv('EXPO_USE_COMMUNITY_AUTOLINKING') == '1') {
    ex.autolinkLibrariesFromCommand()
  } else {
    def cmd = expoAutolinking.rnConfigCommand
    def patchedCmd = [${MARKER}] + cmd.subList(1, cmd.size())
    ex.autolinkLibrariesFromCommand(patchedCmd)
  }
}
expoAutolinking.projectRoot = seacheckProjectRoot
expoAutolinking.useExpoModules()

settings.dependencyResolutionManagement {
  it.versionCatalogs { spec ->
    spec.create("expoLibs") { catalog ->
      catalog.from(files(new File(seacheckReactNativeDir, "gradle/libs.versions.toml")))
      def catalogProps = [
        ["android.buildToolsVersion", "buildTools"],
        ["android.minSdkVersion", "minSdk"],
        ["android.compileSdkVersion", "compileSdk"],
        ["android.targetSdkVersion", "targetSdk"],
        ["android.kotlinVersion", "kotlin"],
      ]
      catalogProps.each { pair ->
        def property = providers.gradleProperty(pair[0])
        if (property.isPresent()) {
          catalog.version(pair[1], property.get())
        }
      }
    }
  }
}

rootProject.name = 'SeaCheck'

include ':app'
includeBuild(seacheckRnGradlePluginDir)
`;

function patchSettingsGradle(contents) {
  if (contents.includes('seacheckProjectRoot')) {
    return contents;
  }

  contents = contents.replace(
    'pluginManagement {',
    `pluginManagement {
  // SeaCheck — Android Studio / Flatpak often lack \`node\` on PATH (nvm). See local.properties node.dir
  ${nodeResolver}`,
  );

  contents = contents.replaceAll('commandLine("node",', `commandLine(${MARKER},`);

  contents = contents.replace(
    /extensions\.configure\(com\.facebook\.react\.ReactSettingsExtension\)[\s\S]*includeBuild\(expoAutolinking\.reactNativeGradlePlugin\)\n?/,
    settingsTail,
  );

  return contents;
}

function patchAppBuildGradle(contents) {
  if (contents.includes(`${MARKER} =`)) {
    return contents;
  }

  contents = contents.replace(
    /def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)\n/,
    (match) => `${match}// SeaCheck node path — see local.properties node.dir\n${nodeResolver}\n`,
  );

  contents = contents.replaceAll('["node",', `[${MARKER},`);

  contents = contents.replace(
    /\/\/ nodeExecutableAndArgs = \["node"\]/,
    `nodeExecutableAndArgs = [${MARKER}]`,
  );

  if (!contents.includes('REACT_NATIVE_NODE_MODULES_DIR')) {
    contents = contents.replace(
      /(def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)\n)/,
      `$1ext.REACT_NATIVE_NODE_MODULES_DIR = new File(rootDir, "../node_modules/react-native").absolutePath\n`,
    );
  }

  return contents;
}

const GRADLEW_PATH_SNIPPET = `
# SeaCheck: expose node to Gradle when Android Studio / Flatpak lack nvm on PATH
if [ -f "\$APP_HOME/local.properties" ]; then
  SEACHECK_NODE_DIR=\$(grep '^node.dir=' "\$APP_HOME/local.properties" | cut -d= -f2-)
  if [ -n "\$SEACHECK_NODE_DIR" ]; then
    export PATH="\$APP_HOME:\$SEACHECK_NODE_DIR:\$PATH"
  fi
fi
`;

function patchGradlew(contents) {
  if (contents.includes('SEACHECK_NODE_DIR')) {
    return contents;
  }

  return contents.replace(
    "APP_HOME=$( cd -P \"${APP_HOME:-./}\" > /dev/null && printf '%s\\n' \"$PWD\" ) || exit\n",
    `APP_HOME=$( cd -P "\${APP_HOME:-./}" > /dev/null && printf '%s\\n' "$PWD" ) || exit
${GRADLEW_PATH_SNIPPET}`,
  );
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withAndroidNodePath(config) {
  config = withSettingsGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = patchSettingsGradle(gradleConfig.modResults.contents);
    return gradleConfig;
  });

  config = withAppBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = patchAppBuildGradle(gradleConfig.modResults.contents);
    return gradleConfig;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const gradlewPath = path.join(config.modRequest.platformProjectRoot, 'gradlew');
      if (fs.existsSync(gradlewPath)) {
        const contents = fs.readFileSync(gradlewPath, 'utf8');
        fs.writeFileSync(gradlewPath, patchGradlew(contents));
      }
      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidNodePath;
