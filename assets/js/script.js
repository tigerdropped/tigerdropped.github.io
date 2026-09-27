// #region Fetching recent bot data

async function loadBots() {
    const res = await fetch('/bots/data.json');
    const { bots } = await res.json();

    const latest = [...bots]
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 3);

    document.querySelector('#recent-bots-feed').innerHTML = latest.map(bot => `
            <article class="card ${bot.legacy ? 'legacy' : ''}">
              <img src="${bot.thumbnail}" alt="${bot.name}${bot.altName && ` ${bot.altName}`}">
              <div class="char-name">
                ${bot.alt ? '<span class="alt">ALT</span>' : ''}
                <h3>${bot.name}</h3>
                ${bot.altName && `<h5>${bot.altName}</h5>`}
                ${bot.series && `<h6>${bot.series}</h6>`}
              </div>
              <section class="char-description">
                <div class="char-tags flex-row">
                    ${bot.legacy ? '<span class="badge">Legacy</span>' : ''}
                    ${bot.tags.filter(tag => tag).map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <p>${bot.previewText}</p>
              </section>
              <div class="char-actions flex-row">
                <a class="btn" href="${bot.thumbnail}" download="${bot.thumbnail}">Get .png</a>
                <a class="btn" href="${bot.card}" download="${bot.card}">Get .json</a>
              </div>
            </article>
        `).join('');
}
loadBots();