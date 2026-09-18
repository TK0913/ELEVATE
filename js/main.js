/* Elevate — motion layer.
   Desktop (>=951px): the whole story (hero -> closing) is one pinned
   horizontal filmstrip driven by vertical scroll input, with per-panel
   reveals nested inside it via GSAP's containerAnimation technique — the
   same approach the reference site's own scroll.js uses. Below 951px
   (matching the reference's own is_mobile breakpoint) it falls back to a
   plain vertical stack with ordinary scroll-triggered reveals.
   GSAP + ScrollTrigger for motion, Lenis for smooth-scroll input. Everything
   degrades to instant-visible content if a library fails to load. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var DESKTOP_QUERY = "(min-width: 951px)";

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- preloader ---------------- */
  function runPreloader(done) {
    var pctEl = document.getElementById("preloaderPct");
    var preloader = document.getElementById("preloader");
    if (!preloader) { done(); return; }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      preloader.style.display = "none";
      done();
    }

    if (!hasGSAP || reduceMotion) { finish(); return; }

    // Hard safety net: a preloader must never be able to block the site
    // forever (e.g. rAF throttled on a backgrounded/occluded tab).
    var fallback = setTimeout(finish, 2600);

    var counter = { v: 0 };
    gsap.to(counter, {
      v: 100,
      duration: 1.1,
      ease: "power2.inOut",
      onUpdate: function () { pctEl.textContent = Math.round(counter.v) + "%"; },
      onComplete: function () {
        gsap.to(preloader, {
          yPercent: -100,
          duration: 0.7,
          ease: "power3.inOut",
          delay: 0.15,
          onComplete: function () { clearTimeout(fallback); finish(); }
        });
      }
    });
  }

  /* ---------------- split-line text reveal (shared helper) ---------------- */
  function prepSplitLines() {
    document.querySelectorAll("[data-split-lines] .line").forEach(function (line) {
      var inner = document.createElement("span");
      inner.className = "line__inner";
      inner.style.display = "block";
      while (line.firstChild) inner.appendChild(line.firstChild);
      line.appendChild(inner);
      if (hasGSAP) gsap.set(inner, { yPercent: 110, opacity: 0 });
    });
  }

  function revealLines(scopeEl, opts) {
    var inner = scopeEl.querySelectorAll(".line__inner");
    if (!hasGSAP || reduceMotion) {
      inner.forEach(function (el) { el.style.transform = "none"; el.style.opacity = "1"; });
      return;
    }
    gsap.to(inner, Object.assign({ yPercent: 0, opacity: 1, duration: 1, ease: "expo.out", stagger: 0.08 }, opts || {}));
  }

  /* ---------------- mobile menu ---------------- */
  function initMobileMenu() {
    var btn = document.getElementById("menuBtn");
    var menu = document.getElementById("mobileMenu");
    var closeBtn = document.getElementById("menuClose");
    if (!btn || !menu) return;
    function close() { menu.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); btn.focus({ preventScroll: true }); }
    btn.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && closeBtn) closeBtn.focus({ preventScroll: true });
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("is-open")) close(); });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { menu.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }); });
  }

  /* ---------------- contact form ----------------
     No backend here — this is a portfolio build. Submitting just prevents
     the page reload and swaps in a confirmation message, so the form reads
     as complete rather than dead. Wire a real endpoint before this goes live. */
  function initContactForm() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.classList.add("is-sent");
    });
  }

  /* ---------------- magnetic directional button hover ---------------- */
  function initMagneticButtons() {
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!canHover) return;

    function edgeVars(el, clientX, clientY) {
      var r = el.getBoundingClientRect();
      var fromLeft = clientX - r.left, fromRight = r.right - clientX;
      var fromTop = clientY - r.top, fromBottom = r.bottom - clientY;
      var min = Math.min(fromLeft, fromRight, fromTop, fromBottom);
      if (min === fromLeft) return { mx: "-102%", my: "0%" };
      if (min === fromRight) return { mx: "102%", my: "0%" };
      if (min === fromTop) return { mx: "0%", my: "-102%" };
      return { mx: "0%", my: "102%" };
    }

    document.querySelectorAll(".btn-magnetic").forEach(function (el) {
      el.addEventListener("mouseenter", function (e) {
        var v = edgeVars(el, e.clientX, e.clientY);
        el.style.setProperty("--mx", v.mx);
        el.style.setProperty("--my", v.my);
        requestAnimationFrame(function () {
          el.style.setProperty("--mx", "0%");
          el.style.setProperty("--my", "0%");
          el.classList.add("is-hover");
        });
      });
      el.addEventListener("mouseleave", function (e) {
        var v = edgeVars(el, e.clientX, e.clientY);
        el.style.setProperty("--mx", v.mx);
        el.style.setProperty("--my", v.my);
        el.classList.remove("is-hover");
      });
    });
  }

  /* ---------------- cursor-follow preview (approach) ----------------
     The photo should follow the cursor anywhere across the WHOLE blue
     section — both the values half and the stats half, not just a hovered
     row — stay small, and sit BEHIND the text rather than covering it —
     see the z-index setup on .approach-preview / .values__stack /
     .stats__grid in the CSS. It's bound to the OUTER .h-panel--approach
     (not either inner half) so entering/leaving the section as a whole —
     not the boundary between the two halves — is what shows/hides it.
     Because it's positioned relative to that outer panel (not the
     viewport), its position is computed from the panel's own live
     bounding rect on every frame, so it tracks correctly even while the
     panel is mid-transit in the horizontal story. */
  function initApproachCursorImage() {
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!canHover) return;
    var panel = document.querySelector(".h-panel--approach");
    var preview = document.getElementById("approachPreview");
    var img = document.getElementById("approachPreviewImg");
    var rows = Array.prototype.slice.call(document.querySelectorAll(".value-row[data-hover-img]"));
    if (!panel || !preview || !img || !rows.length) return;

    img.src = rows[0].getAttribute("data-hover-img");

    var target = { x: 0, y: 0 }, pos = { x: 0, y: 0 }, active = false, raf = null;

    function nearestRowImage(clientY) {
      var best = rows[0], bestDist = Infinity;
      rows.forEach(function (row) {
        var r = row.getBoundingClientRect();
        var dist = Math.abs(clientY - (r.top + r.height / 2));
        if (dist < bestDist) { bestDist = dist; best = row; }
      });
      return best.getAttribute("data-hover-img");
    }

    function swapSrc(src) {
      if (img.getAttribute("src") === src) return;
      img.style.opacity = "0";
      setTimeout(function () { img.src = src; img.style.opacity = "1"; }, 120);
    }

    function loop() {
      var rect = panel.getBoundingClientRect();
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      preview.style.transform = "translate(" + (pos.x - rect.left) + "px," + (pos.y - rect.top) + "px) translate(-50%,-50%)";
      if (active) raf = requestAnimationFrame(loop);
    }

    panel.addEventListener("mouseenter", function (e) {
      active = true;
      target.x = pos.x = e.clientX; target.y = pos.y = e.clientY;
      swapSrc(nearestRowImage(e.clientY));
      preview.style.opacity = "1";
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    });
    panel.addEventListener("mousemove", function (e) {
      target.x = e.clientX; target.y = e.clientY;
      swapSrc(nearestRowImage(e.clientY));
    });
    panel.addEventListener("mouseleave", function () {
      preview.style.opacity = "0"; active = false; cancelAnimationFrame(raf);
    });
  }

  /* ---------------- dot cursor (services) ----------------
     The native arrow is hidden over the Services panel, so a small dot
     stands in for it. Fixed-position and eased toward the pointer. */
  function initServicesDot() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var panel = document.querySelector(".h-panel--services");
    var dot = document.getElementById("cursorDot");
    if (!panel || !dot) return;
    var t = { x: 0, y: 0 }, p = { x: 0, y: 0 }, raf = null, on = false;
    function loop() {
      p.x += (t.x - p.x) * 0.3; p.y += (t.y - p.y) * 0.3;
      dot.style.transform = "translate(" + p.x + "px," + p.y + "px)";
      if (on) raf = requestAnimationFrame(loop);
    }
    var desktop = window.matchMedia("(min-width: 951px)");
    panel.addEventListener("mouseenter", function (e) {
      if (!desktop.matches) return;
      on = true; t.x = p.x = e.clientX; t.y = p.y = e.clientY;
      dot.classList.add("is-on"); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    });
    panel.addEventListener("mousemove", function (e) {
      if (!on) return;
      t.x = e.clientX; t.y = e.clientY;
    });
    panel.addEventListener("mouseleave", function () {
      on = false; cancelAnimationFrame(raf); dot.classList.remove("is-on");
    });
  }

  /* ---------------- adaptive nav color ----------------
     Every section carries data-nav-theme="light|dark" (light section =
     dark nav text, dark section = light nav text). An IntersectionObserver
     watches a thin band exactly where the nav sits — the vertical rail at
     the right edge on desktop, the top strip on mobile/tablet — and sets
     data-nav-theme on <html>; CSS transitions the color. Works with the
     horizontally translating panels because IntersectionObserver tracks
     transformed geometry. */
  function initNavTheme() {
    var root = document.documentElement;
    var sections = document.querySelectorAll("[data-nav-theme]");
    if (!sections.length || !("IntersectionObserver" in window)) return;
    var desktop = window.matchMedia(DESKTOP_QUERY);
    var io = null, order = [];

    function apply() {
      var top = order.length ? order[order.length - 1] : null;
      if (top) root.setAttribute("data-nav-theme", top.getAttribute("data-nav-theme"));
    }
    function build() {
      if (io) io.disconnect();
      order = [];
      var vh = window.innerHeight, vw = window.innerWidth, margin;
      // rootMargin is top right bottom left; negative values shrink the root
      // box down to a thin band where the nav actually sits
      if (desktop.matches) {
        var c = vw * 0.03; // rail is 6vw wide, band sits on its centerline
        margin = "-" + (vh / 2 - 1) + "px -" + (c - 1) + "px -" + (vh / 2 - 1) + "px -" + (vw - c - 1) + "px";
      } else {
        margin = "-30px 0px -" + Math.max(0, vh - 50) + "px 0px";
      }
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = order.indexOf(en.target);
          if (en.isIntersecting) { if (i === -1) order.push(en.target); }
          else if (i !== -1) order.splice(i, 1);
        });
        apply();
      }, { rootMargin: margin, threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
    }
    build();
    window.addEventListener("resize", build);
  }

  /* ---------------- project cards: pointer-driven open state ----------------
     mouseenter/mouseleave don't fire when content moves under a still
     cursor (scrolling, or the pinned horizontal story translating). So the
     last pointer position is tracked globally and, on mouse move and on
     scroll, the element under it is re-checked with elementFromPoint. The
     story's tween is scrubbed (it keeps moving after the last scroll
     event), so re-checking continues per frame for a short window. */
  function initProjectHover() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var desktop = window.matchMedia(DESKTOP_QUERY);
    var track = document.querySelector(".projects__track");
    if (!track) return;
    var x = -1, y = -1, current = null, until = 0, looping = false;

    function setOpen(card) {
      if (card === current) return;
      if (current) current.classList.remove("is-open");
      current = card;
      if (current) current.classList.add("is-open");
      track.classList.toggle("has-open", !!current);
    }
    function sync() {
      if (!desktop.matches || x < 0) { setOpen(null); return; }
      var el = document.elementFromPoint(x, y);
      var card = el && el.closest ? el.closest(".project-card") : null;
      setOpen(card && track.contains(card) ? card : null);
    }
    function loop() {
      sync();
      if (performance.now() < until) requestAnimationFrame(loop); else looping = false;
    }
    function kick(ms) {
      until = Math.max(until, performance.now() + ms);
      if (!looping) { looping = true; requestAnimationFrame(loop); }
    }

    window.addEventListener("mousemove", function (e) { x = e.clientX; y = e.clientY; kick(60); }, { passive: true });
    document.addEventListener("mouseleave", function () { x = y = -1; sync(); });
    window.addEventListener("scroll", function () { kick(1600); }, { passive: true });
    window.addEventListener("resize", function () { kick(200); });
  }

  /* ---------------- desktop: the pinned horizontal story ---------------- */
  function initStoryDesktop() {
    var story = document.getElementById("story");
    var track = document.getElementById("storyTrack");
    if (!story || !track || !hasGSAP) return function () {};

    var travel = Math.max(0, track.scrollWidth - window.innerWidth);

    var storyTween = gsap.to(track, { x: -travel, ease: "none", duration: 1 });

    // bottom-left label swaps to name whichever panel currently spans the
    // viewport's horizontal CENTER — "Home", "Studio", "Service", etc. —
    // so it names whatever's actually dominant on screen, not whichever
    // panel just barely started crossing the left edge.
    var breadcrumb = document.getElementById("breadcrumb");
    var labelPanels = Array.prototype.slice.call(document.querySelectorAll(".h-panel[data-label]"));
    var currentLabel = breadcrumb ? breadcrumb.textContent : "";
    function updateSectionLabel() {
      if (!breadcrumb) return;
      var mid = window.innerWidth / 2;
      for (var i = 0; i < labelPanels.length; i++) {
        var r = labelPanels[i].getBoundingClientRect();
        if (r.left <= mid && r.right > mid) {
          var lbl = labelPanels[i].getAttribute("data-label");
          if (lbl !== currentLabel) { currentLabel = lbl; breadcrumb.textContent = lbl; }
          return;
        }
      }
    }

    var mainTrigger = ScrollTrigger.create({
      animation: storyTween,
      trigger: story,
      start: "top top",
      end: function () { return "+=" + travel; },
      scrub: 1,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: updateSectionLabel,
      onRefresh: updateSectionLabel
    });
    updateSectionLabel();

    var created = [mainTrigger];

    function nested(triggerEl, startPct, onEnter) {
      if (!triggerEl) return;
      created.push(ScrollTrigger.create({
        containerAnimation: storyTween,
        trigger: triggerEl,
        start: startPct || "0% 75%",
        once: true,
        onEnter: onEnter
      }));
    }

    // text drift: headline text moves a little on its own as its panel
    // transits the viewport — layered on top of the char/line reveal, not
    // a replacement for it. This is the "text moves left and right on
    // scroll" read a horizontal-scroll site gives you.
    document.querySelectorAll("[data-parallax]").forEach(function (el) {
      var amount = parseFloat(el.getAttribute("data-parallax")) || 20;
      var panel = el.closest(".h-panel");
      if (!panel) return;
      var driftTween = gsap.fromTo(el, { x: -amount }, { x: amount, ease: "none" });
      created.push(ScrollTrigger.create({
        containerAnimation: storyTween,
        trigger: panel,
        start: "0% 100%",
        end: "100% 0%",
        scrub: true,
        animation: driftTween
      }));
    });

    // hero reveals right after the preloader (time-based, not scroll-linked)
    var hero = document.querySelector(".h-panel--hero");
    setTimeout(function () {
      revealLines(hero, { delay: 0 });
      gsap.to(hero.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", delay: 0.3 });
      hero.querySelectorAll(".media-wipe").forEach(function (el) { el.classList.add("is-revealed"); });
    }, 500);

    // bleed 1
    nested(document.querySelectorAll(".h-panel--bleed")[0].querySelector(".media-wipe"), "0% 80%", function (self) {
      self.trigger.classList.add("is-revealed");
    });

    // statement
    var statement = document.querySelector(".h-panel--statement");
    nested(statement, "0% 75%", function () {
      revealLines(statement);
      gsap.to(statement.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", stagger: 0.1, delay: 0.25 });
    });

    // services
    var services = document.querySelector(".h-panel--services");
    nested(services, "0% 75%", function () {
      revealLines(services.querySelector("[data-split-lines]"));
      gsap.to(services.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", delay: 0.15 });
      gsap.from(services.querySelectorAll(".service-row"), { opacity: 0, y: 20, duration: 0.6, ease: "expo.out", stagger: 0.08, delay: 0.2 });
    });

    // duo
    var duo = document.querySelector(".h-panel--duo");
    nested(duo, "0% 70%", function () {
      duo.querySelectorAll(".media-wipe").forEach(function (el, i) {
        setTimeout(function () { el.classList.add("is-revealed"); }, i * 150);
      });
      revealLines(duo, { delay: 0.2 });
      gsap.to(duo.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", delay: 0.4 });
    });

    // bleed 2 (warm)
    var bleed2 = document.querySelectorAll(".h-panel--bleed")[1];
    if (bleed2) nested(bleed2.querySelector(".media-wipe"), "0% 80%", function (self) { self.trigger.classList.add("is-revealed"); });

    // values
    var values = document.querySelector(".h-panel--values");
    nested(values, "0% 78%", function () {
      gsap.to(values.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" });
      gsap.from(values.querySelectorAll(".value-row"), { opacity: 0, y: 30, duration: 0.8, ease: "expo.out", stagger: 0.12, delay: 0.1 });
    });

    // stats
    var stats = document.querySelector(".h-panel--stats");
    nested(stats, "0% 75%", function () {
      gsap.to(stats.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" });
      gsap.from(stats.querySelectorAll(".stat"), { opacity: 0, y: 20, duration: 0.7, ease: "expo.out", stagger: 0.1, delay: 0.1 });
    });

    // projects — this is the LAST panel in the track (the horizontal story
    // ends here on purpose; everything after runs as normal vertical
    // scroll), so its start point must land well before the container's
    // progress hits 1.0 or the auto-computed end overshoots 1.0 and the
    // trigger can never fire.
    var projects = document.querySelector(".h-panel--projects");
    nested(projects, "0% 96%", function () {
      revealLines(projects.querySelector("[data-split-lines]"));
      gsap.from(projects.querySelectorAll(".project-card"), { opacity: 0, y: 30, duration: 0.7, ease: "expo.out", stagger: 0.08, delay: 0.15 });
    });

    return function () {
      created.forEach(function (t) { t.kill(); });
      gsap.set(track, { x: 0 });
    };
  }

  /* ---------------- mobile / tablet: plain vertical reveals ---------------- */
  function initStoryMobile() {
    if (!hasGSAP) {
      document.querySelectorAll("[data-split-lines] .line__inner, [data-reveal]").forEach(function (el) {
        el.style.transform = "none"; el.style.opacity = "1"; el.classList.add("is-in");
      });
      document.querySelectorAll(".media-wipe").forEach(function (el) { el.classList.add("is-revealed"); });
      return function () {};
    }

    var created = [];
    var hero = document.querySelector(".h-panel--hero");

    setTimeout(function () {
      revealLines(hero);
      gsap.to(hero.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", delay: 0.3 });
      hero.querySelectorAll(".media-wipe").forEach(function (el) { el.classList.add("is-revealed"); });
    }, 500);

    document.querySelectorAll(".h-panel").forEach(function (panel) {
      if (panel === hero) return;

      panel.querySelectorAll(".media-wipe").forEach(function (el) {
        created.push(ScrollTrigger.create({
          trigger: el, start: "top 82%", once: true,
          onEnter: function () { el.classList.add("is-revealed"); }
        }));
      });

      var splitScope = panel.querySelector("[data-split-lines]") || (panel.hasAttribute("data-split-lines") ? panel : null);
      if (splitScope) {
        created.push(ScrollTrigger.create({
          trigger: splitScope, start: "top 85%", once: true,
          onEnter: function () { revealLines(splitScope); }
        }));
      }

      var reveals = panel.querySelectorAll("[data-reveal]");
      if (reveals.length) {
        created.push(ScrollTrigger.create({
          trigger: panel, start: "top 88%", once: true,
          onEnter: function () { reveals.forEach(function (el) { el.classList.add("is-in"); }); }
        }));
      }

      if (panel.querySelector(".value-row")) {
        var items = panel.querySelectorAll(".value-row");
        created.push(ScrollTrigger.create({
          trigger: panel, start: "top 80%", once: true,
          onEnter: function () { gsap.from(items, { opacity: 0, y: 20, duration: 0.6, ease: "expo.out", stagger: 0.1 }); }
        }));
      }

      if (panel.classList.contains("h-panel--projects")) {
        var cards = panel.querySelectorAll(".project-card");
        created.push(ScrollTrigger.create({
          trigger: panel, start: "top 75%", once: true,
          onEnter: function () { gsap.from(cards, { opacity: 0, y: 24, duration: 0.6, ease: "expo.out", stagger: 0.08 }); }
        }));
      }
    });

    return function () { created.forEach(function (t) { t.kill(); }); };
  }

  /* ---------------- view-all / closing / CTA / footer (always normal
     vertical scroll, outside the pinned horizontal story on every
     breakpoint) ---------------- */
  function initTailReveals() {
    var scopeEls = document.querySelectorAll(".view-all, .closing, .cta, .footer");
    scopeEls.forEach(function (scope) {
      scope.querySelectorAll(".media-wipe").forEach(function (el) {
        if (!hasGSAP || reduceMotion) { el.classList.add("is-revealed"); return; }
        ScrollTrigger.create({
          trigger: el, start: "top 82%", once: true,
          onEnter: function () { el.classList.add("is-revealed"); }
        });
      });
      var splitEl = scope.querySelector("[data-split-lines]");
      if (splitEl) {
        if (!hasGSAP || reduceMotion) {
          revealLines(splitEl);
        } else {
          ScrollTrigger.create({
            trigger: splitEl, start: "top 85%", once: true,
            onEnter: function () { revealLines(splitEl); }
          });
        }
      }
      var reveals = scope.querySelectorAll("[data-reveal]");
      if (reveals.length) {
        if (!hasGSAP || reduceMotion) {
          reveals.forEach(function (el) { el.classList.add("is-in"); });
        } else {
          ScrollTrigger.create({
            trigger: scope, start: "top 88%", once: true,
            onEnter: function () { reveals.forEach(function (el) { el.classList.add("is-in"); }); }
          });
        }
      }
    });
  }

  /* ---------------- Lenis smooth scroll ---------------- */
  function initLenis() {
    if (typeof window.Lenis === "undefined" || reduceMotion) return;
    var lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })();
    }
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    prepSplitLines();
    initMobileMenu();
    initMagneticButtons();
    initApproachCursorImage();
    initServicesDot();
    initNavTheme();
    initProjectHover();
    initContactForm();

    runPreloader(function () {
      initLenis();
      initTailReveals();

      if (hasGSAP) {
        ScrollTrigger.matchMedia({
          "(min-width: 951px)": initStoryDesktop,
          "(max-width: 950px)": initStoryMobile
        });
        ScrollTrigger.refresh();
      } else {
        document.querySelectorAll(".line__inner, [data-reveal]").forEach(function (el) {
          el.style.transform = "none"; el.style.opacity = "1"; el.classList.add("is-in");
        });
        document.querySelectorAll(".media-wipe").forEach(function (el) { el.classList.add("is-revealed"); });
      }
    });
  });
})();
