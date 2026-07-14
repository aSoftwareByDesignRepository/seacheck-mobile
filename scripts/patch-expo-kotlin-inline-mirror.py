#!/usr/bin/env python3
"""Skip mirror-kotlin-inline-modules when expo.inlineModules.watchedDirectories is empty."""
from __future__ import annotations

import sys
from pathlib import Path

MARKER = "SEACHECK_SKIP_EMPTY_INLINE_MIRROR"

OLD_BLOCKS = [
    """   project.gradle.projectsEvaluated {
    val srcDir = project.file("src/main/java/inline/modules/").absolutePath
    val buildDir = project.file("build/inline/modules/").absolutePath
    val nodeWorkingDir = project.rootProject.projectDir
    val watchedDirectoriesSerialized = project.findProperty("expo.inlineModules.watchedDirectories") ?: emptyList<String>()

    project.providers.exec { spec ->
        spec.workingDir(nodeWorkingDir)
        spec.commandLine(
            resolveNodeExecutableForProject(project), /* SEACHECK_NODE_PATCH */
            "--no-warnings",
            "--eval",
            "require('expo/bin/autolinking')",
            "expo-modules-autolinking",
            "mirror-kotlin-inline-modules",
            "--kotlin-files-mirror-directory",
            srcDir,
            "--inline-modules-list-directory",
            buildDir,
            "--watched-directories-serialized",
            watchedDirectoriesSerialized
        )
    }.standardOutput.asText.get()
}""",
    """   project.gradle.projectsEvaluated {
    val srcDir = project.file("src/main/java/inline/modules/").absolutePath
    val buildDir = project.file("build/inline/modules/").absolutePath
    val nodeWorkingDir = project.rootProject.projectDir
    val watchedDirectoriesSerialized = project.findProperty("expo.inlineModules.watchedDirectories") ?: emptyList<String>()

    project.providers.exec { spec ->
        spec.workingDir(nodeWorkingDir)
        spec.commandLine(
            "node",
            "--no-warnings",
            "--eval",
            "require('expo/bin/autolinking')",
            "expo-modules-autolinking",
            "mirror-kotlin-inline-modules",
            "--kotlin-files-mirror-directory",
            srcDir,
            "--inline-modules-list-directory",
            buildDir,
            "--watched-directories-serialized",
            watchedDirectoriesSerialized
        )
    }.standardOutput.asText.get()
}""",
]

NEW_BLOCK_RESOLVED = """   project.gradle.projectsEvaluated {
    val watchedRaw = project.findProperty("expo.inlineModules.watchedDirectories")
    val watchedSerialized = when (watchedRaw) {
      null -> "[]"
      is Collection<*> -> if (watchedRaw.isEmpty()) return@projectsEvaluated else watchedRaw.toString()
      else -> watchedRaw.toString()
    }
    if (watchedSerialized == "[]" || watchedSerialized.isBlank()) {
      return@projectsEvaluated // SEACHECK_SKIP_EMPTY_INLINE_MIRROR
    }

    val srcDir = project.file("src/main/java/inline/modules/").absolutePath
    val buildDir = project.file("build/inline/modules/").absolutePath
    val nodeWorkingDir = project.rootProject.projectDir

    project.providers.exec { spec ->
        spec.workingDir(nodeWorkingDir)
        spec.commandLine(
            resolveNodeExecutableForProject(project), /* SEACHECK_NODE_PATCH */
            "--no-warnings",
            "--eval",
            "require('expo/bin/autolinking')",
            "expo-modules-autolinking",
            "mirror-kotlin-inline-modules",
            "--kotlin-files-mirror-directory",
            srcDir,
            "--inline-modules-list-directory",
            buildDir,
            "--watched-directories-serialized",
            watchedSerialized
        )
    }.standardOutput.asText.get()
}"""

NEW_BLOCK_NODE = NEW_BLOCK_RESOLVED.replace(
    "resolveNodeExecutableForProject(project), /* SEACHECK_NODE_PATCH */",
    '"node",',
)


def main() -> None:
    path = Path(sys.argv[1])
    text = path.read_text()
    if MARKER in text:
        print(f"patch-expo-kotlin-inline-mirror: already patched {path}")
        return
    for old in OLD_BLOCKS:
        if old in text:
            replacement = NEW_BLOCK_NODE if '"node",' in old else NEW_BLOCK_RESOLVED
            path.write_text(text.replace(old, replacement, 1))
            print(f"patch-expo-kotlin-inline-mirror: patched {path}")
            return
    raise SystemExit(f"projectsEvaluated block not found in {path}")


if __name__ == "__main__":
    main()
