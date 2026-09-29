async function loadBots() {
  // Fetch data
  const res = await fetch('/bots/data.json');    
  const { bots } = await res.json();

  // Modal utils 
  const modal = document.querySelector('#bot-modal');

  // Container identification
  const recentFeed = document.querySelector('#recent-bots-feed');
  const fullGallery = document.querySelector('#full-bots-gallery');
  const legacyGallery = document.querySelector('#legacy-bots-gallery');

  // Logic
  if (recentFeed) {
    const latest = [...bots]
      .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
      .slice(0, 5);

      recentFeed.innerHTML = generateBotCards(latest);
  }

  // Bots subdirectory logic
  if (fullGallery) {
    const allBots = [...bots]
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
            
      fullGallery.innerHTML = generateBotCards(allBots);
  }

  if (legacyGallery) {
    const legacyBots = [...bots]
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
      .filter(bots => bots.legacy === true);
            
      console.log(legacyBots)
      legacyGallery.innerHTML = generateBotCards(legacyBots);
  }

  if (modal) {
    const modalClose = document.querySelector('#modal-close');
    const modalTitle = document.querySelector('#modal-title');
    const modalCardSlot = document.querySelector('#modal-card-slot');
    const modalDescription = document.querySelector('#modal-description');

    // Opening the modal
    window.openModal = function(botId) {
      
      // Find the specific bot data
      const bot = bots.find(b => b.id === botId);
      if (!bot) return;

      // Generate header content
      modalTitle.textContent = [bot.name + ' ' + bot.altName];

      // left side reuses default cards
      modalCardSlot.innerHTML = generateBotCards([bot], true);

      // Generating right side
      // Complete description
      modalDescription.innerHTML = bot.fullDescription.length > 0 
        ? bot.fullDescription.map(p => `<p>${p}</p>`).join('') 
        : '<p>Coming soon...</p>';

      // Show modal and lock body scrolling
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    };

    // Closing the modal
    modalClose.addEventListener('click', () => {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');

      // URL clear
      window.history.replaceState({}, document.title, window.location.pathname);

      // Reset scroll position
      const scrollableArea = document.querySelector('.modal-body, .modal-right');  
    
      // Check if it exists just to be safe, then reset its scroll position
      if (scrollableArea) {
        scrollableArea.scrollTop = 0;
      }
    });

    // 3. Optional: Read URL parameter on page load
    const urlParams = new URLSearchParams(window.location.search);
    const targetBot = urlParams.get('bot');
    if (targetBot) {
      openModal(targetBot);
    }
  }  


  // Interceptor
  window.handleCardClick = function(event, botId) {
    const modal = document.querySelector('#bot-modal');
    
    // If the modal exists on the current page, we are in the gallery
    if (modal) {
        event.preventDefault(); // Stop the browser from reloading the page
        openModal(botId);       // Open the modal smoothly
        // Shareable link function
        window.history.pushState({}, '', `?bot=${botId}`);
    }
  };
}

// Bot card generator
function generateBotCards(botArray, isModal = false) {
    return botArray.map(bot => {
        const thumbnail = `/bots/files/${bot.slug}.png`;
        const cardPath = `/bots/files/${bot.slug}.json`;
    return `
        <article class="card ${bot.legacy ? 'legacy' : ''}">
          <img src="${thumbnail}" alt="${bot.name}${bot.altName ? ` ${bot.altName}` : ''}">

          ${!isModal ? `
          <a class="redirect-overlay" href="/bots/index.html?bot=${bot.id}" rel="noopener noreferrer" onclick="handleCardClick(event, '${bot.id}')">
            <h3>Click for details</h3>
            <p>Trope, backstory, scenario, extra images & more.</p>
          </a>
          <div class="char-name">
            <h3>${bot.name}</h3>
            ${bot.altName ? `<h5>${bot.altName}</h5>` : ''}
            ${bot.series ? `<h6>${bot.series}</h6>` : ''}
          </div>
          ` : `
            ${bot.series ? `              
            <div class="char-name">
              <h6>${bot.series}</h6>
            </div>` : ''}
          `}

          <section class="char-description">
            ${!isModal ? `
              <div class="char-tags flex-row">
                ${bot.legacy ? '<span class="badge">Legacy</span>' : ''}
                ${bot.tags.filter(tag => tag).map(tag => `<span class="tag">${tag}</span>`).join('')}
              </div>
              <div class="char-analytics flex-row">${bot.alts ? `<span class="alt-count">Alts available</span>` : ''}${bot.scripts && bot.scripts.length > 0 ? `<span class="script-count">${bot.scripts.length} Script(s)</span>` : ''}</div>
            ` : `
              <div class="char-tags flex-row">
                ${bot.legacy ? '<span class="badge">Legacy</span>' : ''}
                ${bot.tags.filter(tag => tag).map(tag => `<span class="tag">${tag}</span>`).join('')}
              </div>
            `}
            <p>${bot.previewText}</p>
          </section>
          <div class="char-actions flex-row">
            <a class="btn" href="${thumbnail}" download>Get .png</a>
            <a class="btn" href="${cardPath}" download>Get .json</a>
          </div>
        </article>
    `;
  }).join('');
}

loadBots();