<?php
define("GLPI_CONFIG_DIR", "/var/glpi/config");
chdir("/var/www/glpi");

require "/var/www/glpi/vendor/autoload.php";

$glpikey = new \GLPIKey();
$raw_token = bin2hex(random_bytes(20));
$encrypted = $glpikey->encrypt($raw_token);

$mysqli = new mysqli("glpi-local-db", "glpi", "glpi", "glpi", 3306);
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error . PHP_EOL);
}

$stmt = $mysqli->prepare("UPDATE glpi_apiclients SET app_token = ?, app_token_date = NOW() WHERE id = 2");
$stmt->bind_param("s", $encrypted);
$stmt->execute();
$stmt->close();
$mysqli->close();

echo "NEW_APP_TOKEN=" . $raw_token . PHP_EOL;
