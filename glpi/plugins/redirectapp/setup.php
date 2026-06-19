<?php

if (!defined('GLPI_ROOT')) {
    die("Sorry.");
}

define('PLUGIN_REDIRECTAPP_VERSION', '1.0.0');
define('PLUGIN_REDIRECTAPP_MIN_GLPI_VERSION', '11.0.0');
define('PLUGIN_REDIRECTAPP_MAX_GLPI_VERSION', '999.0.0');
define('PLUGIN_REDIRECTAPP_MIN_PHP_VERSION', '8.0.0');

function plugin_version_redirectapp() {
    return [
        'name'         => 'Redirect App',
        'version'      => PLUGIN_REDIRECTAPP_VERSION,
        'author'       => 'DevGLPI',
        'license'      => 'GPLv2+',
        'homepage'     => '',
        'requirements' => [
            'glpi' => [
                'min' => PLUGIN_REDIRECTAPP_MIN_GLPI_VERSION,
                'max' => PLUGIN_REDIRECTAPP_MAX_GLPI_VERSION,
            ],
            'php' => [
                'min' => PLUGIN_REDIRECTAPP_MIN_PHP_VERSION,
            ],
        ],
    ];
}

function plugin_init_redirectapp() {
    global $PLUGIN_HOOKS;

    // Charger la config locale si elle existe
    $config_file = __DIR__ . '/config.php';
    if (file_exists($config_file)) {
        include_once($config_file);
    }

    if (!defined('REDIRECTAPP_TARGET_URL')) {
        define('REDIRECTAPP_TARGET_URL', 'http://localhost:3000/');
    }
    if (!defined('REDIRECTAPP_BUTTON_LABEL')) {
        define('REDIRECTAPP_BUTTON_LABEL', 'Rapports détaillés');
    }

    $PLUGIN_HOOKS['add_javascript']['redirectapp'] = 'public/js/redirectapp.js';
    $PLUGIN_HOOKS['add_css']['redirectapp'] = 'public/css/redirectapp.css';

    // Injecter les variables dans la page
    echo '<script>
        window.REDIRECTAPP_URL = "' . addslashes(REDIRECTAPP_TARGET_URL) . '";
        window.REDIRECTAPP_LABEL = "' . addslashes(REDIRECTAPP_BUTTON_LABEL) . '";
    </script>';
}

function plugin_redirectapp_check_config($verbose = false) {
    return true;
}
