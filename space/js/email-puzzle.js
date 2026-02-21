(function () {
  'use strict';

  var EMAIL_PARTS = ['prat', 'y28', '96@', 'gma', 'il.c', 'om'];
  var SHARD_PIECES = ['prat', 'y2896', '@gmail', '.com'];
  var fullEmail = EMAIL_PARTS.join('');

  var puzzleInitialized = false;
  var currentPuzzle = null;

  var puzzleTypes = ['shards', 'wipe', 'decrypt'];

  function getRandomPuzzle() {
    return puzzleTypes[Math.floor(Math.random() * puzzleTypes.length)];
  }

  function initTriggers() {
    document.body.addEventListener('click', function (e) {
      var trigger = e.target.closest('.email-trigger');
      if (!trigger) return;
      e.preventDefault();
      activatePuzzle();
      var puzzleSection = document.getElementById('emailPuzzle');
      if (puzzleSection) {
        var top = puzzleSection.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  }

  function activatePuzzle() {
    if (puzzleInitialized) return;
    puzzleInitialized = true;

    var area = document.getElementById('puzzleArea');
    if (!area) return;
    area.classList.add('active');

    currentPuzzle = getRandomPuzzle();

    switch (currentPuzzle) {
      case 'shards':
        initShardsPuzzle(area);
        break;
      case 'wipe':
        initWipePuzzle(area);
        break;
      case 'decrypt':
        initDecryptPuzzle(area);
        break;
    }
  }

  function showResult() {
    var area = document.getElementById('puzzleArea');
    if (area) area.style.display = 'none';

    var resultEl = document.getElementById('puzzleResult');
    if (!resultEl) return;

    resultEl.classList.add('visible');
    resultEl.innerHTML =
      '<span class="email-display" title="Click to copy">' + fullEmail + '</span>' +
      '<div class="email-actions">' +
        '<button onclick="navigator.clipboard.writeText(\'' + fullEmail + '\').then(function(){alert(\'Copied!\')})">copy</button>' +
        '<a href="mailto:' + fullEmail + '">send email</a>' +
      '</div>';
  }

  function initShardsPuzzle(container) {
    container.innerHTML = '<p style="color:var(--text-secondary);margin-bottom:0.75rem;font-size:0.85rem;">Click the pieces in order to reconstruct the email</p><div class="shard-pieces"></div>';

    var piecesContainer = container.querySelector('.shard-pieces');

    var shuffled = SHARD_PIECES.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    var nextIndex = 0;
    var shardEls = [];
    shuffled.forEach(function (piece) {
      var el = document.createElement('span');
      el.className = 'shard-piece';
      el.textContent = piece;
      el.setAttribute('data-piece', piece);
      piecesContainer.appendChild(el);
      shardEls.push(el);
    });

    function updateGlow() {
      if (nextIndex >= SHARD_PIECES.length) return;
      var target = SHARD_PIECES[nextIndex];
      shardEls.forEach(function (el) {
        if (el.getAttribute('data-piece') === target && !el.classList.contains('placed')) {
          el.setAttribute('data-next', 'true');
        } else {
          el.removeAttribute('data-next');
        }
      });
    }

    function onShardClick(e) {
      var el = e.target;
      if (!el.classList.contains('shard-piece')) return;
      if (el.classList.contains('placed')) return;
      if (el.getAttribute('data-next') !== 'true') return;

      el.classList.add('placed');
      el.removeAttribute('data-next');
      nextIndex++;

      if (nextIndex >= SHARD_PIECES.length) {
        setTimeout(showResult, 300);
      } else {
        updateGlow();
      }
    }

    piecesContainer.addEventListener('click', onShardClick);
    updateGlow();
  }

  function initWipePuzzle(container) {
    var containerWidth = container.clientWidth || 320;
    var canvasWidth = Math.min(320, containerWidth - 16);

    container.innerHTML =
      '<p style="color:var(--text-secondary);margin-bottom:0.75rem;font-size:0.85rem;">Scratch to reveal the email</p>' +
      '<div class="wipe-container">' +
        '<span class="wipe-text">' + fullEmail + '</span>' +
        '<canvas id="wipeCanvas" width="' + canvasWidth + '" height="60"></canvas>' +
      '</div>';

    var canvas = document.getElementById('wipeCanvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00d4ff';
    ctx.font = '14px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[ scratch to reveal ]', canvas.width / 2, canvas.height / 2);

    var drawing = false;

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var clientX, clientY;
      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function scratch(pos) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
      ctx.fill();
    }

    function checkReveal() {
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var pixels = imageData.data;
      var total = pixels.length / 4;
      var transparent = 0;
      for (var i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) transparent++;
      }
      if (transparent / total > 0.5) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        showResult();
      }
    }

    canvas.addEventListener('mousedown', function (e) { drawing = true; scratch(getPos(e)); });
    canvas.addEventListener('mousemove', function (e) { if (!drawing) return; scratch(getPos(e)); });
    canvas.addEventListener('mouseup', function () { drawing = false; checkReveal(); });
    canvas.addEventListener('mouseleave', function () { if (drawing) { drawing = false; checkReveal(); } });

    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); drawing = true; scratch(getPos(e)); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); if (!drawing) return; scratch(getPos(e)); }, { passive: false });
    canvas.addEventListener('touchend', function () { drawing = false; checkReveal(); });
  }

  function initDecryptPuzzle(container) {
    container.innerHTML =
      '<div class="decrypt-container">' +
        '<p style="color:var(--text-secondary);margin-bottom:0.75rem;font-size:0.85rem;">Hold the button to decrypt</p>' +
        '<div class="decrypt-text" id="decryptText"></div>' +
        '<button class="decrypt-btn" id="decryptBtn">HOLD TO DECRYPT</button>' +
        '<div class="decrypt-progress"><div class="decrypt-progress-bar" id="decryptBar"></div></div>' +
      '</div>';

    var textEl = document.getElementById('decryptText');
    var btn = document.getElementById('decryptBtn');
    var bar = document.getElementById('decryptBar');
    if (!textEl || !btn || !bar) return;

    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    var progress = 0;
    var interval = null;
    var decrypted = false;

    function scramble(revealed) {
      var result = '';
      for (var i = 0; i < fullEmail.length; i++) {
        if (i < revealed) {
          result += fullEmail[i];
        } else {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      return result;
    }

    textEl.textContent = scramble(0);

    function startDecrypt() {
      if (decrypted) return;
      btn.classList.add('active');
      interval = setInterval(function () {
        progress += 0.7;
        var revealed = Math.floor(progress);
        bar.style.width = (progress / fullEmail.length * 100) + '%';
        textEl.textContent = scramble(revealed);
        if (revealed >= fullEmail.length) {
          clearInterval(interval);
          interval = null;
          decrypted = true;
          textEl.textContent = fullEmail;
          bar.style.width = '100%';
          btn.classList.remove('active');
          btn.textContent = 'DECRYPTED';
          btn.disabled = true;
          setTimeout(showResult, 300);
        }
      }, 50);
    }

    function stopDecrypt() {
      if (interval) { clearInterval(interval); interval = null; }
      btn.classList.remove('active');
    }

    btn.addEventListener('mousedown', startDecrypt);
    btn.addEventListener('mouseup', stopDecrypt);
    btn.addEventListener('mouseleave', stopDecrypt);
    btn.addEventListener('touchstart', function (e) { e.preventDefault(); startDecrypt(); }, { passive: false });
    btn.addEventListener('touchend', function (e) { e.preventDefault(); stopDecrypt(); });
  }

  document.addEventListener('DOMContentLoaded', initTriggers);
})();
