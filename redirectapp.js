(function () {
  try { console.log("[redirectapp] script loaded"); } catch (e) {}

  var buttonClass = "redirectapp-button";
  var buttonUrl = window.REDIRECTAPP_URL || "http://localhost:3000/";
  var buttonLabel = window.REDIRECTAPP_LABEL || "Rapports détaillés";

  function addRedirectButton() {
    if (document.querySelector("." + buttonClass)) return;
    if (window.location.pathname.indexOf("login") !== -1) return;
    if (window.location.pathname.indexOf("central.php") === -1) return;

    var button = document.createElement("a");
    button.className = buttonClass;
    button.href = "javascript:void(0)";
    button.rel = "noreferrer noopener";
    button.textContent = "Chargement...";
    button.style.pointerEvents = "none";
    button.style.opacity = "0.6";
    button.dataset.tokenReady = "false";

    button.addEventListener("click", function (event) {
      if (button.dataset.tokenReady !== "true") {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    // Injecter AVANT la barre de recherche dans le header
    var searchDiv = document.querySelector("header.navbar .ms-lg-auto");
    if (searchDiv) {
      var wrapper = document.createElement("div");
      wrapper.className = "d-none d-lg-flex align-items-center align-self-center me-2";
      wrapper.appendChild(button);
      searchDiv.parentNode.insertBefore(wrapper, searchDiv);
    } else {
      // Fallback fixed
      button.style.position = "fixed";
      button.style.top = "14px";
      button.style.right = "200px";
      button.style.zIndex = "99999";
      document.body.appendChild(button);
    }

    loadUserToken(button, buttonLabel);
  }

  function getPluginBasePath() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.indexOf("redirectapp.js") !== -1) {
        return src.replace(/\/public\/js\/redirectapp\.js(?:\?.*)?$/, "");
      }
    }
    return "";
  }

  function loadUserToken(button, label) {
    var pluginBase = getPluginBasePath();
    if (!pluginBase) {
      pluginBase = window.location.origin + "/plugins/redirectapp";
    }
    var tokenUrl = pluginBase.replace(/\/$/, "") + "/front/get_user_token.php";
    fetch(tokenUrl, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Token fetch failed: " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (data && (data.one_time || data.token)) {
          var separator = buttonUrl.indexOf("?") === -1 ? "?" : "&";
          if (data.one_time) {
            button.href = buttonUrl + separator + "one_time=" + encodeURIComponent(data.one_time);
          } else {
            button.href = buttonUrl + separator + "glpi_token=" + encodeURIComponent(data.token);
          }
          button.target = "_blank";
          button.dataset.tokenReady = "true";
          button.style.pointerEvents = "";
          button.style.opacity = "";
          button.textContent = label;
        } else {
          button.textContent = "Token introuvable";
          button.style.opacity = "0.6";
        }
      })
      .catch(function (error) {
        button.textContent = "Erreur connexion";
        button.style.opacity = "0.6";
        try { console.warn("[redirectapp]", error); } catch (e) {}
      });
  }

  function tryAttach() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", addRedirectButton);
    } else {
      addRedirectButton();
    }
  }

  tryAttach();

  if (typeof jQuery !== "undefined") {
    jQuery(document).on("tabsload", function () { addRedirectButton(); });
  }
})();

