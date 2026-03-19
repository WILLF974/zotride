<?php
// Routeur pour php -S (remplace .htaccess mod_rewrite)
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Fichiers statiques existants → servis directement
if ($uri !== '/' && file_exists(__DIR__ . $uri) && !is_dir(__DIR__ . $uri)) {
    return false;
}

// Routes API → api.php
if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/api.php';
    exit;
}

// radar.html
if ($uri === '/radar.html') {
    require __DIR__ . '/radar.html';
    exit;
}

// SPA fallback → index.html
require __DIR__ . '/index.html';
