(function () {
  'use strict';

  /* ============================
     Space Simulation
     ============================ */
  var canvas = document.getElementById('particleCanvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var isMobile = window.innerWidth < 768;
  var W, H;

  /* -- State -- */
  var stars = [];
  var shootingStars = [];
  var flashes = [];
  var solarFlares = [];
  var mouse = { x: -1000, y: -1000, down: false, prevX: 0, prevY: 0 };
  var dragStar = null;
  var scrollY = 0;
  var lastScrollY = 0;
  var time = 0;
  var dyingStarPulse = 0;

  /* -- Config -- */
  // Layer 0=dust, 1=far, 2=mid, 3=near (4 layers now)
  var STAR_COUNTS = isMobile ? [250, 200, 130, 60] : [600, 400, 250, 120];
  var LAYER_SPEEDS = [0.005, 0.015, 0.06, 0.18]; // stronger parallax separation
  var BH_RADIUS = isMobile ? 80 : 150; // slightly smaller
  var BH_GRAVITY = 0.15;
  var BH_ABSORB = 18;
  var GRAVITY_CURSOR_RADIUS = 200;
  var GRAVITY_CURSOR_STRENGTH = 0.08;
  var STAR_COLORS = [
    'rgba(255,255,255,', 'rgba(255,255,255,',
    'rgba(200,220,255,', 'rgba(180,200,255,',
    'rgba(255,240,220,', 'rgba(255,200,200,',
    'rgba(200,255,240,'
  ];

  // Star cluster positions (relative to canvas, seeded once)
  var starClusters = [];
  // Distant galaxy
  var galaxy = null;
  // Dust belt particles
  var dustBelt = [];
  // Meteor shower state
  var meteorShower = { active: false, meteors: [], cooldown: 0, radiantX: 0, radiantY: 0 };
  // Blitzar event state (supernova remnant)
  var blitzar = { cooldown: 1, active: false, phase: 0, x: 0, y: 0, maxR: 0, filaments: [], blueBlobs: [], internalWisps: [] };
  // Magnetar pulse state
  var magnetarPulse = 0;
  var magnetarEruptAngle = -2.3 + Math.PI / 2;
  var magnetarLastPulseHigh = false;

  function resizeCanvas() {
    if (!canvas) return;
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  /* -- Black hole position (right side) -- */
  function bhPos() {
    return { x: W * 0.85, y: H * 0.4 };
  }

  /* -- Star creation -- */
  function createStar(layer, x, y) {
    // 4 layers: 0=dust, 1=far, 2=mid, 3=near
    var radii = [0.3, 0.5, 1.0, 1.8];
    var opacities = [0.15, 0.25, 0.5, 0.8];
    var r = radii[layer] + Math.random() * radii[layer] * 0.6;
    return {
      x: x !== undefined ? x : Math.random() * W,
      y: y !== undefined ? y : Math.random() * H,
      vx: layer <= 1 ? 0 : (Math.random() - 0.5) * 0.15,
      vy: layer <= 1 ? 0 : (Math.random() - 0.5) * 0.15,
      radius: r,
      baseOpacity: opacities[layer] + Math.random() * (layer === 3 ? 0.2 : 0.1),
      twinkleSpeed: 0.3 + Math.random() * (layer === 0 ? 1 : 2.5),
      twinklePhase: Math.random() * Math.PI * 2,
      layer: layer,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      draggable: layer === 3, // only near-layer stars are draggable
      // Random twinkle flash timing (occasional bright flare)
      flashTimer: Math.random() * 200,
      flashDuration: 0
    };
  }

  function initStars() {
    stars = [];
    for (var l = 0; l < 4; l++) {
      for (var i = 0; i < STAR_COUNTS[l]; i++) {
        stars.push(createStar(l));
      }
    }
    // Create star clusters (2-3 dense groups)
    initStarClusters();
    // Create distant spiral galaxy
    initGalaxy();
    // Create dust belt
    initDustBelt();
    // Create primordial black holes
    initPrimordialBHs();
  }

  function initStarClusters() {
    starClusters = [];
    var clusterCount = isMobile ? 2 : 3;
    for (var c = 0; c < clusterCount; c++) {
      var cx = 0.15 + Math.random() * 0.7;
      var cy = 0.1 + Math.random() * 0.8;
      var cluster = { x: cx, y: cy, stars: [] };
      var count = 15 + Math.floor(Math.random() * 10);
      for (var i = 0; i < count; i++) {
        // Gaussian-ish distribution around center
        var angle = Math.random() * Math.PI * 2;
        var dist = (Math.random() + Math.random()) * 0.5; // tends toward center
        var spread = isMobile ? 30 : 50;
        cluster.stars.push({
          ox: Math.cos(angle) * dist * spread,
          oy: Math.sin(angle) * dist * spread,
          radius: 0.3 + Math.random() * 0.7,
          opacity: 0.2 + Math.random() * 0.5,
          twinkleSpeed: 0.5 + Math.random() * 2,
          twinklePhase: Math.random() * Math.PI * 2,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
        });
      }
      starClusters.push(cluster);
    }
  }

  function initGalaxy() {
    galaxy = {
      x: 0.65 + Math.random() * 0.2,
      y: 0.08 + Math.random() * 0.15,
      rotation: Math.random() * Math.PI,
      radiusX: isMobile ? 40 : 70,
      radiusY: isMobile ? 15 : 25,
      armCount: 2,
      armStars: 60
    };
  }

  /* -- Dust belt -- */
  function initDustBelt() {
    dustBelt = [];
    var count = isMobile ? 120 : 250;
    for (var i = 0; i < count; i++) {
      // Distribute along an elliptical arc across the canvas
      var t = Math.random(); // 0-1 along the belt
      var angle = -0.6 + t * 1.2; // arc angle range
      // Elliptical path: wide horizontal, narrow vertical
      var beltCenterX = 0.5;
      var beltCenterY = 0.55;
      var radiusX = isMobile ? 0.55 : 0.6;
      var radiusY = isMobile ? 0.15 : 0.18;
      // Spread perpendicular to belt
      var spread = (Math.random() - 0.5) * (isMobile ? 0.06 : 0.08);
      var px = beltCenterX + Math.cos(angle) * radiusX;
      var py = beltCenterY + Math.sin(angle) * radiusY + spread;
      dustBelt.push({
        relX: px,
        relY: py,
        radius: 0.3 + Math.random() * 0.8,
        opacity: 0.08 + Math.random() * 0.18,
        drift: (Math.random() - 0.5) * 0.08, // slow drift speed
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.2 + Math.random() * 0.8,
        // Warm dust colors
        color: Math.random() < 0.6
          ? 'rgba(180,160,140,' // brownish
          : (Math.random() < 0.5
            ? 'rgba(160,150,170,' // purple-grey
            : 'rgba(200,180,150,') // warm gold
      });
    }
  }

  /* -- Draw dust belt -- */
  function drawDustBelt() {
    // Faint glow along belt path
    ctx.save();
    ctx.translate(W * 0.5, H * 0.55);
    ctx.rotate(-0.1);
    var beltRadX = W * (isMobile ? 0.55 : 0.6);
    var beltRadY = H * (isMobile ? 0.15 : 0.18);

    // Belt glow
    ctx.beginPath();
    ctx.ellipse(0, 0, beltRadX, beltRadY, 0, -0.6, 0.6);
    ctx.strokeStyle = 'rgba(160, 140, 120, 0.04)';
    ctx.lineWidth = isMobile ? 30 : 50;
    ctx.stroke();

    // Inner brighter core
    ctx.beginPath();
    ctx.ellipse(0, 0, beltRadX, beltRadY, 0, -0.6, 0.6);
    ctx.strokeStyle = 'rgba(180, 160, 140, 0.025)';
    ctx.lineWidth = isMobile ? 12 : 20;
    ctx.stroke();
    ctx.restore();

    // Draw individual dust particles
    for (var i = 0; i < dustBelt.length; i++) {
      var d = dustBelt[i];
      var dx = d.relX * W + Math.sin(time * d.drift + d.twinklePhase) * 3;
      var dy = d.relY * H + scrollY * 0.03; // subtle parallax
      dy = ((dy % H) + H) % H;

      var twinkle = Math.sin(time * d.twinkleSpeed + d.twinklePhase);
      var op = d.opacity + twinkle * 0.05;
      op = Math.max(0.03, Math.min(0.3, op));

      ctx.fillStyle = d.color + op + ')';
      ctx.fillRect(dx - d.radius * 0.5, dy - d.radius * 0.5, d.radius, d.radius);
    }
  }

  /* -- Meteor shower -- */
  function spawnMeteorShower() {
    // Pick a radiant point (where all meteors appear to come from)
    meteorShower.radiantX = 0.2 + Math.random() * 0.6;
    meteorShower.radiantY = 0.05 + Math.random() * 0.2;
    meteorShower.active = true;

    var count = 8 + Math.floor(Math.random() * 8); // 8-15 meteors
    var rx = meteorShower.radiantX * W;
    var ry = meteorShower.radiantY * H;

    for (var i = 0; i < count; i++) {
      // Stagger spawn times so they don't all appear at once
      var delay = Math.random() * 1.5; // 0-1.5 seconds stagger
      var baseAngle = Math.atan2(H * 0.5 - ry, W * 0.5 - rx); // roughly outward from radiant
      var angle = baseAngle + (Math.random() - 0.5) * 1.8; // wide spread from radiant
      var speed = 5 + Math.random() * 8;
      meteorShower.meteors.push({
        x: rx + Math.cos(angle) * (10 + Math.random() * 40),
        y: ry + Math.sin(angle) * (10 + Math.random() * 40),
        angle: angle,
        speed: speed,
        length: 60 + Math.random() * 80,
        opacity: 0,
        life: 1,
        delay: delay,
        // Some meteors are brighter/bigger
        brightness: 0.5 + Math.random() * 0.5,
        width: 1 + Math.random() * 1.5
      });
    }
  }

  function updateAndDrawMeteorShower() {
    // Cooldown timer for next shower
    if (!meteorShower.active && meteorShower.meteors.length === 0) {
      meteorShower.cooldown -= 0.016;
      if (meteorShower.cooldown <= 0) {
        // Random chance to trigger a shower
        if (Math.random() < 0.002) {
          spawnMeteorShower();
          meteorShower.cooldown = 15 + Math.random() * 25; // 15-40s between showers
        }
      }
    }

    // Draw radiant glow when shower is active
    if (meteorShower.active && meteorShower.meteors.length > 0) {
      var rx = meteorShower.radiantX * W;
      var ry = meteorShower.radiantY * H;
      var radGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, 40);
      radGrad.addColorStop(0, 'rgba(200, 220, 255, 0.06)');
      radGrad.addColorStop(1, 'rgba(150, 180, 255, 0)');
      ctx.beginPath();
      ctx.arc(rx, ry, 40, 0, Math.PI * 2);
      ctx.fillStyle = radGrad;
      ctx.fill();
    }

    for (var i = meteorShower.meteors.length - 1; i >= 0; i--) {
      var m = meteorShower.meteors[i];

      // Handle delay before meteor appears
      if (m.delay > 0) {
        m.delay -= 0.016;
        continue;
      }

      m.life -= 0.015;
      // Fade in then out
      if (m.life > 0.85) {
        m.opacity = (1 - m.life) / 0.15; // fade in
      } else {
        m.opacity = Math.max(0, m.life / 0.85); // fade out
      }

      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;

      if (m.life <= 0 || m.x < -50 || m.x > W + 50 || m.y > H + 50) {
        meteorShower.meteors.splice(i, 1);
        continue;
      }

      var mOp = m.opacity * m.brightness;

      // Trail
      var tailX = m.x - Math.cos(m.angle) * m.length;
      var tailY = m.y - Math.sin(m.angle) * m.length;
      var trailGrad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      trailGrad.addColorStop(0, 'rgba(255, 255, 255, ' + mOp * 0.8 + ')');
      trailGrad.addColorStop(0.15, 'rgba(200, 220, 255, ' + mOp * 0.5 + ')');
      trailGrad.addColorStop(0.4, 'rgba(150, 180, 255, ' + mOp * 0.15 + ')');
      trailGrad.addColorStop(1, 'rgba(100, 140, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = m.width;
      ctx.stroke();

      // Bright head
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.width, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + mOp + ')';
      ctx.fill();

      // Head glow
      if (m.brightness > 0.7) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.width * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 220, 255, ' + mOp * 0.15 + ')';
        ctx.fill();
      }
    }

    // Check if shower is done
    if (meteorShower.active && meteorShower.meteors.length === 0) {
      meteorShower.active = false;
    }
  }

  /* -- Shooting stars -- */
  function spawnShootingStar(scrollSpeed) {
    var baseSpeed = 6 + Math.random() * 5;
    var speedMult = scrollSpeed ? Math.min(scrollSpeed / 30, 3) : 1;
    var angle = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5);
    shootingStars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.5,
      angle: angle,
      speed: baseSpeed * (0.6 + speedMult * 0.6),
      length: (80 + Math.random() * 70) * (0.7 + speedMult * 0.3),
      opacity: 1,
      life: 1
    });
  }

  /* -- Flash effect (when star absorbed) -- */
  function spawnFlash(x, y) {
    flashes.push({ x: x, y: y, radius: 3, opacity: 1 });
  }

  /* -- Click to spawn burst -- */
  function spawnBurst(x, y) {
    var count = 6 + Math.floor(Math.random() * 5);
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      var speed = 1.5 + Math.random() * 2;
      var s = createStar(2, x, y);
      s.vx = Math.cos(angle) * speed;
      s.vy = Math.sin(angle) * speed;
      s.radius = 1 + Math.random() * 1.5;
      stars.push(s);
    }
  }

  /* -- Draw black hole -- */
  function drawBlackHole(bh, opacity) {
    if (opacity <= 0) return;
    var rotation = time * 0.3;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(bh.x, bh.y);

    // Outer glow
    var pulse = 1 + Math.sin(time * 0.8) * 0.03;
    var grad = ctx.createRadialGradient(0, 0, BH_RADIUS * 0.3, 0, 0, BH_RADIUS * 1.2 * pulse);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.4, 'rgba(139, 92, 246, 0.06)');
    grad.addColorStop(0.7, 'rgba(0, 212, 255, 0.04)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, BH_RADIUS * 1.2 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Accretion disk (tilted ellipse)
    ctx.save();
    ctx.rotate(rotation);
    ctx.scale(1, 0.35); // tilt perspective

    // Outer ring
    for (var ring = 3; ring >= 0; ring--) {
      var r = BH_RADIUS * (0.5 + ring * 0.18);
      var ringGrad = ctx.createRadialGradient(0, 0, r * 0.85, 0, 0, r);
      var hue = 200 + ring * 40; // cyan to pink
      ringGrad.addColorStop(0, 'hsla(' + hue + ', 80%, 60%, 0.15)');
      ringGrad.addColorStop(0.5, 'hsla(' + hue + ', 70%, 50%, 0.08)');
      ringGrad.addColorStop(1, 'hsla(' + hue + ', 60%, 40%, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = ringGrad;
      ctx.fill();
    }

    // Bright inner ring (event horizon glow)
    ctx.beginPath();
    ctx.arc(0, 0, BH_RADIUS * 0.32, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Dark center (event horizon)
    var centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, BH_RADIUS * 0.28);
    centerGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    centerGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.95)');
    centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, BH_RADIUS * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = centerGrad;
    ctx.fill();

    // Lensing ring (photon sphere)
    ctx.beginPath();
    ctx.arc(0, 0, BH_RADIUS * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /* -- Sun position (left side) -- */
  function sunPos() {
    return { x: W * 0.12, y: H * 0.35 };
  }

  /* -- Dying star position (upper-center area) -- */
  function dyingStarPos() {
    return { x: W * 0.45, y: H * 0.18 };
  }

  /* -- Draw Sun -- */
  function drawSun(pos, opacity) {
    if (opacity <= 0) return;
    var SUN_RADIUS = isMobile ? 25 : 40;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(pos.x, pos.y);

    // Corona rays
    var rayCount = 12;
    for (var i = 0; i < rayCount; i++) {
      var angle = (Math.PI * 2 / rayCount) * i + time * 0.15;
      var rayLen = SUN_RADIUS * (1.8 + Math.sin(time * 1.5 + i * 0.7) * 0.5);
      var rayGrad = ctx.createLinearGradient(0, 0, Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
      rayGrad.addColorStop(0, 'rgba(255, 200, 50, 0.2)');
      rayGrad.addColorStop(0.5, 'rgba(255, 160, 20, 0.06)');
      rayGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = 3 + Math.sin(time * 2 + i) * 1.5;
      ctx.stroke();
    }

    // Outer glow (bigger glow for smaller body = more realistic)
    var glowGrad = ctx.createRadialGradient(0, 0, SUN_RADIUS * 0.2, 0, 0, SUN_RADIUS * 4);
    glowGrad.addColorStop(0, 'rgba(255, 200, 60, 0.3)');
    glowGrad.addColorStop(0.2, 'rgba(255, 160, 40, 0.15)');
    glowGrad.addColorStop(0.5, 'rgba(255, 100, 10, 0.05)');
    glowGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, SUN_RADIUS * 4, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Sun body
    var bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, SUN_RADIUS);
    bodyGrad.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
    bodyGrad.addColorStop(0.5, 'rgba(255, 200, 80, 0.7)');
    bodyGrad.addColorStop(0.8, 'rgba(255, 140, 30, 0.5)');
    bodyGrad.addColorStop(1, 'rgba(255, 80, 0, 0.2)');
    ctx.beginPath();
    ctx.arc(0, 0, SUN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.restore();
  }

  /* -- Spawn solar flare -- */
  function spawnSolarFlare() {
    var pos = sunPos();
    var SUN_RADIUS = isMobile ? 25 : 40;
    var angle = Math.random() * Math.PI * 2;
    solarFlares.push({
      x: pos.x + Math.cos(angle) * SUN_RADIUS * 0.8,
      y: pos.y + Math.sin(angle) * SUN_RADIUS * 0.8,
      angle: angle,
      arcHeight: SUN_RADIUS * (1.5 + Math.random() * 2),
      life: 1,
      speed: 0.008 + Math.random() * 0.006,
      width: 2 + Math.random() * 2
    });
  }

  /* -- Draw solar flares -- */
  function drawSolarFlares(opacity) {
    if (opacity <= 0) return;
    var pos = sunPos();
    var SUN_RADIUS = isMobile ? 25 : 40;

    for (var i = solarFlares.length - 1; i >= 0; i--) {
      var f = solarFlares[i];
      f.life -= f.speed;
      if (f.life <= 0) {
        solarFlares.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = opacity * f.life * 0.7;

      // Draw arc from sun surface
      var progress = 1 - f.life;
      var arcX = pos.x + Math.cos(f.angle) * (SUN_RADIUS * 0.8 + f.arcHeight * Math.sin(progress * Math.PI));
      var arcY = pos.y + Math.sin(f.angle) * (SUN_RADIUS * 0.8 + f.arcHeight * Math.sin(progress * Math.PI));

      // Flare trail
      var grad = ctx.createRadialGradient(arcX, arcY, 0, arcX, arcY, 15);
      grad.addColorStop(0, 'rgba(255, 200, 50, 0.6)');
      grad.addColorStop(0.5, 'rgba(255, 100, 20, 0.2)');
      grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.beginPath();
      ctx.arc(arcX, arcY, 12 * f.life, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Bright head
      ctx.beginPath();
      ctx.arc(arcX, arcY, f.width * f.life, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 240, 200, ' + (f.life * 0.8) + ')';
      ctx.fill();

      ctx.restore();
    }
  }

  /* -- Draw Dying Star (red giant, pulsing) -- */
  function drawDyingStar(pos, opacity) {
    if (opacity <= 0) return;
    var BASE_RADIUS = isMobile ? 12 : 20;

    // Irregular pulsing
    dyingStarPulse += 0.016;
    var pulse = 1 + Math.sin(dyingStarPulse * 1.2) * 0.15
                  + Math.sin(dyingStarPulse * 3.1) * 0.05
                  + Math.sin(dyingStarPulse * 7.3) * 0.03;
    var r = BASE_RADIUS * pulse;

    // Flicker (random opacity variation)
    var flicker = 0.85 + Math.random() * 0.15;

    ctx.save();
    ctx.globalAlpha = opacity * flicker;
    ctx.translate(pos.x, pos.y);

    // Outer nebula shell (expanding gas - bigger glow)
    var shellGrad = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 5);
    shellGrad.addColorStop(0, 'rgba(255, 60, 30, 0.15)');
    shellGrad.addColorStop(0.2, 'rgba(220, 50, 60, 0.08)');
    shellGrad.addColorStop(0.5, 'rgba(150, 20, 60, 0.03)');
    shellGrad.addColorStop(1, 'rgba(100, 10, 40, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 5, 0, Math.PI * 2);
    ctx.fillStyle = shellGrad;
    ctx.fill();

    // Star body (deep red shifting to orange)
    var bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    bodyGrad.addColorStop(0, 'rgba(255, 200, 150, 0.8)');
    bodyGrad.addColorStop(0.3, 'rgba(255, 100, 40, 0.7)');
    bodyGrad.addColorStop(0.7, 'rgba(200, 40, 20, 0.5)');
    bodyGrad.addColorStop(1, 'rgba(150, 20, 10, 0.1)');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Hot core
    var coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
    coreGrad.addColorStop(0, 'rgba(255, 255, 220, 0.6)');
    coreGrad.addColorStop(1, 'rgba(255, 180, 100, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.restore();
  }

  /* -- Draw galactic band (milky way streak) -- */
  function drawGalacticBand() {
    ctx.save();
    // Diagonal band across canvas
    var grad = ctx.createLinearGradient(0, H * 0.7, W, H * 0.1);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.2, 'rgba(60, 70, 120, 0.015)');
    grad.addColorStop(0.35, 'rgba(80, 90, 150, 0.035)');
    grad.addColorStop(0.5, 'rgba(100, 110, 170, 0.04)');
    grad.addColorStop(0.65, 'rgba(80, 90, 150, 0.035)');
    grad.addColorStop(0.8, 'rgba(60, 70, 120, 0.015)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    // Draw as a wide rotated rectangle
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(-0.35);
    ctx.fillRect(-W, -H * 0.15, W * 2, H * 0.3);
    ctx.restore();

    // Add a warmer inner core to the band
    ctx.save();
    var innerGrad = ctx.createLinearGradient(0, H * 0.65, W, H * 0.15);
    innerGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    innerGrad.addColorStop(0.3, 'rgba(120, 100, 160, 0.012)');
    innerGrad.addColorStop(0.5, 'rgba(140, 120, 180, 0.02)');
    innerGrad.addColorStop(0.7, 'rgba(120, 100, 160, 0.012)');
    innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = innerGrad;
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(-0.35);
    ctx.fillRect(-W, -H * 0.06, W * 2, H * 0.12);
    ctx.restore();
  }

  /* -- Draw distant spiral galaxy -- */
  function drawSpiralGalaxy() {
    if (!galaxy) return;
    var gx = galaxy.x * W;
    var gy = galaxy.y * H + scrollY * LAYER_SPEEDS[0]; // parallax with dust layer
    gy = ((gy % H) + H) % H;

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(galaxy.rotation + time * 0.02); // slow rotation

    // Core glow
    var coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, galaxy.radiusX * 0.3);
    coreGrad.addColorStop(0, 'rgba(200, 190, 255, 0.12)');
    coreGrad.addColorStop(0.5, 'rgba(160, 150, 220, 0.05)');
    coreGrad.addColorStop(1, 'rgba(120, 110, 180, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, galaxy.radiusX * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Spiral arms (draw as dots along spiral paths)
    for (var arm = 0; arm < galaxy.armCount; arm++) {
      var armOffset = (Math.PI * 2 / galaxy.armCount) * arm;
      for (var j = 0; j < galaxy.armStars; j++) {
        var t = j / galaxy.armStars;
        var spiralAngle = armOffset + t * Math.PI * 2.5;
        var r = t * galaxy.radiusX;
        var spread = 3 + t * 8;
        var sx = Math.cos(spiralAngle) * r + (Math.random() - 0.5) * spread;
        var sy = Math.sin(spiralAngle) * r * (galaxy.radiusY / galaxy.radiusX) + (Math.random() - 0.5) * spread * 0.4;
        var starOp = (1 - t * 0.7) * 0.15;
        ctx.fillStyle = 'rgba(200, 195, 255, ' + starOp + ')';
        ctx.fillRect(sx - 0.4, sy - 0.4, 0.8, 0.8);
      }
    }

    // Outer halo
    var haloGrad = ctx.createRadialGradient(0, 0, galaxy.radiusX * 0.5, 0, 0, galaxy.radiusX * 1.2);
    haloGrad.addColorStop(0, 'rgba(150, 140, 200, 0.02)');
    haloGrad.addColorStop(1, 'rgba(100, 90, 160, 0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, galaxy.radiusX * 1.2, galaxy.radiusY * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.fill();

    ctx.restore();
  }

  /* -- Draw star clusters -- */
  function drawStarClusters() {
    for (var c = 0; c < starClusters.length; c++) {
      var cl = starClusters[c];
      var cx = cl.x * W;
      var cy = cl.y * H + scrollY * LAYER_SPEEDS[1]; // parallax with far layer
      cy = ((cy % H) + H) % H;

      // Faint cluster glow
      var clGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, isMobile ? 35 : 55);
      clGrad.addColorStop(0, 'rgba(180, 190, 255, 0.04)');
      clGrad.addColorStop(1, 'rgba(100, 110, 180, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, isMobile ? 35 : 55, 0, Math.PI * 2);
      ctx.fillStyle = clGrad;
      ctx.fill();

      for (var j = 0; j < cl.stars.length; j++) {
        var cs = cl.stars[j];
        var twinkle = Math.sin(time * cs.twinkleSpeed + cs.twinklePhase);
        var op = cs.opacity + twinkle * 0.15;
        op = Math.max(0.05, Math.min(0.7, op));
        ctx.fillStyle = cs.color + op + ')';
        ctx.fillRect(cx + cs.ox - cs.radius * 0.5, cy + cs.oy - cs.radius * 0.5, cs.radius, cs.radius);
      }
    }
  }

  /* -- Quasar (distant, ultra-bright core with jets) -- */
  function quasarPos() {
    return { x: W * 0.28, y: H * 0.72 };
  }

  // Quasar: pre-rendered nebula cloud on offscreen canvas + dynamic sparkles
  var quasarOffscreen = null;
  var quasarSparkles = [];
  var quasarCloudReady = false;

  function initQuasarCloud() {
    var QR = isMobile ? 55 : 100;
    var canvasSize = QR * 5;

    quasarOffscreen = document.createElement('canvas');
    quasarOffscreen.width = canvasSize;
    quasarOffscreen.height = canvasSize;
    var oc = quasarOffscreen.getContext('2d');

    var cx = canvasSize / 2;
    var cy = canvasSize / 2;

    // --- Layer 1: Large diffuse fog blobs (base cloud substance) ---
    // Each blob is a radial gradient circle that fades to transparent.
    // Overlapping hundreds of these creates a smooth, painted cloud.
    var fogCount = isMobile ? 90 : 220;
    for (var i = 0; i < fogCount; i++) {
      var baseAngle = Math.random() * Math.PI * 2;
      var rNorm = Math.pow(Math.random(), 0.4); // concentrate toward center

      // 40% follow loose spiral paths for swirl structure
      if (Math.random() < 0.4) {
        baseAngle = (i / fogCount) * Math.PI * 6 + rNorm * Math.PI * 2;
      }

      var dist = rNorm * QR * 2;
      var bx = cx + Math.cos(baseAngle) * dist + (Math.random() - 0.5) * QR * 0.35;
      var by = cy + Math.sin(baseAngle) * dist + (Math.random() - 0.5) * QR * 0.35;

      // Blob size: bigger near center, smaller at edges
      var blobSize = (22 + Math.random() * 55) * (1 - rNorm * 0.35);
      if (isMobile) blobSize *= 0.55;

      var colorRoll = Math.random();
      var cr, cg, cb, alpha;
      if (rNorm < 0.2) {
        // Hot inner: white/cream/light pink
        cr = 255; cg = 215 + Math.random() * 35; cb = 235 + Math.random() * 20;
        alpha = 0.06 + Math.random() * 0.07;
      } else if (colorRoll < 0.4) {
        // Pink/rose (dominant)
        cr = 225 + Math.random() * 30; cg = 80 + Math.random() * 80; cb = 145 + Math.random() * 65;
        alpha = 0.035 + Math.random() * 0.045;
      } else if (colorRoll < 0.6) {
        // Blue/cyan accents
        cr = 85 + Math.random() * 45; cg = 125 + Math.random() * 65; cb = 205 + Math.random() * 50;
        alpha = 0.03 + Math.random() * 0.04;
      } else if (colorRoll < 0.8) {
        // Purple/magenta
        cr = 155 + Math.random() * 55; cg = 55 + Math.random() * 55; cb = 185 + Math.random() * 55;
        alpha = 0.035 + Math.random() * 0.04;
      } else {
        // Warm cream/white dust
        cr = 238 + Math.random() * 17; cg = 205 + Math.random() * 40; cb = 195 + Math.random() * 40;
        alpha = 0.03 + Math.random() * 0.035;
      }

      var c = Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb);
      var grad = oc.createRadialGradient(bx, by, 0, bx, by, blobSize);
      grad.addColorStop(0, 'rgba(' + c + ',' + alpha + ')');
      grad.addColorStop(0.3, 'rgba(' + c + ',' + (alpha * 0.6) + ')');
      grad.addColorStop(0.65, 'rgba(' + c + ',' + (alpha * 0.2) + ')');
      grad.addColorStop(1, 'rgba(' + c + ',0)');
      oc.beginPath();
      oc.arc(bx, by, blobSize, 0, Math.PI * 2);
      oc.fillStyle = grad;
      oc.fill();
    }

    // --- Layer 1b: Faint spiral arms (partially buried under cloud) ---
    // Draw 2 logarithmic spiral arms as chains of soft elongated blobs.
    // They sit between the base fog and the bright knots so they look
    // like structure barely visible through the nebula.
    var spiralArms = 2;
    var spiralSteps = isMobile ? 40 : 70;
    var spiralTurns = 2.2;
    for (var arm = 0; arm < spiralArms; arm++) {
      var armOffset = (Math.PI * 2 / spiralArms) * arm;
      for (var si = 0; si < spiralSteps; si++) {
        var t = si / spiralSteps; // 0 to 1
        var spiralR = QR * 0.25 + t * QR * 1.9;
        var spiralA = armOffset + t * Math.PI * 2 * spiralTurns;
        var spx = cx + Math.cos(spiralA) * spiralR;
        var spy = cy + Math.sin(spiralA) * spiralR;
        // Slight random scatter so it's not perfectly geometric
        spx += (Math.random() - 0.5) * QR * 0.12;
        spy += (Math.random() - 0.5) * QR * 0.12;

        // Fade at inner and outer edges
        var edgeFade = Math.sin(t * Math.PI); // 0 at start/end, 1 in middle
        var spAlpha = (0.06 + Math.random() * 0.04) * edgeFade;
        var spSize = (10 + Math.random() * 18) * (0.6 + edgeFade * 0.4);
        if (isMobile) spSize *= 0.55;

        // Color: light cream/pink with some blue variation
        var spColorRoll = Math.random();
        var spcr, spcg, spcb;
        if (spColorRoll < 0.5) {
          // Warm cream/white
          spcr = 240 + Math.random() * 15;
          spcg = 210 + Math.random() * 30;
          spcb = 210 + Math.random() * 30;
        } else if (spColorRoll < 0.8) {
          // Light pink
          spcr = 240 + Math.random() * 15;
          spcg = 160 + Math.random() * 50;
          spcb = 190 + Math.random() * 40;
        } else {
          // Pale blue
          spcr = 160 + Math.random() * 40;
          spcg = 190 + Math.random() * 40;
          spcb = 235 + Math.random() * 20;
        }

        var spc = Math.round(spcr) + ',' + Math.round(spcg) + ',' + Math.round(spcb);
        var spGrad = oc.createRadialGradient(spx, spy, 0, spx, spy, spSize);
        spGrad.addColorStop(0, 'rgba(' + spc + ',' + spAlpha + ')');
        spGrad.addColorStop(0.4, 'rgba(' + spc + ',' + (spAlpha * 0.5) + ')');
        spGrad.addColorStop(1, 'rgba(' + spc + ',0)');
        oc.beginPath();
        oc.arc(spx, spy, spSize, 0, Math.PI * 2);
        oc.fillStyle = spGrad;
        oc.fill();
      }
    }

    // --- Layer 2: Medium bright knots (detail within the cloud) ---
    var knotCount = isMobile ? 35 : 90;
    for (var j = 0; j < knotCount; j++) {
      var ka = Math.random() * Math.PI * 2;
      var kr = Math.pow(Math.random(), 0.5) * QR * 1.5;
      var kx = cx + Math.cos(ka) * kr + (Math.random() - 0.5) * QR * 0.2;
      var ky = cy + Math.sin(ka) * kr + (Math.random() - 0.5) * QR * 0.2;

      var ks = 8 + Math.random() * 24;
      if (isMobile) ks *= 0.55;

      var kt = Math.random();
      var kcr, kcg, kcb, kalpha;
      if (kt < 0.45) {
        kcr = 240 + Math.random() * 15; kcg = 95 + Math.random() * 70; kcb = 155 + Math.random() * 55;
        kalpha = 0.06 + Math.random() * 0.06;
      } else if (kt < 0.75) {
        kcr = 95 + Math.random() * 40; kcg = 145 + Math.random() * 55; kcb = 225 + Math.random() * 30;
        kalpha = 0.05 + Math.random() * 0.05;
      } else {
        kcr = 252; kcg = 235 + Math.random() * 15; kcb = 242 + Math.random() * 13;
        kalpha = 0.055 + Math.random() * 0.06;
      }

      var kc = Math.round(kcr) + ',' + Math.round(kcg) + ',' + Math.round(kcb);
      var kgrad = oc.createRadialGradient(kx, ky, 0, kx, ky, ks);
      kgrad.addColorStop(0, 'rgba(' + kc + ',' + kalpha + ')');
      kgrad.addColorStop(0.45, 'rgba(' + kc + ',' + (kalpha * 0.45) + ')');
      kgrad.addColorStop(1, 'rgba(' + kc + ',0)');
      oc.beginPath();
      oc.arc(kx, ky, ks, 0, Math.PI * 2);
      oc.fillStyle = kgrad;
      oc.fill();
    }

    // --- Layer 3: Central hot glow ---
    var hotGlow = oc.createRadialGradient(cx, cy, 0, cx, cy, QR * 0.7);
    hotGlow.addColorStop(0, 'rgba(255, 240, 250, 0.25)');
    hotGlow.addColorStop(0.2, 'rgba(250, 195, 225, 0.14)');
    hotGlow.addColorStop(0.5, 'rgba(230, 140, 190, 0.06)');
    hotGlow.addColorStop(1, 'rgba(180, 80, 140, 0)');
    oc.beginPath();
    oc.arc(cx, cy, QR * 0.7, 0, Math.PI * 2);
    oc.fillStyle = hotGlow;
    oc.fill();

    // --- Sparkle particles (dynamic, rendered per-frame on main canvas) ---
    quasarSparkles = [];
    var sparkCount = isMobile ? 20 : 50;
    for (var k = 0; k < sparkCount; k++) {
      var sAngle = Math.random() * Math.PI * 2;
      var sR = Math.pow(Math.random(), 0.5) * 0.85;
      var sType = Math.random();
      var scr, scg, scb;
      if (sType < 0.3) { scr = 255; scg = 215; scb = 235; }
      else if (sType < 0.5) { scr = 175; scg = 215; scb = 255; }
      else if (sType < 0.7) { scr = 255; scg = 175; scb = 200; }
      else { scr = 255; scg = 255; scb = 255; }

      quasarSparkles.push({
        angle: sAngle,
        rNorm: sR,
        size: 0.5 + Math.random() * 2,
        r: scr, g: scg, b: scb,
        baseOp: 0.35 + Math.random() * 0.55,
        twinkleSpeed: 1 + Math.random() * 3.5,
        twinklePhase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.04 + Math.random() * 0.1
      });
    }

    quasarCloudReady = true;
  }

  function drawQuasar(pos, opacity) {
    if (opacity <= 0) return;
    if (!quasarCloudReady) initQuasarCloud();

    var QR = isMobile ? 55 : 100;
    var diskAngle = 0.3;   // orientation of the disk
    var diskTilt = 0.35;   // vertical compression for perspective
    var spinRate = 0.04;   // rotation within disk plane

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(pos.x, pos.y);

    // --- 1. Outer diffuse haze ---
    var hazeR = QR * 3.2;
    var hazeGrad = ctx.createRadialGradient(0, 0, QR * 0.4, 0, 0, hazeR);
    hazeGrad.addColorStop(0, 'rgba(200, 120, 175, 0.08)');
    hazeGrad.addColorStop(0.3, 'rgba(150, 80, 150, 0.04)');
    hazeGrad.addColorStop(0.6, 'rgba(100, 55, 130, 0.018)');
    hazeGrad.addColorStop(1, 'rgba(50, 30, 80, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, hazeR, 0, Math.PI * 2);
    ctx.fillStyle = hazeGrad;
    ctx.fill();

    // --- 2. Counter-jet (behind the cloud, symmetric but slightly dimmer) ---
    var jetAngle = diskAngle - Math.PI / 2 + Math.sin(time * 0.1) * 0.03;
    var jetLen = isMobile ? 180 : 320;
    var jetFlicker = 0.75 + Math.sin(time * 3.2) * 0.25;
    var jx = Math.cos(jetAngle) * jetLen;
    var jy = Math.sin(jetAngle) * jetLen;
    var cjDim = 0.65;

    // Counter-jet cone
    var cjPerpX = -Math.sin(jetAngle);
    var cjPerpY = Math.cos(jetAngle);
    var cjConeW = 28 + Math.sin(time * 1.5) * 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-jx + cjPerpX * cjConeW, -jy + cjPerpY * cjConeW);
    ctx.lineTo(-jx - cjPerpX * cjConeW, -jy - cjPerpY * cjConeW);
    ctx.closePath();
    var cjConeGrad = ctx.createLinearGradient(0, 0, -jx, -jy);
    cjConeGrad.addColorStop(0, 'rgba(160, 200, 255, ' + (0.16 * jetFlicker * cjDim) + ')');
    cjConeGrad.addColorStop(0.25, 'rgba(120, 165, 245, ' + (0.07 * jetFlicker * cjDim) + ')');
    cjConeGrad.addColorStop(0.6, 'rgba(85, 125, 225, ' + (0.025 * jetFlicker * cjDim) + ')');
    cjConeGrad.addColorStop(1, 'rgba(40, 60, 180, 0)');
    ctx.fillStyle = cjConeGrad;
    ctx.fill();

    // Counter-jet mid beam
    var cjMid = ctx.createLinearGradient(0, 0, -jx * 0.8, -jy * 0.8);
    cjMid.addColorStop(0, 'rgba(190, 225, 255, ' + (0.28 * jetFlicker * cjDim) + ')');
    cjMid.addColorStop(0.3, 'rgba(150, 195, 255, ' + (0.1 * jetFlicker * cjDim) + ')');
    cjMid.addColorStop(0.7, 'rgba(100, 150, 240, ' + (0.03 * jetFlicker * cjDim) + ')');
    cjMid.addColorStop(1, 'rgba(60, 90, 210, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-jx * 0.8, -jy * 0.8);
    ctx.strokeStyle = cjMid;
    ctx.lineWidth = 8 + Math.sin(time * 2.5) * 2.5;
    ctx.stroke();

    // Counter-jet core beam
    var cjCore = ctx.createLinearGradient(0, 0, -jx * 0.55, -jy * 0.55);
    cjCore.addColorStop(0, 'rgba(225, 242, 255, ' + (0.45 * jetFlicker * cjDim) + ')');
    cjCore.addColorStop(0.4, 'rgba(185, 215, 255, ' + (0.18 * jetFlicker * cjDim) + ')');
    cjCore.addColorStop(1, 'rgba(130, 175, 250, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-jx * 0.55, -jy * 0.55);
    ctx.strokeStyle = cjCore;
    ctx.lineWidth = 3.5 + Math.sin(time * 4.2) * 1.2;
    ctx.stroke();

    // --- 3. Nebula cloud (offscreen canvas, perspective-transformed) ---
    // The cloud was drawn as a circular distribution. We apply:
    //   rotate(diskAngle)  — orient the disk
    //   scale(1, diskTilt)  — compress vertically for tilt
    //   rotate(spin)        — slow spin within disk plane
    var cSize = quasarOffscreen.width;
    ctx.save();
    ctx.rotate(diskAngle);
    ctx.scale(1, diskTilt);
    ctx.rotate(time * spinRate);
    ctx.drawImage(quasarOffscreen, -cSize / 2, -cSize / 2);
    ctx.restore();

    // --- 4. Dynamic sparkle particles (orbit within the disk) ---
    for (var i = 0; i < quasarSparkles.length; i++) {
      var sp = quasarSparkles[i];
      var sa = sp.angle + time * sp.orbitSpeed;
      var sr = sp.rNorm * QR * 1.8;
      // Position in disk-local coords, then apply disk tilt + angle
      var rawX = Math.cos(sa) * sr;
      var rawY = Math.sin(sa) * sr;
      var cosA = Math.cos(diskAngle), sinA = Math.sin(diskAngle);
      var sx = rawX * cosA - rawY * diskTilt * sinA;
      var sy = rawX * sinA + rawY * diskTilt * cosA;

      var sTwinkle = 0.3 + 0.7 * Math.sin(time * sp.twinkleSpeed + sp.twinklePhase);
      var sAlpha = sp.baseOp * sTwinkle;

      // Soft glow halo
      ctx.beginPath();
      ctx.arc(sx, sy, sp.size * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + sp.r + ',' + sp.g + ',' + sp.b + ',' + (sAlpha * 0.12) + ')';
      ctx.fill();

      // Bright point
      ctx.beginPath();
      ctx.arc(sx, sy, sp.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + sp.r + ',' + sp.g + ',' + sp.b + ',' + sAlpha + ')';
      ctx.fill();
    }

    // --- 5. Dominant jet (in front of the cloud) ---
    // Wide diffuse cone
    var perpX = -Math.sin(jetAngle);
    var perpY = Math.cos(jetAngle);
    var coneW = 28 + Math.sin(time * 1.5) * 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(jx + perpX * coneW, jy + perpY * coneW);
    ctx.lineTo(jx - perpX * coneW, jy - perpY * coneW);
    ctx.closePath();
    var coneGrad = ctx.createLinearGradient(0, 0, jx, jy);
    coneGrad.addColorStop(0, 'rgba(160, 200, 255, ' + (0.16 * jetFlicker) + ')');
    coneGrad.addColorStop(0.25, 'rgba(120, 165, 245, ' + (0.07 * jetFlicker) + ')');
    coneGrad.addColorStop(0.6, 'rgba(85, 125, 225, ' + (0.025 * jetFlicker) + ')');
    coneGrad.addColorStop(1, 'rgba(40, 60, 180, 0)');
    ctx.fillStyle = coneGrad;
    ctx.fill();

    // Mid beam
    var midJet = ctx.createLinearGradient(0, 0, jx * 0.8, jy * 0.8);
    midJet.addColorStop(0, 'rgba(190, 225, 255, ' + (0.28 * jetFlicker) + ')');
    midJet.addColorStop(0.3, 'rgba(150, 195, 255, ' + (0.1 * jetFlicker) + ')');
    midJet.addColorStop(0.7, 'rgba(100, 150, 240, ' + (0.03 * jetFlicker) + ')');
    midJet.addColorStop(1, 'rgba(60, 90, 210, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(jx * 0.8, jy * 0.8);
    ctx.strokeStyle = midJet;
    ctx.lineWidth = 8 + Math.sin(time * 2.5) * 2.5;
    ctx.stroke();

    // Core beam
    var coreBeam = ctx.createLinearGradient(0, 0, jx * 0.55, jy * 0.55);
    coreBeam.addColorStop(0, 'rgba(225, 242, 255, ' + (0.45 * jetFlicker) + ')');
    coreBeam.addColorStop(0.35, 'rgba(185, 215, 255, ' + (0.18 * jetFlicker) + ')');
    coreBeam.addColorStop(1, 'rgba(130, 175, 250, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(jx * 0.55, jy * 0.55);
    ctx.strokeStyle = coreBeam;
    ctx.lineWidth = 3.5 + Math.sin(time * 4.2) * 1.2;
    ctx.stroke();

    // --- 6. Blazing core ---
    var coreSize = isMobile ? 8 : 13;
    // Halo
    var haloGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize * 5);
    haloGrad.addColorStop(0, 'rgba(255, 228, 245, 0.3)');
    haloGrad.addColorStop(0.15, 'rgba(248, 200, 230, 0.16)');
    haloGrad.addColorStop(0.4, 'rgba(225, 150, 205, 0.05)');
    haloGrad.addColorStop(1, 'rgba(170, 90, 155, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, coreSize * 5, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.fill();

    // Bright core
    var cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize);
    cGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    cGrad.addColorStop(0.25, 'rgba(255, 242, 252, 0.82)');
    cGrad.addColorStop(0.6, 'rgba(235, 195, 230, 0.35)');
    cGrad.addColorStop(1, 'rgba(205, 145, 210, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
    ctx.fillStyle = cGrad;
    ctx.fill();

    ctx.restore();
  }

  /* -- Magnetar (neutron star with violent flare eruption) -- */
  function magnetarPos() {
    return { x: W * 0.72, y: H * 0.75 };
  }

  function drawMagnetar(pos, opacity) {
    if (opacity <= 0) return;

    var MR = isMobile ? 22 : 40;
    magnetarPulse += 0.016;

    var pulsePhase = (magnetarPulse * 3) % (Math.PI * 2);
    var pulseIntensity = Math.pow(Math.max(0, Math.sin(pulsePhase)), 6);
    var breathe = 1 + pulseIntensity * 0.1;

    // Randomize eruption direction each pulse cycle
    var isPulseHigh = pulseIntensity > 0.1;
    if (isPulseHigh && !magnetarLastPulseHigh) {
      magnetarEruptAngle = Math.random() * Math.PI * 2;
    }
    magnetarLastPulseHigh = isPulseHigh;
    var eruptAngle = magnetarEruptAngle;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(pos.x, pos.y);

    // --- 1. Faint light rays from eruption point ---
    var eruptSurfX = Math.cos(eruptAngle) * MR * 0.55;
    var eruptSurfY = Math.sin(eruptAngle) * MR * 0.55;
    var rayCount = 12;
    for (var ri = 0; ri < rayCount; ri++) {
      var rayAngle = eruptAngle + (ri / rayCount - 0.5) * Math.PI * 1.5;
      var rayLen = MR * (2.5 + Math.random() * 2 + pulseIntensity * 1.5);
      var rx = Math.cos(rayAngle) * rayLen;
      var ry = Math.sin(rayAngle) * rayLen;
      var rayGrad = ctx.createLinearGradient(eruptSurfX, eruptSurfY, eruptSurfX + rx, eruptSurfY + ry);
      rayGrad.addColorStop(0, 'rgba(220, 200, 255, ' + (0.04 + pulseIntensity * 0.04) + ')');
      rayGrad.addColorStop(0.4, 'rgba(180, 150, 240, ' + (0.015 + pulseIntensity * 0.02) + ')');
      rayGrad.addColorStop(1, 'rgba(120, 80, 200, 0)');
      ctx.beginPath();
      ctx.moveTo(eruptSurfX, eruptSurfY);
      ctx.lineTo(eruptSurfX + rx, eruptSurfY + ry);
      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.stroke();
    }

    // --- 2. Purple/pink haze surrounding the star ---
    var hazeR = MR * 3.5;
    var hazeGrad = ctx.createRadialGradient(0, 0, MR * 0.3, 0, 0, hazeR);
    hazeGrad.addColorStop(0, 'rgba(180, 140, 220, ' + (0.12 + pulseIntensity * 0.06) + ')');
    hazeGrad.addColorStop(0.3, 'rgba(160, 100, 200, ' + (0.06 + pulseIntensity * 0.03) + ')');
    hazeGrad.addColorStop(0.6, 'rgba(120, 70, 170, 0.02)');
    hazeGrad.addColorStop(1, 'rgba(80, 40, 140, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, hazeR, 0, Math.PI * 2);
    ctx.fillStyle = hazeGrad;
    ctx.fill();

    // --- 3. Star body (lavender/gray sphere, more opaque) ---
    var bodyGrad = ctx.createRadialGradient(-MR * 0.25, -MR * 0.25, 0, MR * 0.1, MR * 0.1, MR);
    bodyGrad.addColorStop(0, 'rgba(235, 230, 248, 0.85)');
    bodyGrad.addColorStop(0.2, 'rgba(215, 208, 238, 0.75)');
    bodyGrad.addColorStop(0.5, 'rgba(195, 185, 225, 0.65)');
    bodyGrad.addColorStop(0.75, 'rgba(175, 162, 212, 0.55)');
    bodyGrad.addColorStop(0.9, 'rgba(155, 140, 200, 0.45)');
    bodyGrad.addColorStop(1, 'rgba(135, 120, 185, 0.3)');
    ctx.beginPath();
    ctx.arc(0, 0, MR, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // --- 5. Surface marble veins (bolder pink/magenta) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, MR, 0, Math.PI * 2);
    ctx.clip();
    var veinCount = isMobile ? 5 : 10;
    for (var vi = 0; vi < veinCount; vi++) {
      var vAngle = (Math.PI * 2 / veinCount) * vi + time * 0.025 + vi * 0.7;
      ctx.beginPath();
      var vStartR = MR * 0.1;
      ctx.moveTo(Math.cos(vAngle) * vStartR, Math.sin(vAngle) * vStartR);
      var segs = 7;
      for (var vs = 1; vs <= segs; vs++) {
        var vt = vs / segs;
        var vr = MR * (0.1 + vt * 0.88);
        var wobble = Math.sin(vs * 2.3 + time * 0.4 + vi * 1.7) * 0.5 +
                     Math.sin(vs * 4.1 + vi * 3.2) * 0.25;
        ctx.lineTo(Math.cos(vAngle + wobble) * vr, Math.sin(vAngle + wobble) * vr);
      }
      ctx.strokeStyle = 'rgba(190, 80, 140, ' + (0.2 + pulseIntensity * 0.06) + ')';
      ctx.lineWidth = 1.3 + Math.sin(vi * 2.1) * 0.4;
      ctx.stroke();
      // Soft glow pass
      ctx.strokeStyle = 'rgba(200, 100, 155, ' + (0.06 + pulseIntensity * 0.03) + ')';
      ctx.lineWidth = 2.5 + Math.sin(vi * 2.1) * 0.6;
      ctx.stroke();
    }
    // Secondary finer veins
    var fineVeinCount = isMobile ? 4 : 8;
    for (var fv = 0; fv < fineVeinCount; fv++) {
      var fvAngle = (Math.PI * 2 / fineVeinCount) * fv + 0.3 + time * 0.015;
      ctx.beginPath();
      ctx.moveTo(Math.cos(fvAngle) * MR * 0.3, Math.sin(fvAngle) * MR * 0.3);
      for (var fs = 1; fs <= 4; fs++) {
        var ft = fs / 4;
        var fr = MR * (0.3 + ft * 0.65);
        var fwobble = Math.sin(fs * 3.5 + fv * 2.8 + time * 0.3) * 0.6;
        ctx.lineTo(Math.cos(fvAngle + fwobble) * fr, Math.sin(fvAngle + fwobble) * fr);
      }
      ctx.strokeStyle = 'rgba(175, 70, 135, ' + (0.12 + pulseIntensity * 0.04) + ')';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    ctx.restore();

    // --- 6. Eruption hot-spot glow ---
    var eruptX = Math.cos(eruptAngle) * MR * 0.5;
    var eruptY = Math.sin(eruptAngle) * MR * 0.5;

    // Wide pink/magenta bloom around eruption
    var bloomR = MR * (1.2 + pulseIntensity * 0.4);
    var bloom = ctx.createRadialGradient(eruptX, eruptY, 0, eruptX, eruptY, bloomR);
    bloom.addColorStop(0, 'rgba(255, 255, 255, ' + (0.8 + pulseIntensity * 0.2) + ')');
    bloom.addColorStop(0.15, 'rgba(255, 220, 255, ' + (0.5 + pulseIntensity * 0.15) + ')');
    bloom.addColorStop(0.35, 'rgba(220, 150, 240, ' + (0.2 + pulseIntensity * 0.1) + ')');
    bloom.addColorStop(0.6, 'rgba(140, 100, 220, ' + (0.06 + pulseIntensity * 0.04) + ')');
    bloom.addColorStop(1, 'rgba(80, 60, 180, 0)');
    ctx.beginPath();
    ctx.arc(eruptX, eruptY, bloomR, 0, Math.PI * 2);
    ctx.fillStyle = bloom;
    ctx.fill();

    // --- 7. Flare wisps (chaotic energy plumes from eruption) ---
    var wispCount = isMobile ? 5 : 9;
    for (var wi = 0; wi < wispCount; wi++) {
      // Each wisp is a chain of soft gradient circles extending outward
      var wispAngle = eruptAngle + (wi / wispCount - 0.5) * 1.4 +
                      Math.sin(time * 0.5 + wi * 2.1) * 0.2;
      var wispLen = MR * (1.0 + wi * 0.25 + Math.sin(time * 0.7 + wi * 1.3) * 0.3);
      var wispNodeCount = 4 + Math.floor(wi % 3);

      for (var wn = 0; wn < wispNodeCount; wn++) {
        var wt = (wn + 1) / wispNodeCount;
        var wnDist = wispLen * wt;
        // Add lateral wobble for chaotic look
        var perpAngle = wispAngle + Math.PI / 2;
        var lateralOff = Math.sin(wn * 3.7 + time * 0.8 + wi * 2.5) * MR * 0.3 * wt;
        var wnX = eruptX + Math.cos(wispAngle) * wnDist + Math.cos(perpAngle) * lateralOff;
        var wnY = eruptY + Math.sin(wispAngle) * wnDist + Math.sin(perpAngle) * lateralOff;
        var wnR = MR * (0.25 + (1 - wt) * 0.3) * (0.8 + pulseIntensity * 0.3);

        var wnGrad = ctx.createRadialGradient(wnX, wnY, 0, wnX, wnY, wnR);
        // Inner wisps are white/cyan, outer are blue
        var cyanIntensity = 0.12 + (1 - wt) * 0.15 + pulseIntensity * 0.08;
        if (wn === 0) {
          wnGrad.addColorStop(0, 'rgba(200, 240, 255, ' + (cyanIntensity * 1.5) + ')');
          wnGrad.addColorStop(0.4, 'rgba(120, 200, 255, ' + (cyanIntensity * 0.8) + ')');
        } else {
          wnGrad.addColorStop(0, 'rgba(100, 190, 255, ' + cyanIntensity + ')');
          wnGrad.addColorStop(0.4, 'rgba(60, 150, 240, ' + (cyanIntensity * 0.5) + ')');
        }
        wnGrad.addColorStop(1, 'rgba(40, 80, 200, 0)');
        ctx.beginPath();
        ctx.arc(wnX, wnY, wnR, 0, Math.PI * 2);
        ctx.fillStyle = wnGrad;
        ctx.fill();
      }
    }

    // --- 8. Lightning tendrils from eruption (with hazy glow) ---
    // Pre-generate bolt paths so we can multi-pass stroke them
    var boltCount = isMobile ? 5 : 9;
    var boltPaths = [];
    for (var bi = 0; bi < boltCount; bi++) {
      var bAngle = eruptAngle + (bi / boltCount - 0.5) * 1.6 +
                   Math.sin(time * 0.6 + bi * 3.1) * 0.15;
      var bLen = MR * (1.2 + (bi % 3) * 0.4 + Math.sin(time * 0.9 + bi * 1.7) * 0.3 +
                 pulseIntensity * 0.8);
      // ~30% of bolts are "wide energy streams", rest are thin
      var isWide = (bi % 3 === 0);
      var pts = [{ x: eruptX, y: eruptY }];
      var segs = 5 + (bi % 3);
      for (var bs = 1; bs <= segs; bs++) {
        var bt = bs / segs;
        var baseX = eruptX + Math.cos(bAngle) * bLen * bt;
        var baseY = eruptY + Math.sin(bAngle) * bLen * bt;
        var perpA = bAngle + Math.PI / 2;
        // Deterministic jag using sin (so path is stable per frame)
        var dev = Math.sin(bs * 4.3 + bi * 7.1 + time * 1.5) * MR * 0.5;
        pts.push({
          x: baseX + Math.cos(perpA) * dev,
          y: baseY + Math.sin(perpA) * dev
        });
      }
      boltPaths.push({ pts: pts, isWide: isWide, angle: bAngle, len: bLen });
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pass 1: Wide outer haze (soft white fog around each bolt)
    for (var b1 = 0; b1 < boltPaths.length; b1++) {
      var bp1 = boltPaths[b1];
      ctx.beginPath();
      ctx.moveTo(bp1.pts[0].x, bp1.pts[0].y);
      for (var p1 = 1; p1 < bp1.pts.length; p1++) {
        ctx.lineTo(bp1.pts[p1].x, bp1.pts[p1].y);
      }
      var hazeWidth = bp1.isWide ? MR * 0.6 : MR * 0.3;
      var hazeOp = bp1.isWide ? 0.04 + pulseIntensity * 0.03 : 0.025 + pulseIntensity * 0.02;
      ctx.strokeStyle = 'rgba(220, 235, 255, ' + hazeOp + ')';
      ctx.lineWidth = hazeWidth;
      ctx.stroke();
    }

    // Pass 2: Medium glow (cyan/white tinted)
    for (var b2 = 0; b2 < boltPaths.length; b2++) {
      var bp2 = boltPaths[b2];
      ctx.beginPath();
      ctx.moveTo(bp2.pts[0].x, bp2.pts[0].y);
      for (var p2 = 1; p2 < bp2.pts.length; p2++) {
        ctx.lineTo(bp2.pts[p2].x, bp2.pts[p2].y);
      }
      var glowWidth = bp2.isWide ? MR * 0.22 : MR * 0.1;
      var glowOp = bp2.isWide ? 0.08 + pulseIntensity * 0.06 : 0.05 + pulseIntensity * 0.04;
      ctx.strokeStyle = 'rgba(160, 220, 255, ' + glowOp + ')';
      ctx.lineWidth = glowWidth;
      ctx.stroke();
    }

    // Pass 3: Bright core (thin bright line)
    for (var b3 = 0; b3 < boltPaths.length; b3++) {
      var bp3 = boltPaths[b3];
      ctx.beginPath();
      ctx.moveTo(bp3.pts[0].x, bp3.pts[0].y);
      for (var p3 = 1; p3 < bp3.pts.length; p3++) {
        ctx.lineTo(bp3.pts[p3].x, bp3.pts[p3].y);
      }
      var coreWidth = bp3.isWide ? 2.0 + pulseIntensity * 1.0 : 0.8 + pulseIntensity * 0.5;
      var coreOp = bp3.isWide ? 0.3 + pulseIntensity * 0.15 : 0.2 + pulseIntensity * 0.1;
      ctx.strokeStyle = 'rgba(200, 240, 255, ' + coreOp + ')';
      ctx.lineWidth = coreWidth;
      ctx.stroke();

      // White-hot inner core for wide bolts
      if (bp3.isWide) {
        ctx.strokeStyle = 'rgba(245, 250, 255, ' + (coreOp * 0.4) + ')';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // --- 9. Pulse burst ring (on strong pulse) ---
    if (pulseIntensity > 0.4) {
      var burstR = MR * (1.5 + pulseIntensity * 3);
      ctx.beginPath();
      ctx.arc(0, 0, burstR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 180, 255, ' + (pulseIntensity * 0.1) + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  /* -- Blitzar (supernova remnant — rare dramatic event) -- */
  function initBlitzarGeometry() {
    var R = blitzar.maxR;
    // Generate irregular shell outline (bumpy circle)
    var shellPts = 60;
    blitzar.filaments = [];
    // Generate 8-12 filament curves along the shell
    var filCount = isMobile ? 5 : 10;
    for (var fi = 0; fi < filCount; fi++) {
      var startA = Math.random() * Math.PI * 2;
      var arcLen = 0.8 + Math.random() * 1.5; // how much of the circle this filament covers
      var pts = [];
      var segs = 12 + Math.floor(Math.random() * 8);
      var rBase = 0.85 + Math.random() * 0.2; // base radius fraction
      for (var s = 0; s <= segs; s++) {
        var t = s / segs;
        var a = startA + t * arcLen;
        // Noisy radius to create irregular shape
        var rNoise = Math.sin(a * 3.7 + fi * 2.1) * 0.12 +
                     Math.sin(a * 7.3 + fi * 5.4) * 0.06 +
                     Math.sin(a * 13.1 + fi * 1.8) * 0.03;
        var r = (rBase + rNoise) * R;
        pts.push({ a: a, r: r });
      }
      // Color: orange, red-orange, or pink/magenta
      var cRoll = Math.random();
      var cr, cg, cb;
      if (cRoll < 0.5) {
        cr = 230 + Math.random() * 25; cg = 90 + Math.random() * 50; cb = 20 + Math.random() * 30;
      } else if (cRoll < 0.8) {
        cr = 200 + Math.random() * 40; cg = 50 + Math.random() * 40; cb = 30 + Math.random() * 30;
      } else {
        cr = 210 + Math.random() * 40; cg = 80 + Math.random() * 50; cb = 140 + Math.random() * 60;
      }
      var width = 0.8 + Math.random() * 1.5;
      blitzar.filaments.push({ pts: pts, cr: cr, cg: cg, cb: cb, width: width });
    }

    // Internal crossing wisps (thin filaments crossing the interior)
    blitzar.internalWisps = [];
    var wispCount = isMobile ? 3 : 6;
    for (var wi = 0; wi < wispCount; wi++) {
      var wA1 = Math.random() * Math.PI * 2;
      var wA2 = wA1 + 1.5 + Math.random() * 2;
      var wR1 = (0.6 + Math.random() * 0.35) * R;
      var wR2 = (0.6 + Math.random() * 0.35) * R;
      var wMidR = Math.random() * 0.4 * R;
      var wMidA = (wA1 + wA2) / 2 + (Math.random() - 0.5) * 0.5;
      blitzar.internalWisps.push({
        x1: Math.cos(wA1) * wR1, y1: Math.sin(wA1) * wR1,
        cx: Math.cos(wMidA) * wMidR, cy: Math.sin(wMidA) * wMidR,
        x2: Math.cos(wA2) * wR2, y2: Math.sin(wA2) * wR2,
        cr: 200 + Math.random() * 40, cg: 60 + Math.random() * 50, cb: 80 + Math.random() * 80
      });
    }

    // Blue interior blobs (cloudy gas)
    blitzar.blueBlobs = [];
    var blobCount = isMobile ? 10 : 22;
    for (var bi = 0; bi < blobCount; bi++) {
      var bAngle = Math.random() * Math.PI * 2;
      var bDist = Math.pow(Math.random(), 0.6) * R * 0.75;
      var bSize = R * (0.2 + Math.random() * 0.35);
      blitzar.blueBlobs.push({
        x: Math.cos(bAngle) * bDist + (Math.random() - 0.5) * R * 0.15,
        y: Math.sin(bAngle) * bDist + (Math.random() - 0.5) * R * 0.15,
        size: bSize,
        cr: 50 + Math.random() * 40,
        cg: 80 + Math.random() * 60,
        cb: 200 + Math.random() * 55,
        alpha: 0.06 + Math.random() * 0.06
      });
    }
  }

  function updateAndDrawBlitzar() {
    if (!blitzar.active) {
      blitzar.cooldown -= 0.016;
      if (blitzar.cooldown <= 0) {
        blitzar.active = true;
        blitzar.phase = 0;
        blitzar.x = (0.2 + Math.random() * 0.6) * W;
        blitzar.y = (0.1 + Math.random() * 0.5) * H;
        blitzar.maxR = isMobile ? 45 : 82;
        initBlitzarGeometry();
      }
      return;
    }

    blitzar.phase += 0.016;
    var p = blitzar.phase;
    var R = blitzar.maxR;

    ctx.save();
    ctx.translate(blitzar.x, blitzar.y);

    if (p < 1.2) {
      // Phase 1: Star trembling before collapse (0-1.2s)
      var shrink = Math.max(0.4, 1 - p / 1.2);
      var preR = (isMobile ? 5 : 8) * shrink;
      var preBright = 0.4 + p / 1.2 * 0.6;

      var preGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, preR * 3);
      preGrad.addColorStop(0, 'rgba(255, 255, 255, ' + preBright + ')');
      preGrad.addColorStop(0.3, 'rgba(180, 200, 255, ' + (preBright * 0.4) + ')');
      preGrad.addColorStop(1, 'rgba(100, 100, 200, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, preR * 3, 0, Math.PI * 2);
      ctx.fillStyle = preGrad;
      ctx.fill();

      var tremble = Math.sin(p * 45) * 2 * (p / 1.2);
      ctx.beginPath();
      ctx.arc(tremble, tremble * 0.5, preR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + preBright + ')';
      ctx.fill();

    } else if (p < 1.7) {
      // Phase 2: Flash burst (1.2-1.7s)
      var flashP = (p - 1.2) / 0.5;
      var flashR = flashP * R * 1.5;
      var flashOp = (1 - flashP) * 0.5;

      var flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR);
      flashGrad.addColorStop(0, 'rgba(255, 255, 255, ' + flashOp + ')');
      flashGrad.addColorStop(0.2, 'rgba(180, 210, 255, ' + (flashOp * 0.5) + ')');
      flashGrad.addColorStop(0.5, 'rgba(100, 140, 240, ' + (flashOp * 0.15) + ')');
      flashGrad.addColorStop(1, 'rgba(60, 80, 200, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, flashR, 0, Math.PI * 2);
      ctx.fillStyle = flashGrad;
      ctx.fill();

    } else if (p < 10.0) {
      // Phase 3: Supernova remnant (1.7-10.0s) — the main show
      var growP = Math.min(1, (p - 1.7) / 2.5); // grows over 2.5s
      var fadeStart = 7.0;
      var fadeOp = p > fadeStart ? Math.max(0, 1 - (p - fadeStart) / 3.0) : 1;
      var scale = 0.3 + growP * 0.7; // starts at 30%, grows to 100%
      var wobble = time * 0.3; // slow animation

      // Pulsation: shell breathes in/out like a wave
      // Ramps up after initial growth, 3 full wave cycles at ~1.5s per cycle
      var pulseT = p - 1.7; // time since Phase 3 started
      var pulseRamp = Math.min(1, pulseT / 1.5); // ramp up pulsation over 1.5s
      var pulseAmp = 0.08 * pulseRamp * fadeOp; // amplitude dies with fade
      var pulseFreq = 4.0; // ~1.5s per cycle
      var shellPulse = 1 + Math.sin(pulseT * pulseFreq) * pulseAmp;

      ctx.globalAlpha = fadeOp;

      // --- Blue interior cloud ---
      // Interior pulses gently in sync (half the amplitude)
      var interiorPulse = 1 + Math.sin(pulseT * pulseFreq) * pulseAmp * 0.4;
      for (var bi = 0; bi < blitzar.blueBlobs.length; bi++) {
        var bb = blitzar.blueBlobs[bi];
        var bx = bb.x * scale * interiorPulse;
        var by = bb.y * scale * interiorPulse;
        var bs = bb.size * scale * interiorPulse;
        // Slight animated drift
        bx += Math.sin(wobble + bi * 1.7) * R * 0.02;
        by += Math.cos(wobble * 0.8 + bi * 2.3) * R * 0.02;

        var bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, bs);
        bGrad.addColorStop(0, 'rgba(' + bb.cr + ',' + bb.cg + ',' + bb.cb + ',' + bb.alpha + ')');
        bGrad.addColorStop(0.4, 'rgba(' + bb.cr + ',' + bb.cg + ',' + bb.cb + ',' + (bb.alpha * 0.5) + ')');
        bGrad.addColorStop(1, 'rgba(' + bb.cr + ',' + bb.cg + ',' + bb.cb + ',0)');
        ctx.beginPath();
        ctx.arc(bx, by, bs, 0, Math.PI * 2);
        ctx.fillStyle = bGrad;
        ctx.fill();
      }

      // --- Orange/red/pink filamentary shell ---
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (var fi = 0; fi < blitzar.filaments.length; fi++) {
        var fil = blitzar.filaments[fi];
        var pts = fil.pts;
        if (pts.length < 2) continue;

        // Per-filament wave: each filament pulses with a phase offset
        // This creates a traveling wave effect around the shell
        var filPhase = fi / blitzar.filaments.length * Math.PI * 2;
        var filPulse = 1 + Math.sin(pulseT * pulseFreq + filPhase) * pulseAmp;
        var filScale = scale * filPulse;

        // Build path
        ctx.beginPath();
        var fp0 = pts[0];
        ctx.moveTo(Math.cos(fp0.a) * fp0.r * filScale, Math.sin(fp0.a) * fp0.r * filScale);
        for (var fp = 1; fp < pts.length; fp++) {
          var pt = pts[fp];
          // Add slight time-based wobble for fluidity
          var wR = pt.r + Math.sin(wobble * 1.2 + pt.a * 5 + fi) * R * 0.015;
          ctx.lineTo(Math.cos(pt.a) * wR * filScale, Math.sin(pt.a) * wR * filScale);
        }

        // Outer glow pass (wide, faint)
        ctx.strokeStyle = 'rgba(' + Math.round(fil.cr) + ',' + Math.round(fil.cg) + ',' + Math.round(fil.cb) + ',0.06)';
        ctx.lineWidth = fil.width * 6;
        ctx.stroke();

        // Mid glow
        ctx.strokeStyle = 'rgba(' + Math.round(fil.cr) + ',' + Math.round(fil.cg) + ',' + Math.round(fil.cb) + ',0.12)';
        ctx.lineWidth = fil.width * 2.5;
        ctx.stroke();

        // Bright core
        ctx.strokeStyle = 'rgba(' + Math.round(Math.min(255, fil.cr + 20)) + ',' + Math.round(Math.min(255, fil.cg + 30)) + ',' + Math.round(Math.min(255, fil.cb + 20)) + ',0.25)';
        ctx.lineWidth = fil.width;
        ctx.stroke();
      }

      // --- Internal crossing wisps ---
      for (var wi = 0; wi < blitzar.internalWisps.length; wi++) {
        var iw = blitzar.internalWisps[wi];
        var wispPulse = 1 + Math.sin(pulseT * pulseFreq + wi * 1.3) * pulseAmp * 0.5;
        var wispScale = scale * wispPulse;
        ctx.beginPath();
        ctx.moveTo(iw.x1 * wispScale, iw.y1 * wispScale);
        ctx.quadraticCurveTo(
          iw.cx * wispScale + Math.sin(wobble + wi * 2) * R * 0.03,
          iw.cy * wispScale + Math.cos(wobble * 0.7 + wi * 3) * R * 0.03,
          iw.x2 * wispScale, iw.y2 * wispScale
        );

        // Glow
        ctx.strokeStyle = 'rgba(' + Math.round(iw.cr) + ',' + Math.round(iw.cg) + ',' + Math.round(iw.cb) + ',0.05)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Core
        ctx.strokeStyle = 'rgba(' + Math.round(iw.cr) + ',' + Math.round(iw.cg) + ',' + Math.round(iw.cb) + ',0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';

    } else {
      // Event finished
      blitzar.active = false;
      blitzar.cooldown = 8 + Math.random() * 2;
    }

    ctx.restore();
  }

  /* -- Primordial Black Hole (tiny, ancient, with Hawking radiation glow) -- */
  var primordialBHs = [];

  function initPrimordialBHs() {
    var count = isMobile ? 2 : 3;
    primordialBHs = [];
    for (var i = 0; i < count; i++) {
      primordialBHs.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.2 + Math.random() * 0.6,
        radius: isMobile ? 3 : 5,
        hawkingPhase: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * 0.0002,
        driftY: (Math.random() - 0.5) * 0.0002
      });
    }
  }

  function drawPrimordialBHs(baseOpacity) {
    if (baseOpacity <= 0) return;

    for (var i = 0; i < primordialBHs.length; i++) {
      var pbh = primordialBHs[i];

      // Slow drift
      pbh.x += pbh.driftX;
      pbh.y += pbh.driftY;
      // Wrap
      if (pbh.x < 0.05) pbh.driftX = Math.abs(pbh.driftX);
      if (pbh.x > 0.95) pbh.driftX = -Math.abs(pbh.driftX);
      if (pbh.y < 0.1) pbh.driftY = Math.abs(pbh.driftY);
      if (pbh.y > 0.9) pbh.driftY = -Math.abs(pbh.driftY);

      var px = pbh.x * W;
      var py = pbh.y * H + scrollY * 0.04; // slight parallax
      py = ((py % H) + H) % H;
      var r = pbh.radius;

      ctx.save();
      ctx.globalAlpha = baseOpacity;
      ctx.translate(px, py);

      // Hawking radiation glow — flickering particles escaping
      pbh.hawkingPhase += 0.016;
      var hawkingBright = 0.6 + Math.sin(pbh.hawkingPhase * 3.5) * 0.4;

      // Radiation ring
      var radGrad = ctx.createRadialGradient(0, 0, r, 0, 0, r * 5);
      radGrad.addColorStop(0, 'rgba(180, 140, 255, ' + (0.12 * hawkingBright) + ')');
      radGrad.addColorStop(0.4, 'rgba(140, 100, 220, ' + (0.05 * hawkingBright) + ')');
      radGrad.addColorStop(1, 'rgba(100, 60, 180, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, r * 5, 0, Math.PI * 2);
      ctx.fillStyle = radGrad;
      ctx.fill();

      // Escaping particle sparks (Hawking radiation)
      var sparkCount = 4;
      for (var s = 0; s < sparkCount; s++) {
        var sparkAngle = pbh.hawkingPhase * 1.5 + (Math.PI * 2 / sparkCount) * s;
        var sparkDist = r * (2 + Math.sin(pbh.hawkingPhase * 5 + s * 2) * 1.5);
        var sx = Math.cos(sparkAngle) * sparkDist;
        var sy = Math.sin(sparkAngle) * sparkDist;
        var sparkOp = 0.3 + Math.sin(pbh.hawkingPhase * 7 + s * 3) * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 180, 255, ' + (sparkOp * hawkingBright) + ')';
        ctx.fill();
      }

      // Dark center
      var darkGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
      darkGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      darkGrad.addColorStop(0.6, 'rgba(10, 5, 20, 0.5)');
      darkGrad.addColorStop(1, 'rgba(30, 15, 50, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = darkGrad;
      ctx.fill();

      // Lensing ring
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 160, 255, ' + (0.15 * hawkingBright) + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }
  }

  /* -- Main animation loop -- */
  function animate() {
    if (!ctx || !canvas) return;
    time += 0.016; // ~60fps

    ctx.clearRect(0, 0, W, H);

    // Draw galactic band first (behind everything)
    drawGalacticBand();

    // Draw spiral galaxy (very far background)
    drawSpiralGalaxy();

    // Draw star clusters
    drawStarClusters();

    // Draw dust belt
    drawDustBelt();

    var bh = bhPos();
    var heroH = window.innerHeight;
    var bhOpacity = Math.max(0, 1 - scrollY / (heroH * 0.8));

    // Draw celestial objects behind stars
    var sp = sunPos();
    var sunOpacity = Math.max(0, 1 - scrollY / (heroH * 1.2));
    drawSun(sp, sunOpacity);

    if (sunOpacity > 0.3 && Math.random() < 0.008) {
      spawnSolarFlare();
    }
    drawSolarFlares(sunOpacity);

    var dp = dyingStarPos();
    var dsOpacity = Math.max(0, 1 - scrollY / (heroH * 1.0));
    drawDyingStar(dp, dsOpacity);

    drawBlackHole(bh, bhOpacity);

    // Quasar (lower-left area)
    var qp = quasarPos();
    var quasarOpacity = Math.max(0, 1 - scrollY / (heroH * 1.5));
    drawQuasar(qp, quasarOpacity);

    // Magnetar (lower-right area)
    var mp = magnetarPos();
    var magnetarOpacity = Math.max(0, 1 - scrollY / (heroH * 1.3));
    drawMagnetar(mp, magnetarOpacity);

    // Primordial black holes (scattered)
    drawPrimordialBHs(Math.max(0, 1 - scrollY / (heroH * 1.0)));

    // Blitzar event (rare dramatic collapse)
    updateAndDrawBlitzar();

    // Gravity cursor glow
    if (mouse.down && !dragStar) {
      var glowGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, GRAVITY_CURSOR_RADIUS);
      glowGrad.addColorStop(0, 'rgba(0, 212, 255, 0.08)');
      glowGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.03)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, GRAVITY_CURSOR_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    // Update and draw stars (4 layers)
    var toRemove = [];
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      // Skip dragged star movement
      if (s === dragStar) {
        s.x = mouse.x;
        s.y = mouse.y;
      } else if (s.layer >= 2) {
        // Only mid and near layers have physics
        // Black hole gravity on near-layer stars
        if (s.layer === 3 && bhOpacity > 0.2) {
          var dx = bh.x - s.x;
          var dy = bh.y - s.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > BH_ABSORB && dist < BH_RADIUS * 3) {
            var force = BH_GRAVITY / (dist * 0.5);
            force = Math.min(force, 0.5);
            s.vx += (dx / dist) * force;
            s.vy += (dy / dist) * force;
          }
          if (dist < BH_ABSORB && bhOpacity > 0.5) {
            spawnFlash(s.x, s.y);
            toRemove.push(i);
            continue;
          }
        }

        // Gravity cursor (hold click attracts mid + near)
        if (mouse.down && !dragStar) {
          var gdx = mouse.x - s.x;
          var gdy = mouse.y - s.y;
          var gdist = Math.sqrt(gdx * gdx + gdy * gdy);
          if (gdist < GRAVITY_CURSOR_RADIUS && gdist > 5) {
            var gforce = GRAVITY_CURSOR_STRENGTH * (1 - gdist / GRAVITY_CURSOR_RADIUS);
            s.vx += (gdx / gdist) * gforce;
            s.vy += (gdy / gdist) * gforce;
          }
        }

        // Damping
        s.vx *= 0.998;
        s.vy *= 0.998;

        // Move
        s.x += s.vx;
        s.y += s.vy;

        // Wrap around edges
        if (s.x < -20) s.x = W + 20;
        if (s.x > W + 20) s.x = -20;
        if (s.y < -20) s.y = H + 20;
        if (s.y > H + 20) s.y = -20;
      }

      // Parallax offset for rendering
      var py = s.y + scrollY * LAYER_SPEEDS[s.layer];
      py = ((py % H) + H) % H;

      // Gravitational lensing effect (near black hole)
      var drawX = s.x;
      var drawY = py;
      if (bhOpacity > 0.3 && s.layer >= 2) {
        var ldx = s.x - bh.x;
        var ldy = py - bh.y;
        var ldist = Math.sqrt(ldx * ldx + ldy * ldy);
        if (ldist < BH_RADIUS * 1.5 && ldist > BH_RADIUS * 0.3) {
          var lensStrength = (1 - ldist / (BH_RADIUS * 1.5)) * 15 * bhOpacity;
          drawX -= (ldx / ldist) * lensStrength;
          drawY -= (ldy / ldist) * lensStrength;
        }
      }

      // Twinkle
      var twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase);
      var opacity = s.baseOpacity + twinkle * (s.layer <= 1 ? 0.1 : 0.2);

      // Random twinkle flash (star briefly flares 3x brighter)
      s.flashTimer -= 0.016;
      if (s.flashTimer <= 0 && s.flashDuration <= 0) {
        // Chance to start a flash
        if (Math.random() < 0.0003) {
          s.flashDuration = 0.15 + Math.random() * 0.2;
        }
        s.flashTimer = 5 + Math.random() * 30; // next check
      }
      if (s.flashDuration > 0) {
        s.flashDuration -= 0.016;
        var flashIntensity = Math.sin((1 - s.flashDuration / 0.35) * Math.PI);
        opacity += flashIntensity * 0.6;
      }

      opacity = Math.max(0.03, Math.min(1, opacity));

      // Draw
      if (s.layer === 0) {
        // Dust layer: sub-pixel dots, fastest rendering
        ctx.fillStyle = s.color + opacity + ')';
        ctx.fillRect(drawX, drawY, s.radius, s.radius);
      } else if (s.layer === 1) {
        // Far stars: small squares
        ctx.fillStyle = s.color + opacity + ')';
        ctx.fillRect(drawX - s.radius * 0.5, drawY - s.radius * 0.5, s.radius, s.radius);
      } else {
        // Mid and near: circles with glow on near
        ctx.beginPath();
        ctx.arc(drawX, drawY, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + opacity + ')';
        ctx.fill();
        // Glow halo on near-layer bright stars
        if (s.layer === 3 && s.radius > 1.5) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, s.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = s.color + (opacity * 0.08) + ')';
          ctx.fill();
          // Extra bright glow during flash
          if (s.flashDuration > 0) {
            ctx.beginPath();
            ctx.arc(drawX, drawY, s.radius * 5, 0, Math.PI * 2);
            ctx.fillStyle = s.color + (opacity * 0.04) + ')';
            ctx.fill();
          }
        }
        // Mid-layer subtle glow
        if (s.layer === 2 && s.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, s.radius * 2, 0, Math.PI * 2);
          ctx.fillStyle = s.color + (opacity * 0.05) + ')';
          ctx.fill();
        }
      }
    }

    // Remove absorbed stars (reverse order)
    for (var r = toRemove.length - 1; r >= 0; r--) {
      stars.splice(toRemove[r], 1);
    }

    // Replenish near-layer stars slowly
    var nearCount = 0;
    for (var n = 0; n < stars.length; n++) {
      if (stars[n].layer === 3) nearCount++;
    }
    if (nearCount < STAR_COUNTS[3] && Math.random() < 0.02) {
      var edge = Math.floor(Math.random() * 4);
      var sx = edge === 0 ? 0 : (edge === 2 ? W : Math.random() * W);
      var sy = edge === 1 ? 0 : (edge === 3 ? H : Math.random() * H);
      stars.push(createStar(3, sx, sy));
    }

    // Meteor shower
    updateAndDrawMeteorShower();

    // Shooting stars
    for (var si = shootingStars.length - 1; si >= 0; si--) {
      var ss = shootingStars[si];
      ss.life -= 0.025;
      ss.opacity = Math.max(0, ss.life);
      ss.x += Math.cos(ss.angle) * ss.speed;
      ss.y += Math.sin(ss.angle) * ss.speed;

      if (ss.life <= 0) {
        shootingStars.splice(si, 1);
        continue;
      }

      var tailX = ss.x - Math.cos(ss.angle) * ss.length;
      var tailY = ss.y - Math.sin(ss.angle) * ss.length;
      var trailGrad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
      trailGrad.addColorStop(0, 'rgba(255, 255, 255, ' + ss.opacity * 0.9 + ')');
      trailGrad.addColorStop(0.3, 'rgba(0, 212, 255, ' + ss.opacity * 0.4 + ')');
      trailGrad.addColorStop(1, 'rgba(0, 212, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + ss.opacity + ')';
      ctx.fill();
    }

    // Flashes
    for (var fi = flashes.length - 1; fi >= 0; fi--) {
      var f = flashes[fi];
      f.radius += 1.5;
      f.opacity -= 0.06;
      if (f.opacity <= 0) {
        flashes.splice(fi, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 212, 255, ' + f.opacity * 0.4 + ')';
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  /* -- Event handlers -- */
  function findNearStar(x, y) {
    var best = null;
    var bestDist = 15;
    for (var i = 0; i < stars.length; i++) {
      if (stars[i].layer !== 3) continue;
      var dx = stars[i].x - x;
      var dy = stars[i].y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = stars[i];
      }
    }
    return best;
  }

  function isInteractiveElement(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
    if (el.classList && (el.classList.contains('hamburger') || el.classList.contains('email-trigger'))) return true;
    if (el.closest && (el.closest('a') || el.closest('button') || el.closest('input') || el.closest('select') || el.closest('.pub-links') || el.closest('.nav-links') || el.closest('.mobile-menu') || el.closest('.hamburger'))) return true;
    return false;
  }

  function onMouseDown(e) {
    if (isInteractiveElement(e.target)) return;
    mouse.down = true;
    mouse.prevX = e.clientX;
    mouse.prevY = e.clientY;
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    // Try to grab a star
    dragStar = findNearStar(e.clientX, e.clientY);
    if (!dragStar) {
      document.body.classList.add('gravity-active');
    }
  }

  function onMouseUp(e) {
    if (dragStar) {
      // Fling with velocity
      dragStar.vx = (e.clientX - mouse.prevX) * 0.3;
      dragStar.vy = (e.clientY - mouse.prevY) * 0.3;
      dragStar = null;
    } else if (mouse.down) {
      document.body.classList.remove('gravity-active');
    }
    mouse.down = false;
  }

  var mouseDownTime = 0;
  function onMouseDownTime() { mouseDownTime = Date.now(); }

  function onClick(e) {
    if (isInteractiveElement(e.target)) return;
    // Only spawn burst on quick clicks (not holds/drags)
    if (Date.now() - mouseDownTime < 250) {
      spawnBurst(e.clientX, e.clientY);
    }
  }

  function onMouseMove(e) {
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function onScroll() {
    var newScrollY = window.pageYOffset;
    var delta = Math.abs(newScrollY - lastScrollY);
    // Spawn shooting stars based on scroll — lower threshold, speed-dependent
    if (delta > 8) {
      var prob = Math.min(0.6, delta / 80);
      if (Math.random() < prob) {
        spawnShootingStar(delta);
      }
    }
    // Very fast scrolling can trigger a meteor shower
    if (delta > 150 && !meteorShower.active && meteorShower.meteors.length === 0 && Math.random() < 0.3) {
      spawnMeteorShower();
    }
    lastScrollY = newScrollY;
    scrollY = newScrollY;
  }

  /* -- Init -- */
  function initSpaceSystem() {
    if (!canvas || !ctx) return;
    resizeCanvas();
    initStars();
    animate();

    window.addEventListener('resize', function () {
      isMobile = window.innerWidth < 768;
      resizeCanvas();
      quasarCloudReady = false; // reinit on resize for mobile/desktop switch
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mousedown', function (e) {
      onMouseDownTime();
      onMouseDown(e);
    });
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('click', onClick);

    // Touch support
    document.addEventListener('touchstart', function (e) {
      if (isInteractiveElement(e.target)) return;
      var t = e.touches[0];
      mouse.x = t.clientX;
      mouse.y = t.clientY;
      mouse.prevX = t.clientX;
      mouse.prevY = t.clientY;
      mouse.down = true;
      dragStar = findNearStar(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
      mouse.x = t.clientX;
      mouse.y = t.clientY;
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (dragStar) {
        dragStar.vx = (mouse.x - mouse.prevX) * 0.3;
        dragStar.vy = (mouse.y - mouse.prevY) * 0.3;
        dragStar = null;
      }
      mouse.down = false;
    });
  }

  /* ============================
     Navbar
     ============================ */
  function initNavbar() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;

    function checkScroll() {
      if (window.scrollY > 50) {
        navbar.classList.add('visible');
      } else {
        navbar.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', checkScroll);
    checkScroll();
  }

  /* ============================
     Section Tracking
     ============================ */
  function initSectionTracking() {
    var sections = document.querySelectorAll('.section[id]');
    var navLinks = document.querySelectorAll('.nav-link[data-section]');

    if (!sections.length || !navLinks.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          navLinks.forEach(function (link) {
            if (link.getAttribute('data-section') === id) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ============================
     Scroll Reveal
     ============================ */
  function initScrollReveal() {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ============================
     Hamburger Menu
     ============================ */
  function initHamburger() {
    var hamburger = document.getElementById('hamburger');
    var mobileMenu = document.getElementById('mobileMenu');
    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });

    mobileMenu.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
  }

  /* ============================
     Smooth Scroll
     ============================ */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (href === '#') return;

        var target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });
  }

  /* ============================
     Publications
     ============================ */
  var allPubs = [];
  var showAllPubs = false;

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getVenueClass(venue) {
    var v = venue.toLowerCase();
    if (v.indexOf('neurips') !== -1) return 'venue-neurips';
    if (v.indexOf('iclr') !== -1) return 'venue-iclr';
    if (v.indexOf('acl') !== -1 || v.indexOf('naacl') !== -1 || v.indexOf('emnlp') !== -1) return 'venue-acl';
    if (v.indexOf('tmlr') !== -1) return 'venue-tmlr';
    if (v.indexOf('aistats') !== -1) return 'venue-aistats';
    return 'venue-default';
  }

  function loadPublications() {
    fetch('../data/publications.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        allPubs = data;
        populateFilters();
        renderPublications();
      })
      .catch(function (err) {
        console.error('Failed to load publications:', err);
      });
  }

  function populateFilters() {
    var yearFilter = document.getElementById('yearFilter');
    var venueFilter = document.getElementById('venueFilter');
    var searchFilter = document.getElementById('searchFilter');
    if (!yearFilter || !venueFilter) return;

    var years = [];
    var venues = [];

    allPubs.forEach(function (pub) {
      if (years.indexOf(pub.year) === -1) years.push(pub.year);
      if (venues.indexOf(pub.venue) === -1) venues.push(pub.venue);
    });

    years.sort(function (a, b) { return b - a; });
    venues.sort();

    years.forEach(function (year) {
      var opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      yearFilter.appendChild(opt);
    });

    venues.forEach(function (venue) {
      var opt = document.createElement('option');
      opt.value = venue;
      opt.textContent = venue;
      venueFilter.appendChild(opt);
    });

    yearFilter.addEventListener('change', function () {
      showAllPubs = false;
      renderPublications();
    });
    venueFilter.addEventListener('change', function () {
      showAllPubs = false;
      renderPublications();
    });
    if (searchFilter) {
      searchFilter.addEventListener('input', function () {
        showAllPubs = false;
        renderPublications();
      });
    }
  }

  function isFiltersActive() {
    var yearFilter = document.getElementById('yearFilter');
    var venueFilter = document.getElementById('venueFilter');
    var searchFilter = document.getElementById('searchFilter');

    var yearVal = yearFilter ? yearFilter.value : 'all';
    var venueVal = venueFilter ? venueFilter.value : 'all';
    var searchVal = searchFilter ? searchFilter.value.trim() : '';

    return yearVal !== 'all' || venueVal !== 'all' || searchVal !== '';
  }

  function getFilteredPubs() {
    var yearFilter = document.getElementById('yearFilter');
    var venueFilter = document.getElementById('venueFilter');
    var searchFilter = document.getElementById('searchFilter');

    var yearVal = yearFilter ? yearFilter.value : 'all';
    var venueVal = venueFilter ? venueFilter.value : 'all';
    var searchVal = searchFilter ? searchFilter.value.trim().toLowerCase() : '';

    return allPubs.filter(function (pub) {
      if (yearVal !== 'all' && pub.year !== parseInt(yearVal, 10)) return false;
      if (venueVal !== 'all' && pub.venue !== venueVal) return false;
      if (searchVal) {
        var haystack = (pub.title + ' ' + pub.authors.join(' ') + ' ' + pub.venue).toLowerCase();
        if (haystack.indexOf(searchVal) === -1) return false;
      }
      return true;
    });
  }

  function renderPublications() {
    var container = document.getElementById('pubList');
    var showMoreBtn = document.getElementById('showMorePubs');
    if (!container) return;

    var filtered = getFilteredPubs();
    var filtersActive = isFiltersActive();
    var limit = (showAllPubs || filtersActive) ? filtered.length : 5;
    var visible = filtered.slice(0, limit);

    var html = '';
    visible.forEach(function (pub) {
      var venueClass = getVenueClass(pub.venue);
      var venueHtml = '<span class="pub-venue ' + venueClass + '">' + escapeHtml(pub.venue) + '</span>';

      var authorsHtml = pub.authors.map(function (a) {
        if (a === 'Prateek Yadav') {
          return '<span class="author-highlight">' + escapeHtml(a) + '</span>';
        }
        return escapeHtml(a);
      }).join(', ');

      var linksHtml = '';
      if (pub.arxiv) {
        linksHtml += '<a href="https://arxiv.org/abs/' + escapeHtml(pub.arxiv) + '" target="_blank">arxiv</a>';
      }
      if (pub.pdf) {
        linksHtml += '<a href="../assets/pdf/' + escapeHtml(pub.pdf) + '" target="_blank">pdf</a>';
      }
      if (pub.code) {
        linksHtml += '<a href="' + escapeHtml(pub.code) + '" target="_blank">code</a>';
      }
      if (pub.poster) {
        linksHtml += '<a href="' + escapeHtml(pub.poster) + '" target="_blank">poster</a>';
      }
      if (pub.abstract) {
        linksHtml += '<button onclick="this.closest(\'.pub-card\').querySelector(\'.pub-abstract\').classList.toggle(\'open\')">abstract</button>';
      }

      var abstractHtml = '';
      if (pub.abstract) {
        abstractHtml = '<div class="pub-abstract">' + escapeHtml(pub.abstract) + '</div>';
      }

      html += '<div class="pub-card">' +
        venueHtml +
        '<div class="pub-title">' + escapeHtml(pub.title) + '</div>' +
        '<div class="pub-authors">' + authorsHtml + '</div>' +
        '<div class="pub-links">' + linksHtml + '</div>' +
        abstractHtml +
        '</div>';
    });

    container.innerHTML = html;

    if (showMoreBtn) {
      if (!filtersActive && filtered.length > 5) {
        showMoreBtn.style.display = 'block';
        showMoreBtn.textContent = showAllPubs ? 'Show fewer' : 'Show all publications';
      } else {
        showMoreBtn.style.display = 'none';
      }
    }
  }

  function initShowMorePubs() {
    var btn = document.getElementById('showMorePubs');
    if (!btn) return;

    btn.addEventListener('click', function () {
      showAllPubs = !showAllPubs;
      renderPublications();
    });
  }

  /* ============================
     News
     ============================ */
  var allNews = [];
  var showAllNews = false;

  function loadNews() {
    fetch('../data/news.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        allNews = data;
        renderNews();
      })
      .catch(function (err) {
        console.error('Failed to load news:', err);
      });
  }

  function renderNews() {
    var container = document.getElementById('newsList');
    var showMoreBtn = document.getElementById('showMoreNews');
    if (!container) return;

    var limit = showAllNews ? allNews.length : 5;
    var visible = allNews.slice(0, limit);

    var html = '';
    visible.forEach(function (item) {
      var dateStr = item.date;
      var parts = dateStr.split('-');
      var formatted = parts[0] + '-' + parts[1] + '-' + parts[2];

      var contentHtml = escapeHtml(item.content);

      if (item.links && item.links.length) {
        item.links.forEach(function (link) {
          var escaped = escapeHtml(link.text);
          var re = new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          contentHtml = contentHtml.replace(re, '<a href="' + escapeHtml(link.url) + '" target="_blank">' + escaped + '</a>');
        });
      }

      html += '<div class="news-item">' +
        '<span class="news-date">' + formatted + '</span>' +
        '<div class="news-content">' + contentHtml + '</div>' +
        '</div>';
    });

    container.innerHTML = html;

    if (showMoreBtn) {
      if (allNews.length > 5) {
        showMoreBtn.style.display = 'block';
        showMoreBtn.textContent = showAllNews ? 'Show fewer' : 'Show all updates';
      } else {
        showMoreBtn.style.display = 'none';
      }
    }
  }

  function initShowMoreNews() {
    var btn = document.getElementById('showMoreNews');
    if (!btn) return;

    btn.addEventListener('click', function () {
      showAllNews = !showAllNews;
      renderNews();
    });
  }

  /* ============================
     Shared Content Loading
     ============================ */
  function loadContent() {
    fetch('../data/content.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // Hero
        var heroName = document.querySelector('.hero-name');
        var heroTag = document.querySelector('.hero-tagline');
        if (heroName) heroName.textContent = d.name;
        if (heroTag) heroTag.textContent = d.tagline;

        // Hero socials
        var heroSocials = document.querySelector('.hero-socials');
        if (heroSocials) {
          heroSocials.innerHTML = d.socials.map(function (s) {
            return '<a href="' + s.url + '" target="_blank" aria-label="' + s.name + '"><i class="' + s.icon + '"></i></a>';
          }).join('') +
          '<a href="#emailPuzzle" class="email-trigger" aria-label="Email"><i class="fa-solid fa-envelope"></i></a>';
        }

        // About text
        var aboutText = document.querySelector('.about-text');
        if (aboutText) {
          aboutText.innerHTML = d.about.map(function (p) { return '<p>' + p + '</p>'; }).join('');
        }

        // Research interests
        var interests = document.querySelector('.research-interests');
        if (interests) {
          interests.innerHTML = d.interests.map(function (i) {
            return '<span class="interest-pill">' + i + '</span>';
          }).join('');
        }

        // Career timeline
        var careerTrack = document.querySelector('.career-track');
        if (careerTrack) {
          careerTrack.innerHTML = d.career.map(function (c) {
            return '<div class="career-item">' +
              '<div class="career-icon"><i class="' + c.icon + '"></i></div>' +
              '<div class="career-info">' +
                '<div class="career-org">' + c.org + '</div>' +
                '<div class="career-role">' + c.role + '</div>' +
                '<div class="career-date">' + c.date + '</div>' +
              '</div></div>';
          }).join('');
        }

        // Contact grid
        var contactGrid = document.querySelector('.contact-grid');
        if (contactGrid) {
          contactGrid.innerHTML = d.socials.map(function (s) {
            return '<a href="' + s.url + '" target="_blank" class="contact-card">' +
              '<i class="' + s.icon + '"></i><span>' + s.name + '</span></a>';
          }).join('') +
          '<a href="#emailPuzzle" class="contact-card email-trigger">' +
            '<i class="fa-solid fa-envelope"></i><span>Email</span></a>';
        }
      });
  }

  /* ============================
     Init
     ============================ */
  document.addEventListener('DOMContentLoaded', function () {
    initSpaceSystem();
    loadContent();
    initNavbar();
    initSectionTracking();
    initScrollReveal();
    initHamburger();
    initSmoothScroll();
    loadPublications();
    initShowMorePubs();
    loadNews();
    initShowMoreNews();
  });

})();
