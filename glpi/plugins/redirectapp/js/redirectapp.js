(function () {
  // Debug log to verify the plugin JS is loaded
  try { console.log('[redirectapp] script loaded'); } catch (e) {}

  var buttonClass = 'redirectapp-button';
  var buttonUrl = 'http://localhost:3000/';

  function addRedirectButton() {
    if (document.querySelector('.' + buttonClass)) {
      return;
    }

    if (window.location.pathname.indexOf('login') !== -1) {
      return;
    }

    var button = document.createElement('a');
    button.className = buttonClass;
    button.href = buttonUrl;
    button.target = '_blank';
    button.rel = 'noreferrer noopener';
    button.textContent = 'Voir Rapport détaillé';

    document.body.appendChild(button);
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
