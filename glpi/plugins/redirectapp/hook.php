<?php

if (!defined('GLPI_ROOT')) {
    die('Sorry.');
}

function plugin_redirectapp_install() {
    return true;
}

function plugin_redirectapp_uninstall() {
    return true;
}

// This file remains for compatibility with GLPI plugin conventions.
// The page injection is handled through add_javascript/add_css hooks in setup.php.
