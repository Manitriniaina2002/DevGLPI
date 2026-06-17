<?php

if (!defined('GLPI_ROOT')) {
    die('Sorry.');
}

include('../../../inc/includes.php');

use User;
use Session;

$loggedIn = false;
if (class_exists('Session') && method_exists('Session', 'isLogged')) {
    $loggedIn = Session::isLogged();
} elseif (isset($_SESSION['glpiID'])) {
    $loggedIn = $_SESSION['glpiID'] > 0;
}

if (!$loggedIn) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'User is not logged in']);
    exit;
}

// CORS: allow local frontend to call this endpoint directly during development
// Adjust or remove in production for security.
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    exit;
}

$userId = null;
if (class_exists('Session') && method_exists('Session', 'getLoginUserID')) {
    $userId = Session::getLoginUserID();
} elseif (isset($_SESSION['glpiID'])) {
    $userId = $_SESSION['glpiID'];
}

$token = '';
$tokenField = null;
$tokenCandidates = [];
if ($userId) {
    $user = new User();
    if ($user->getFromDB($userId)) {
        $fields = $user->fields;
        // `api_token` in GLPI is stored as a hash, not the raw token value.
        // We must not use it directly for user_token exchange.
        $candidateFields = ['token', 'personal_token', 'cookie_token', 'external_token', 'authtoken'];
        foreach ($candidateFields as $field) {
            $tokenCandidates[$field] = $fields[$field] ?? null;
            if (!empty($fields[$field])) {
                $token = $fields[$field];
                $tokenField = $field;
                break;
            }
        }
    }
}

header('Content-Type: application/json; charset=utf-8');
// Continue to generate one_time token below and output a single JSON response
// Generate an HMAC-signed one-time token to allow the external app
// to authenticate without reading the GLPI API token (which may be hashed).
// The plugin will look for a secret in env `GLPI_PLUGIN_SECRET` or in
// a file `../secret.key` inside the plugin directory. If a secret is
// available and a clear token exists, produce `one_time` = base64url(payload).sig
// where payload contains uid, login, full_name, token_field and expiry.

// (Note: Clients must set the same secret in backend as `GLPI_PLUGIN_SECRET`.)
$one_time = null;
$secret = getenv('GLPI_PLUGIN_SECRET') ?: '';
if (!$secret) {
    $secret_file = __DIR__ . '/../secret.key';
    if (file_exists($secret_file)) {
        $secret = trim(file_get_contents($secret_file));
    }
}
if (!empty($secret) && !empty($token)) {
    $login = $fields['name'] ?? '';
    $full_name = trim(($fields['firstname'] ?? '') . ' ' . ($fields['realname'] ?? ''));
    $payload = json_encode([
        'uid' => (int)$userId,
        'login' => $login,
        'full_name' => $full_name,
        'token_field' => $tokenField,
        'exp' => time() + 30,
    ]);
    $b = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b, $secret);
    $one_time = $b . '.' . $sig;
}

// Re-output including one_time when available
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'user_id' => $userId,
    'token' => $token,
    'token_field' => $tokenField,
    'tokens' => $tokenCandidates,
    'one_time' => $one_time,
]);
exit;
