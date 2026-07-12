const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Reads keystore.properties (if present) and wires release signing.
 * Checks mobile/seacheck-private/ first (parent workspace), then mobile/seacheck/.
 * Survives `expo prebuild --clean`. Without the file, release keeps debug signing.
 */
function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    if (contents.includes('seacheckKeystorePropertiesFile')) {
      return gradleConfig;
    }

    const loader = `
// SeaCheck release signing — see keystore.properties.example
def seacheckKeystorePropertiesFile = rootProject.file("../../seacheck-private/keystore.properties")
if (!seacheckKeystorePropertiesFile.exists()) {
    seacheckKeystorePropertiesFile = rootProject.file("../keystore.properties")
}
def seacheckKeystoreProperties = new Properties()
if (seacheckKeystorePropertiesFile.exists()) {
    seacheckKeystoreProperties.load(new FileInputStream(seacheckKeystorePropertiesFile))
}
`;

    contents = contents.replace(
      /\nandroid \{\n/,
      `\n${loader}\nandroid {\n`,
    );

    contents = contents.replace(
      /signingConfigs \{\s*debug \{[\s\S]*?\}\s*\}/,
      `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (seacheckKeystorePropertiesFile.exists()) {
                storeFile rootProject.file(seacheckKeystoreProperties['storeFile'])
                storePassword seacheckKeystoreProperties['storePassword']
                keyAlias seacheckKeystoreProperties['keyAlias']
                keyPassword seacheckKeystoreProperties['keyPassword']
            }
        }
    }`,
    );

    contents = contents.replace(
      /release \{\s*\/\/ Caution! In production[\s\S]*?signingConfig signingConfigs\.debug/,
      `release {
            // Uses keystore.properties when present; otherwise debug (local testing only).
            signingConfig seacheckKeystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug`,
    );

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

module.exports = withAndroidReleaseSigning;
