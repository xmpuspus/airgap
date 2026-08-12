// Reads the generated template records and updates the field guide.

(function () {
  'use strict';

  var els = {
    select: document.getElementById('vertical'),
    brandName: document.getElementById('brand-name'),
    botName: document.getElementById('bot-name'),
    brandTagline: document.getElementById('brand-tagline'),
    brandRegion: document.getElementById('brand-region'),
    kbCount: document.getElementById('kb-count'),
    toolCount: document.getElementById('tool-count'),
    swatches: document.getElementById('swatches'),
    configSnippet: document.getElementById('config-snippet'),
    phoneGif: document.getElementById('phone-gif'),
    templateStatus: document.getElementById('template-status'),
  };

  function fetchJSON(url) {
    return fetch(url, {cache: 'no-cache'}).then(function (r) {
      if (!r.ok) throw new Error('failed to fetch ' + url + ': ' + r.status);
      return r.json();
    });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setText(node, value) {
    node.textContent = value || '';
  }

  function makeSwatch(label, hex) {
    var li = document.createElement('li');
    li.className = 'swatch';
    var color = document.createElement('div');
    color.className = 'swatch-color';
    color.style.background = hex;
    var name = document.createElement('span');
    name.textContent = label;
    var code = document.createElement('span');
    code.className = 'swatch-hex';
    code.textContent = hex;
    li.appendChild(color);
    li.appendChild(name);
    li.appendChild(code);
    return li;
  }

  function applyVertical(data) {
    document.documentElement.style.setProperty('--brand-primary', data.theme.primary || '#22d3ee');

    setText(els.brandName, data.label);
    setText(els.botName, data.botName);
    setText(els.brandTagline, data.tagline);
    setText(
      els.brandRegion,
      [data.locale && data.locale.region, data.locale && data.locale.currency]
        .filter(Boolean)
        .join(' · '),
    );
    setText(els.kbCount, String(data.knowledge.totalDocs));
    setText(els.toolCount, String(data.config.toolCount || 0));

    clear(els.swatches);
    var theme = data.theme;
    var pairs = [
      ['Primary', theme.primary],
      ['Primary dark', theme.primaryDark],
      ['Secondary', theme.secondary],
      ['Bot bubble', theme.botBubble],
      ['User bubble', theme.userBubble],
      ['Background', theme.background],
    ];
    pairs.forEach(function (p) {
      if (p[1]) els.swatches.appendChild(makeSwatch(p[0], p[1]));
    });

    els.configSnippet.textContent = JSON.stringify(data.config, null, 2);

    els.phoneGif.src = data.gif + '?v=' + Date.now();
    els.phoneGif.alt = data.label + ' support flow recorded from the Android emulator';
    setText(
      els.templateStatus,
      data.label +
        ' selected. ' +
        data.knowledge.totalDocs +
        ' knowledge documents and ' +
        (data.config.toolCount || 0) +
        ' configured tools.',
    );
  }

  function populatePicker(manifest) {
    clear(els.select);
    manifest.verticals.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.vertical;
      opt.textContent = v.label + ' · ' + v.vertical;
      els.select.appendChild(opt);
    });
  }

  function loadVertical(slug) {
    return fetchJSON('data/' + slug + '.json').then(applyVertical);
  }

  function init() {
    fetchJSON('data/manifest.json')
      .then(function (manifest) {
        populatePicker(manifest);
        var initial = (manifest.verticals[0] && manifest.verticals[0].vertical) || 'telco';
        els.select.value = initial;
        els.select.addEventListener('change', function () {
          loadVertical(els.select.value);
        });
        return loadVertical(initial);
      })
      .catch(function (err) {
        console.error('[airgap-site] init failed', err);
        var msg = document.createElement('p');
        msg.textContent =
          'Project data failed to load. Run npm run web:build from the repository root.';
        msg.style.color = 'crimson';
        document.body.insertBefore(msg, document.body.firstChild);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
