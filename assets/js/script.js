// ==========================================================
// #region PORTAL
// ==========================================================

// ---------- Settings: change values here, not deep in the code ----------
const BOTS_ROOT    = '/bots';  
const BOTS_JSON    = `${BOTS_ROOT}/data.json`;
const RECENT_COUNT = 5;

/* ---------- Small helpers ---------- */

// Builds a sort function. newestFirst('dateAdded') sorts newest -> oldest.
const newestFirst = field => (a, b) => new Date(b[field]) - new Date(a[field]);

// "Ayaka Ishikawa" + "(石川彩香)" + label "v2" -> "Ayaka Ishikawa (石川彩香) · v2". Skips empty parts.
const displayName = bot => {
  const name = [bot.name, bot.altName].filter(Boolean).join(' ');
  return bot.altLabel ? `${name} · ${bot.altLabel}` : name;
};

// ["para 1", "para 2"] -> <p>para 1</p><p>para 2</p>
const paragraphs = list => list.map(text => `<p>${text}</p>`).join('');


// ==========================================================
// #region CARD TEMPLATE
//    isModal = false -> gallery
//    isModal = true  -> left of the modal
// ==========================================================
function generateBotCards(botArray, isModal = false) {
  return botArray.map(bot => {
    // Paths come ready-made from data.json (written by build_bots.py)
    const image = `${BOTS_ROOT}/${bot.image}`;
    const card  = `${BOTS_ROOT}/${bot.card}`;

    // Top of the card: gallery cards get the click overlay + name block,
    // the modal card only shows the series (the name is in the modal header).
    let top = '';
    if (isModal) {
      if (bot.series) top = `<div class="char-name"><h6>${bot.series}</h6></div>`;
    } else {
      top = `
        <a class="redirect-overlay" href="${BOTS_ROOT}/index.html?bot=${bot.id}" data-bot-id="${bot.id}">
          <h3>Click for details</h3>
          <p>Trope, backstory, scenario, extra images & more.</p>
        </a>
        <div class="char-name">
          <h3>${bot.name}</h3>
          ${bot.altName ? `<h5>${bot.altName}</h5>` : ''}
          ${bot.series ? `<h6>${bot.series}</h6>` : ''}
        </div>`;
    }

    // utils for different card versions
    const tags = `
      <div class="char-tags flex-row">
        ${bot.legacy ? '<span class="badge">Legacy</span>' : ''}
        ${bot.altLabel ? `<span class="badge">${bot.altLabel}</span>` : ''}
        ${bot.tags.filter(Boolean).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>`;

    // Gallery only
    const analytics = isModal ? '' : `
      <div class="char-analytics flex-row">
        ${bot.alts ? '<span class="alt-count">Alts available</span>' : ''}
        ${bot.scripts && bot.scripts.length > 0 ? `<span class="script-count">${bot.scripts.length} Script(s)</span>` : ''}
      </div>`;

    // Script downloads (modal)
    const scriptButtons = (isModal && bot.scripts && bot.scripts.length > 0) ? `
      <div class="char-actions flex-row">
        ${bot.scripts.map(s => `<a class="btn" href="${BOTS_ROOT}/${s.path}" download="${s.name}">${s.name}</a>`).join('')}
      </div>` : '';

    return `
      <article class="card ${bot.legacy ? 'legacy' : ''}">
        <img src="${image}" alt="${displayName(bot)}">
        ${top}
        <section class="char-description">
          ${tags}
          ${analytics}
          <p>${bot.previewText}</p>
        </section>
        <div class="char-actions flex-row">
          <a class="btn" href="${image}" download="${bot.id}.png">Get .png</a>
          <a class="btn" href="${card}" download="${bot.id}.json">Get .json</a>
        </div>
        ${scriptButtons}
      </article>`;
  }).join('');
}


// ==========================================================
// #region MODAL
//    showModal / hideModal
//    clear URL
// ==========================================================
function setupModal(bots, modal) {
  const title       = modal.querySelector('#modal-title');
  const cardSlot    = modal.querySelector('#modal-card-slot');
  const description = modal.querySelector('#modal-description');

  function showModal(botId) {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    title.textContent = displayName(bot);
    cardSlot.innerHTML = generateBotCards([bot], true);
    description.innerHTML = bot.fullDescription.length > 0
      ? paragraphs(bot.fullDescription)
      : '<p>Coming soon...</p>';

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function hideModal() {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    // Reset scroll on whichever panel scrolls
    modal.querySelectorAll('.modal-body, .modal-right').forEach(el => el.scrollTop = 0);
  }

  // clear URL on close
  function closeModal() {
    history.replaceState({}, '', location.pathname);
    hideModal();
  }

  // Make the modal match whatever the URL says (page load + Back/Forward buttons)
  function syncWithURL() {
    const botId = new URLSearchParams(location.search).get('bot');
    if (botId) showModal(botId);
    else hideModal();
  }

  document.addEventListener('click', event => {

    // Clicked a card (or anything else carrying data-bot-id)
    const trigger = event.target.closest('[data-bot-id]');
    if (trigger) {
      if (event.ctrlKey || event.metaKey) return;  // let "open in new tab" work
      event.preventDefault();
      const botId = trigger.dataset.botId;
      history.pushState({}, '', `?bot=${botId}`);
      showModal(botId);
      return;
    }

    // closing
    if (event.target.closest('#modal-close') || event.target === modal) {
      closeModal();
    }
  });

  // Esc closes the modal too
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  // Browser Back/Forward buttons
  window.addEventListener('popstate', syncWithURL);

  // Page loaded with ?bot=... already in the URL
  syncWithURL();
}


// ==========================================================
// #region BOTS
//    Runs on any page; only fills the containers that exist there.
// ========================================================== */
async function initBots() {
  const recentFeed    = document.querySelector('#recent-bots-feed');
  const fullGallery   = document.querySelector('#full-bots-gallery');
  const legacyGallery = document.querySelector('#legacy-bots-gallery');
  const modal         = document.querySelector('#bot-modal');

  // Skip fetch if not bot-realted
  if (!recentFeed && !fullGallery && !legacyGallery && !modal) return;

  const res = await fetch(BOTS_JSON);
  if (!res.ok) {
    console.error(`Could not load ${BOTS_JSON} (${res.status})`);
    return;
  }
  const { bots } = await res.json();

  if (recentFeed) {
    const latest = [...bots]
      .sort(newestFirst('dateAdded'))
      .slice(0, RECENT_COUNT);
    recentFeed.innerHTML = generateBotCards(latest);
  }

  const byCreated = [...bots].sort(newestFirst('dateCreated'));

  if (fullGallery) {
    fullGallery.innerHTML = generateBotCards(byCreated);
  }

  if (legacyGallery) {
    legacyGallery.innerHTML = generateBotCards(byCreated.filter(bot => bot.legacy));
  }

  if (modal) setupModal(bots, modal);
}


// ==========================================================
// #region RUN
// ========================================================== */
initBots();