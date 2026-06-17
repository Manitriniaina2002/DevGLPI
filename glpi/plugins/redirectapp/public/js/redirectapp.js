(function () {
  // Debug log to verify the plugin JS is loaded
  try { console.log('[redirectapp] script loaded'); } catch (e) {}

  var buttonClass = 'redirectapp-button';
  var buttonUrl = 'http://localhost:3000/';

  function getTabsContainer() {
    var selectors = [
      '#tabs',
      '.ui-tabs-nav',
      '.tabs',
      '.nav-tabs',
      '.glpi_tabs',
      '.tab_bar',
      '.tabbar',
      '.tabs-container',
      '#content .ui-tabs-nav',
      '#content .tabs',
      '#content .nav-tabs'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        return el;
      }
    }
    return null;
  }

  function addRedirectButton() {
    if (document.querySelector('.' + buttonClass)) {
      return;
    }

    if (window.location.pathname.indexOf('login') !== -1) {
      return;
    }

    // Only show the redirect button on the GLPI central page
    if (window.location.pathname.indexOf('/front/central.php') === -1) {
      return;
    }

    var button = document.createElement('a');
    button.className = buttonClass;
    button.href = 'javascript:void(0)';
    button.target = '_blank';
    button.rel = 'noreferrer noopener';
    button.textContent = 'Chargement...';
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.6';
    button.dataset.tokenReady = 'false';

    button.addEventListener('click', function (event) {
      if (button.dataset.tokenReady !== 'true') {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    var tabsContainer = getTabsContainer();
    if (tabsContainer) {
      tabsContainer.appendChild(button);
      button.classList.add('redirectapp-button-near-tabs');
    } else {
      document.body.appendChild(button);
    }

    loadUserToken(button);
  }

  function getPluginBasePath() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.indexOf('redirectapp.js') !== -1) {
        return src.replace(/\/public\/js\/redirectapp\.js(?:\?.*)?$/, '');
      }
    }
    return '';
  }

  function loadUserToken(button) {
    var pluginBase = getPluginBasePath();
    if (!pluginBase) {
      try { console.warn('[redirectapp] could not determine plugin base path, using fallback'); } catch (e) {}
      pluginBase = window.location.origin + '/plugins/redirectapp';
    }

    var tokenUrl = pluginBase.replace(/\/$/, '') + '/front/get_user_token.php';
    try { console.log('[redirectapp] fetching token from', tokenUrl); } catch (e) {}

    fetch(tokenUrl, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Token fetch failed: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        try { console.log('[redirectapp] token response', JSON.stringify(data, null, 2)); } catch (e) {}
        if (data && (data.one_time || data.token)) {
          var separator = buttonUrl.indexOf('?') === -1 ? '?' : '&';
          if (data.one_time) {
            button.href = buttonUrl + separator + 'one_time=' + encodeURIComponent(data.one_time);
            button.dataset.tokenField = 'one_time';
            try { console.log('[redirectapp] using one_time token for redirect'); } catch (e) {}
          } else {
            button.href = buttonUrl + separator + 'glpi_token=' + encodeURIComponent(data.token);
            button.dataset.tokenField = data.token_field || '';
            try { console.log('[redirectapp] using legacy token for redirect'); } catch (e) {}
          }
          button.dataset.tokenReady = 'true';
          button.style.pointerEvents = '';
          button.style.opacity = '';
          button.textContent = 'Voir Rapport détaillé';
          button.title = 'Ouvrir l\'application avec authentification automatique';
        } else {
          button.textContent = 'Token GLPI introuvable';
          button.style.opacity = '0.6';
          try { console.warn('[redirectapp] aucun token utilisateur trouvé', data); } catch (e) {}
        }
      })
      .catch(function (error) {
        button.textContent = 'Erreur de connexion';
        button.style.opacity = '0.6';
        try { console.warn('[redirectapp] could not load user token', error); } catch (e) {}
      });
  }

  function tryAttach() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addRedirectButton);
    } else {
      addRedirectButton();
    }
  }

  tryAttach();

  if (typeof jQuery !== 'undefined') {
    jQuery(document).on('tabsload', function () {
      addRedirectButton();
    });
  }
})();
