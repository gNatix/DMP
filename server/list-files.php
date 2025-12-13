<?php
/**
 * DM Planner Assets File Lister
 * Returns JSON list of files AND subdirectories in a directory
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Get the requested path
$path = isset($_GET['path']) ? $_GET['path'] : '';

// Base directory for assets - points to subdomain root which IS the assets folder
$baseDir = __DIR__;

// Security: prevent directory traversal
$path = str_replace(['..', '\\'], '', $path);
$fullPath = $baseDir . '/' . $path;

if (!is_dir($fullPath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Directory not found']);
    exit;
}

$files = [];
$folders = [];
$items = scandir($fullPath);

foreach ($items as $item) {
    if ($item === '.' || $item === '..') {
        continue;
    }
    
    $itemPath = $fullPath . '/' . $item;
    
    if (is_dir($itemPath)) {
        // It's a subdirectory
        $folders[] = [
            'name' => $item,
            'type' => 'folder',
            'path' => ($path ? $path . '/' : '') . $item
        ];
    } elseif (is_file($itemPath)) {
        // Check if it's an image file
        $extension = strtolower(pathinfo($item, PATHINFO_EXTENSION));
        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
            $files[] = [
                'name' => $item,
                'type' => 'file',
                'download_url' => 'https://dmp.natixlabs.com/' . $path . '/' . $item
            ];
        }
    }
}

// Return folders first, then files
echo json_encode([
    'folders' => $folders,
    'files' => $files
]);
?>
