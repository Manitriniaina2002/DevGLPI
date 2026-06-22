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

header('Access-Control-Allow-Origin: ' . (defined('REDIRECTAPP_TARGET_URL') ? rtrim(REDIRECTAPP_TARGET_URL, '/') : 'http://localhost:3000'));
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
        'uid'         => (int)$userId,
        'login'       => $login,
        'full_name'   => $full_name,
        'token_field' => $tokenField,
        'exp'         => time() + 30,
    ]);
    $b = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b, $secret);
    $one_time = $b . '.' . $sig;
}

// Charger la config si pas encore chargée
if (!defined('REDIRECTAPP_TARGET_URL')) {
    $config_file = __DIR__ . '/../config.php';
    if (file_exists($config_file)) include_once($config_file);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'user_id'     => $userId,
    'token'       => $token,
    'token_field' => $tokenField,
    'tokens'      => $tokenCandidates,
    'one_time'    => $one_time,
    'config'      => [
        'target_url'   => defined('REDIRECTAPP_TARGET_URL')   ? REDIRECTAPP_TARGET_URL   : 'http://localhost:3000/',
        'button_label' => defined('REDIRECTAPP_BUTTON_LABEL') ? REDIRECTAPP_BUTTON_LABEL : 'Rapports détaillés',
    ],
]);
exit;