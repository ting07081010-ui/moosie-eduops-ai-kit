/*
 * Showcase progressive enhancement only.
 * All flow text is fully present in HTML with JS disabled. This script only
 * attaches disclosure toggles to the pre-rendered control groups, hides
 * inactive whole panel sections, and announces changes in each group's
 * nearby polite live region.
 * No network calls, storage, cookies, beacons, or dynamic content generation.
 */
(function () {
  "use strict";

  // Toggle a whole panel section: the id matches the control's aria-controls,
  // so the heading and all of the panel content hide and show together.
  function setPanel(panelId, expanded) {
    var control = document.querySelector('[aria-controls="' + panelId + '"]');
    var panel = document.getElementById(panelId);
    if (!panel) return;
    if (control) control.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (expanded) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
  }

  function wireControlGroup(groupAttr, statusId) {
    var group = document.querySelector("[data-" + groupAttr + "]");
    if (!group) return;
    var buttons = Array.prototype.slice.call(group.querySelectorAll("button"));
    if (buttons.length === 0) return;

    var status = document.getElementById(statusId);

    function showOnly(panelId, label) {
      buttons.forEach(function (btn) {
        var target = btn.getAttribute("aria-controls");
        setPanel(target, target === panelId);
      });
      if (status) status.textContent = "已展開：" + label;
    }

    function toggle(btn) {
      var target = btn.getAttribute("aria-controls");
      var willExpand = btn.getAttribute("aria-expanded") !== "true";
      if (willExpand) showOnly(target, btn.textContent.trim());
      else {
        setPanel(target, false);
        if (status) status.textContent = "已收合：" + btn.textContent.trim();
      }
    }

    // Attach every listener first, then reveal the controls, then hide panels.
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggle(btn);
      });
    });
    buttons.forEach(function (btn) {
      btn.removeAttribute("hidden");
    });

    // Collapse every panel except the first one preselected in markup.
    var firstOpen = null;
    buttons.forEach(function (btn) {
      if (btn.getAttribute("aria-expanded") === "true" && firstOpen === null) {
        firstOpen = btn.getAttribute("aria-controls");
      }
    });
    buttons.forEach(function (btn) {
      var target = btn.getAttribute("aria-controls");
      setPanel(target, target === firstOpen);
    });
  }

  function init() {
    wireControlGroup("flow-controls", "showcase-status");
    wireControlGroup("rejection-controls", "rejection-status");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
