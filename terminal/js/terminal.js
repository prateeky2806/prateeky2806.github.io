/* ============================================================
   terminal.js — Main JS for retro-terminal website
   ============================================================ */

(function () {
  'use strict';

  /* ---- Boot Sequence ---- */
  function runBootSequence() {
    var overlay = document.getElementById('bootOverlay');
    var textEl = document.getElementById('bootText');

    if (!overlay || !textEl) return;

    // Skip if already booted this session
    if (sessionStorage.getItem('booted')) {
      overlay.classList.add('gone');
      return;
    }

    var lines = [
      'BIOS v3.14... OK',
      'Loading prateek.sys...',
      'Mounting /publications... 25 files found',
      'Mounting /news... 24 entries loaded',
      'System ready.'
    ];

    var lineIndex = 0;
    var charIndex = 0;
    var currentText = '';

    function typeNext() {
      if (lineIndex >= lines.length) {
        // Finished — fade out after brief pause
        setTimeout(function () {
          overlay.classList.add('hidden');
          setTimeout(function () {
            overlay.classList.add('gone');
          }, 400);
          sessionStorage.setItem('booted', '1');
        }, 200);
        return;
      }

      var line = lines[lineIndex];
      if (charIndex < line.length) {
        currentText += line[charIndex];
        textEl.textContent = currentText + '_';
        charIndex++;
        setTimeout(typeNext, 12);
      } else {
        currentText += '\n';
        textEl.textContent = currentText + '_';
        lineIndex++;
        charIndex = 0;
        setTimeout(typeNext, 80);
      }
    }

    typeNext();
  }

  /* ---- Navbar Show/Hide on Scroll ---- */
  function initNavbar() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;

    function onScroll() {
      if (window.scrollY > 50) {
        navbar.classList.add('visible');
      } else {
        navbar.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Active Section Tracking ---- */
  function initSectionTracking() {
    var sections = document.querySelectorAll('.section[id]');
    var navLinks = document.querySelectorAll('.nav-link');

    if (!sections.length || !navLinks.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          navLinks.forEach(function (link) {
            if (link.getAttribute('data-section') === id) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -60% 0px'
    });

    sections.forEach(function (sec) { observer.observe(sec); });
  }

  /* ---- Scroll Reveal ---- */
  function initScrollReveal() {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1
    });

    reveals.forEach(function (el) { observer.observe(el); });
  }

  /* ---- Hamburger Menu ---- */
  function initHamburger() {
    var btn = document.getElementById('hamburger');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', function () {
      btn.classList.toggle('open');
      menu.classList.toggle('open');
    });

    // Close on link click
    menu.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        btn.classList.remove('open');
        menu.classList.remove('open');
      });
    });
  }

  /* ---- Smooth Scroll ---- */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (href === '#') return;
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          var offset = 60; // navbar height
          var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });
  }

  /* ---- Publications ---- */
  var allPubs = [];
  var showingAllPubs = false;

  function loadPublications() {
    fetch('../data/publications.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        allPubs = data;
        populateFilters(data);
        renderPublications();
      })
      .catch(function (err) {
        console.error('Failed to load publications:', err);
        var list = document.getElementById('pubList');
        if (list) list.innerHTML = '<p style="color:var(--error)">Error loading publications.</p>';
      });
  }

  function populateFilters(pubs) {
    var yearSelect = document.getElementById('yearFilter');
    var venueSelect = document.getElementById('venueFilter');
    if (!yearSelect || !venueSelect) return;

    // Years
    var years = [];
    pubs.forEach(function (p) {
      if (years.indexOf(p.year) === -1) years.push(p.year);
    });
    years.sort(function (a, b) { return b - a; });
    years.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    // Venues
    var venues = [];
    pubs.forEach(function (p) {
      // Normalize venue for filter (strip year suffix like '23, '22)
      var v = p.venue.replace(/'?\d{2}$/, '').replace(/\s*\[.*\]/, '').trim();
      if (v && venues.indexOf(v) === -1) venues.push(v);
    });
    venues.sort();
    venues.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      venueSelect.appendChild(opt);
    });

    // Event listeners
    yearSelect.addEventListener('change', renderPublications);
    venueSelect.addEventListener('change', renderPublications);

    var searchInput = document.getElementById('searchFilter');
    if (searchInput) {
      searchInput.addEventListener('input', renderPublications);
    }
  }

  function getFilteredPubs() {
    var yearVal = document.getElementById('yearFilter') ? document.getElementById('yearFilter').value : 'all';
    var venueVal = document.getElementById('venueFilter') ? document.getElementById('venueFilter').value : 'all';
    var searchVal = document.getElementById('searchFilter') ? document.getElementById('searchFilter').value.toLowerCase().trim() : '';

    var filtered = allPubs.filter(function (p) {
      if (yearVal !== 'all' && String(p.year) !== yearVal) return false;
      if (venueVal !== 'all') {
        var normVenue = p.venue.replace(/'?\d{2}$/, '').replace(/\s*\[.*\]/, '').trim();
        if (normVenue !== venueVal) return false;
      }
      if (searchVal) {
        var haystack = (p.title + ' ' + p.authors.join(' ') + ' ' + p.venue + ' ' + (p.abstract || '')).toLowerCase();
        if (haystack.indexOf(searchVal) === -1) return false;
      }
      return true;
    });

    return filtered;
  }

  function isFiltersActive() {
    var yearVal = document.getElementById('yearFilter') ? document.getElementById('yearFilter').value : 'all';
    var venueVal = document.getElementById('venueFilter') ? document.getElementById('venueFilter').value : 'all';
    var searchVal = document.getElementById('searchFilter') ? document.getElementById('searchFilter').value.trim() : '';
    return yearVal !== 'all' || venueVal !== 'all' || searchVal !== '';
  }

  function renderPublications() {
    var list = document.getElementById('pubList');
    var btn = document.getElementById('showMorePubs');
    if (!list) return;

    var filtered = getFilteredPubs();
    var filtersOn = isFiltersActive();

    // When filters active, show all matching; otherwise limit to 5
    var limit = (filtersOn || showingAllPubs) ? filtered.length : 5;
    var toShow = filtered.slice(0, limit);

    list.innerHTML = '';

    if (toShow.length === 0) {
      list.innerHTML = '<p style="color:var(--gray)">No publications match your filters.</p>';
    }

    toShow.forEach(function (pub) {
      var card = document.createElement('div');
      card.className = 'pub-card';

      // Venue tag
      var venueHtml = '<span class="pub-venue">[' + escapeHtml(pub.venue) + ']</span>';

      // Title
      var titleHtml = '<div class="pub-title">' + escapeHtml(pub.title) + '</div>';

      // Authors with Prateek Yadav highlighted
      var authorsHtml = '<div class="pub-authors">' + pub.authors.map(function (a) {
        if (a.indexOf('Prateek Yadav') !== -1) {
          return '<span class="author-highlight">' + escapeHtml(a) + '</span>';
        }
        return escapeHtml(a);
      }).join(', ') + '</div>';

      // Links
      var links = [];
      if (pub.arxiv) {
        links.push('<a href="https://arxiv.org/abs/' + pub.arxiv + '" target="_blank">[arxiv]</a>');
      }
      if (pub.code) {
        links.push('<a href="' + escapeHtml(pub.code) + '" target="_blank">[code]</a>');
      }
      if (pub.pdf) {
        links.push('<a href="../assets/pdf/' + escapeHtml(pub.pdf) + '" target="_blank">[pdf]</a>');
      }
      if (pub.poster) {
        links.push('<a href="' + escapeHtml(pub.poster) + '" target="_blank">[poster]</a>');
      }
      if (pub.abstract) {
        links.push('<button class="abstract-toggle" data-id="' + pub.id + '">[abstract]</button>');
      }
      var linksHtml = '<div class="pub-links">' + links.join('') + '</div>';

      // Abstract (hidden by default)
      var abstractHtml = '';
      if (pub.abstract) {
        abstractHtml = '<div class="pub-abstract" id="abstract-' + pub.id + '">' + escapeHtml(pub.abstract) + '</div>';
      }

      card.innerHTML = venueHtml + titleHtml + authorsHtml + linksHtml + abstractHtml;
      list.appendChild(card);
    });

    // Abstract toggles
    list.querySelectorAll('.abstract-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var el = document.getElementById('abstract-' + id);
        if (el) el.classList.toggle('open');
      });
    });

    // Show more button visibility
    if (btn) {
      if (filtersOn || filtered.length <= 5) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
        btn.textContent = showingAllPubs ? '[show less...]' : '[show more...]';
      }
    }
  }

  function initShowMorePubs() {
    var btn = document.getElementById('showMorePubs');
    if (!btn) return;
    btn.addEventListener('click', function () {
      showingAllPubs = !showingAllPubs;
      renderPublications();
    });
  }

  /* ---- News ---- */
  var allNews = [];
  var showingAllNews = false;

  function loadNews() {
    fetch('../data/news.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        allNews = data;
        renderNews();
      })
      .catch(function (err) {
        console.error('Failed to load news:', err);
        var list = document.getElementById('newsList');
        if (list) list.innerHTML = '<p style="color:var(--error)">Error loading news.</p>';
      });
  }

  function renderNews() {
    var list = document.getElementById('newsList');
    var btn = document.getElementById('showMoreNews');
    if (!list) return;

    var limit = showingAllNews ? allNews.length : 5;
    var toShow = allNews.slice(0, limit);

    list.innerHTML = '';

    toShow.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'news-item';

      var dateHtml = '<span class="news-date">[' + item.date + ']</span>';

      var contentText = item.content;
      var linksHtml = '';
      if (item.links && item.links.length > 0) {
        item.links.forEach(function (link) {
          linksHtml += ' <a href="' + escapeHtml(link.url) + '" target="_blank">[' + escapeHtml(link.text) + ']</a>';
        });
      }

      var contentHtml = '<span class="news-content">' + escapeHtml(contentText) + linksHtml + '</span>';

      div.innerHTML = dateHtml + contentHtml;
      list.appendChild(div);
    });

    if (btn) {
      if (allNews.length <= 5) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
        btn.textContent = showingAllNews ? '[show less...]' : '[show more...]';
      }
    }
  }

  function initShowMoreNews() {
    var btn = document.getElementById('showMoreNews');
    if (!btn) return;
    btn.addEventListener('click', function () {
      showingAllNews = !showingAllNews;
      renderNews();
    });
  }

  /* ---- Utility ---- */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ---- Load Shared Content ---- */
  function loadContent() {
    fetch('../data/content.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // Hero name
        var heroName = document.querySelector('.hero-name');
        if (heroName) heroName.textContent = d.name;

        // Hero tagline
        var heroTagline = document.querySelector('.hero-tagline');
        if (heroTagline) heroTagline.innerHTML = '&gt; ' + escapeHtml(d.tagline) + '<span class="cursor">_</span>';

        // Hero photo — random photo + random visual effect
        var heroPhoto = document.getElementById('heroPhoto');
        var wrapper = document.querySelector('.hero-photo-wrapper');
        if (heroPhoto && wrapper && d.photos && d.photos.length) {
          var effects = ['fx-matrix', 'fx-pixel', 'fx-dither', 'fx-invert'];
          var chosen = effects[Math.floor(Math.random() * effects.length)];
          heroPhoto.src = '../' + d.photos[Math.floor(Math.random() * d.photos.length)];
          wrapper.classList.add(chosen);
          if (chosen === 'fx-pixel') {
            heroPhoto.addEventListener('load', function () {
              var c = document.createElement('canvas');
              var s = 48;
              c.width = s; c.height = s;
              var ctx = c.getContext('2d');
              ctx.drawImage(heroPhoto, 0, 0, s, s);
              heroPhoto.src = c.toDataURL();
            }, { once: true });
          }
        }

        // Hero social links
        var socialLinksEl = document.querySelector('.social-links');
        if (socialLinksEl) {
          var socialHtml = '';
          d.socials.forEach(function (s) {
            var shortName = s.name.toLowerCase().replace(/\s+/g, '');
            if (shortName === 'semanticscholar') shortName = 's2';
            if (shortName === 'googlescholar') shortName = 'scholar';
            socialHtml += '<a href="' + s.url + '" target="_blank" title="' + escapeHtml(s.name) + '">[<i class="' + s.icon + '"></i> ' + shortName + ']</a>';
          });
          socialHtml += '<a href="#emailPuzzle" class="email-trigger" title="Email">[<i class="fa-solid fa-envelope"></i> email]</a>';
          socialLinksEl.innerHTML = socialHtml;
        }

        // About text
        var aboutText = document.querySelector('.about-text');
        if (aboutText) {
          aboutText.innerHTML = d.about.map(function (p) {
            return '<p>' + p + '</p>';
          }).join('');
        }

        // Research tags
        var researchTags = document.querySelector('.research-tags');
        if (researchTags) {
          researchTags.innerHTML = d.interests.map(function (t) {
            return '<span class="tag">[' + escapeHtml(t) + ']</span>';
          }).join('');
        }

        // Career table
        var careerTable = document.querySelector('.career-table');
        if (careerTable) {
          careerTable.innerHTML = d.career.map(function (c) {
            // Convert org name to kebab-case for terminal look
            var orgSlug = c.org.toLowerCase().replace(/\s+/g, '-');
            // Convert date: "Jul '25 – Feb '26" -> "Jul'25-Feb'26"
            var dateShort = c.date.replace(/\s*\u2013\s*/g, '-').replace(/\s+/g, '');
            return '<div class="career-row">' +
              '<span class="career-perm">drwxr-xr-x</span>' +
              '<span class="career-org">' + escapeHtml(orgSlug) + '</span>' +
              '<span class="career-date">' + escapeHtml(dateShort) + '</span>' +
              '<span class="career-role">' + escapeHtml(c.role) + '</span>' +
              '</div>';
          }).join('');
        }

        // Contact grid
        var contactGrid = document.querySelector('.contact-grid');
        if (contactGrid) {
          var contactHtml = '';
          d.socials.forEach(function (s) {
            contactHtml += '<a href="' + s.url + '" target="_blank" class="contact-card">' +
              '<i class="' + s.icon + '"></i>' +
              '<span>' + escapeHtml(s.name) + '</span>' +
              '<span class="contact-url">' + escapeHtml(s.label) + '</span>' +
              '</a>';
          });
          contactHtml += '<a href="#emailPuzzle" class="contact-card email-trigger">' +
            '<i class="fa-solid fa-envelope"></i>' +
            '<span>Email</span>' +
            '<span class="contact-url">solve the puzzle...</span>' +
            '</a>';
          contactGrid.innerHTML = contactHtml;
        }

        // Re-init smooth scroll for dynamically added email-trigger links
        initSmoothScroll();
      })
      .catch(function (err) {
        console.error('Failed to load content:', err);
      });
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    runBootSequence();
    initNavbar();
    initSectionTracking();
    initScrollReveal();
    initHamburger();
    initSmoothScroll();
    loadContent();
    loadPublications();
    initShowMorePubs();
    loadNews();
    initShowMoreNews();
  });

})();
