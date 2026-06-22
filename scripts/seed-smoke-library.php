<?php

declare(strict_types=1);

/**
 * Idempotent dev/smoke fixture: one MP3 in admin/Music, library registered, scanned.
 * Run inside the Nextcloud container: php /path/to/seed-smoke-library.php
 */

require '/var/www/html/lib/base.php';

$userId = getenv('AUDIOCHECK_SMOKE_USER') ?: 'admin';

/** @var \OCP\IUserManager $userManager */
$userManager = \OC::$server->get(\OCP\IUserManager::class);
if ($userManager->get($userId) === null) {
    fwrite(STDERR, "User not found: {$userId}\n");
    exit(1);
}

/** @var \OCA\AudioCheck\Service\FileAccessService $access */
$access = \OC::$server->get(\OCA\AudioCheck\Service\FileAccessService::class);
$root = $access->getUserFolder($userId);

if (!$root->nodeExists('Music')) {
    $root->newFolder('Music');
}

/** @var \OCP\Files\Folder $music */
$music = $root->get('Music');
$relative = 'smoke-mobile.mp3';

if ($music->nodeExists($relative)) {
    $music->get($relative)->delete();
}

/** @var \OCP\Files\File $file */
$file = $music->newFile($relative);
$bytes = base64_decode(
    '//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQxAADwlQGkAAAAFAAA//uQxAADwlQGkAAAAFAAA',
    true,
);
$file->putContent($bytes !== false ? $bytes : 'ID3');
$fileId = (int) $file->getId();

/** @var \OCA\AudioCheck\Service\LibraryService $library */
$library = \OC::$server->get(\OCA\AudioCheck\Service\LibraryService::class);
try {
    $library->addLibrary($userId, (int) $music->getId(), true, 'music', null);
} catch (\Throwable) {
    // already registered
}

/** @var \OCA\AudioCheck\Service\ScanService $scan */
$scan = \OC::$server->get(\OCA\AudioCheck\Service\ScanService::class);
$scan->scanUser($userId);

echo "FILE_ID={$fileId}\n";
