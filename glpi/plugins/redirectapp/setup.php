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

    // Public assets served by GLPI are expected under the plugin public directory
    $PLUGIN_HOOKS['add_javascript']['redirectapp'] = 'public/js/redirectapp.js';
    $PLUGIN_HOOKS['add_css']['redirectapp'] = 'public/css/redirectapp.css';
}

function plugin_redirectapp_check_config($verbose = false) {
    return true;
}
