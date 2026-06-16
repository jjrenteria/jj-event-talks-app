document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let releaseData = null;
    let activeCategory = 'All';
    let searchQuery = '';
    let sortBy = 'newest';

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = refreshBtn.querySelector('.refresh-icon');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const connectionStatus = document.getElementById('connection-status');
    const statusText = connectionStatus.querySelector('.status-text');
    
    // Stats
    const statTotal = document.getElementById('stat-total');
    const statFeature = document.getElementById('stat-feature');
    const statIssue = document.getElementById('stat-issue');
    const statChange = document.getElementById('stat-change');
    const statBreaking = document.getElementById('stat-breaking');
    const statCards = document.querySelectorAll('.stat-card');

    // Controls
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const categoryPills = document.getElementById('category-pills');
    const pills = categoryPills.querySelectorAll('.pill');
    const sortSelect = document.getElementById('sort-select');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // Feed area
    const feedSkeleton = document.getElementById('feed-skeleton');
    const releasesFeed = document.getElementById('releases-feed');
    const emptyState = document.getElementById('empty-state');

    // Modal
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountEl = document.getElementById('char-count');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
    const progressRingCircle = document.querySelector('.progress-ring__circle');
    
    // Toast
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Progress Ring Initialization
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressRingCircle.style.strokeDashoffset = circumference;

    // Toast Notification helper
    function showToast(message) {
        toastMessage.textContent = message;
        toast.classList.add('active');
        setTimeout(() => {
            toast.classList.remove('active');
        }, 2500);
    }

    // Update Connection Status UI
    function setConnectionState(state, text = '') {
        connectionStatus.className = 'status-badge';
        
        switch (state) {
            case 'fetching':
                connectionStatus.classList.add('state-fetching');
                statusText.textContent = text || 'Syncing...';
                refreshIcon.classList.add('spinning');
                refreshBtn.disabled = true;
                break;
            case 'success':
                connectionStatus.classList.add('state-success');
                statusText.textContent = text || 'Synced';
                refreshIcon.classList.remove('spinning');
                refreshBtn.disabled = false;
                break;
            case 'error':
                connectionStatus.classList.add('state-error');
                statusText.textContent = text || 'Connection Error';
                refreshIcon.classList.remove('spinning');
                refreshBtn.disabled = false;
                break;
            default:
                connectionStatus.classList.add('state-idle');
                statusText.textContent = 'Idle';
                refreshIcon.classList.remove('spinning');
                refreshBtn.disabled = false;
        }
    }

    // Set progress ring value
    function setProgressRing(percent, limitExceeded = false) {
        const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
        progressRingCircle.style.strokeDashoffset = offset;
        
        if (limitExceeded) {
            progressRingCircle.style.stroke = '#ef4444'; // Red
        } else if (percent > 90) {
            progressRingCircle.style.stroke = '#f59e0b'; // Amber
        } else {
            progressRingCircle.style.stroke = '#8b5cf6'; // Violet
        }
    }

    // Update Character Counter in X Modal
    function updateCharCounter() {
        const length = tweetTextarea.value.length;
        charCountEl.textContent = `${length} / 280`;
        
        const percent = (length / 280) * 100;
        const limitExceeded = length > 280;
        
        setProgressRing(percent, limitExceeded);
        
        if (limitExceeded) {
            charCountEl.className = 'char-count error';
            tweetSubmitBtn.disabled = true;
        } else if (length > 250) {
            charCountEl.className = 'char-count warning';
            tweetSubmitBtn.disabled = false;
        } else {
            charCountEl.className = 'char-count';
            tweetSubmitBtn.disabled = false;
        }
    }

    // Auto-Truncate text to fit Twitter 280 characters limit
    function prepareTweetDraft(dateStr, type, rawContent, link) {
        // Base structure:
        // 📢 BigQuery (June 15, 2026):
        // [Feature] <Truncated Content>
        //
        // Link: <link> #BigQuery #GoogleCloud
        
        const prefix = `📢 BigQuery Release (${dateStr}):\n[${type}] `;
        const suffix = `\n\nRead more: ${link} #BigQuery #GoogleCloud`;
        
        const maxContentLength = 280 - prefix.length - suffix.length;
        
        let content = rawContent;
        if (content.length > maxContentLength) {
            // Subtracting 3 for the ellipsis '...'
            content = content.substring(0, maxContentLength - 3) + '...';
        }
        
        return `${prefix}${content}${suffix}`;
    }

    // Fetch Release Notes from backend API
    async function fetchReleases(forceRefresh = false) {
        setConnectionState('fetching', forceRefresh ? 'Force Refreshing...' : 'Fetching notes...');
        feedSkeleton.classList.remove('hidden');
        releasesFeed.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        try {
            const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'partial_success') {
                releaseData = result.data;
                const source = result.source === 'cache' ? 'Synced (Cache)' : 'Synced (Live)';
                setConnectionState('success', source);
                
                calculateStats();
                renderFeed();
            } else {
                throw new Error(result.message || 'Unknown server error');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            setConnectionState('error', 'Error Syncing');
            
            // If we have previous cache data, keep displaying it but warn the user
            if (releaseData) {
                showToast('Sync failed. Displaying cached data.');
                renderFeed();
            } else {
                releasesFeed.innerHTML = '';
                emptyState.classList.remove('hidden');
                emptyState.querySelector('h3').textContent = 'Sync Failed';
                emptyState.querySelector('p').textContent = `We couldn't connect to the release notes server: ${error.message}`;
            }
        } finally {
            feedSkeleton.classList.add('hidden');
        }
    }

    // Calculate Dashboard Stats
    function calculateStats() {
        if (!releaseData || !releaseData.entries) return;
        
        let total = 0;
        let features = 0;
        let issues = 0;
        let changes = 0;
        let breaking = 0;

        releaseData.entries.forEach(entry => {
            entry.updates.forEach(update => {
                total++;
                const type = update.type.toLowerCase();
                if (type.includes('feature')) features++;
                else if (type.includes('issue')) issues++;
                else if (type.includes('change')) changes++;
                else if (type.includes('breaking')) breaking++;
            });
        });

        // Animate counts
        animateCount(statTotal, total);
        animateCount(statFeature, features);
        animateCount(statIssue, issues);
        animateCount(statChange, changes);
        animateCount(statBreaking, breaking);
    }

    function animateCount(element, targetValue) {
        let current = 0;
        const duration = 800; // ms
        const stepTime = Math.max(Math.floor(duration / (targetValue || 1)), 15);
        
        clearInterval(element.intervalId);
        
        if (targetValue === 0) {
            element.textContent = '0';
            return;
        }

        element.intervalId = setInterval(() => {
            // Speed up incrementing if target is large
            const increment = Math.ceil((targetValue - current) / 6);
            current += increment;
            
            if (current >= targetValue) {
                element.textContent = targetValue;
                clearInterval(element.intervalId);
            } else {
                element.textContent = current;
            }
        }, stepTime);
    }

    // Render feed based on search filters, category tags, and sorting
    function renderFeed() {
        if (!releaseData || !releaseData.entries) return;

        releasesFeed.innerHTML = '';
        let totalRendered = 0;

        // Process entries
        let entriesToProcess = JSON.parse(JSON.stringify(releaseData.entries)); // deep clone

        // Sort entries by date
        entriesToProcess.sort((a, b) => {
            const dateA = new Date(a.date_iso);
            const dateB = new Date(b.date_iso);
            return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
        });

        entriesToProcess.forEach(entry => {
            // Filter updates within entry
            const filteredUpdates = entry.updates.filter(update => {
                // Category pill check
                if (activeCategory !== 'All') {
                    // Match category normalized
                    const updateType = update.type.toLowerCase();
                    const activeNorm = activeCategory.toLowerCase();
                    
                    if (activeNorm === 'feature' && !updateType.includes('feature')) return false;
                    if (activeNorm === 'issue' && !updateType.includes('issue')) return false;
                    if (activeNorm === 'change' && !updateType.includes('change')) return false;
                    if (activeNorm === 'breaking' && !updateType.includes('breaking')) return false;
                    if (activeNorm === 'announcement' && !updateType.includes('announcement')) return false;
                }

                // Search query check
                if (searchQuery) {
                    const contentTextLower = update.content_text.toLowerCase();
                    const typeLower = update.type.toLowerCase();
                    const searchLower = searchQuery.toLowerCase();
                    
                    const matchesContent = contentTextLower.includes(searchLower);
                    const matchesType = typeLower.includes(searchLower);
                    const matchesDate = entry.date_str.toLowerCase().includes(searchLower);
                    
                    if (!matchesContent && !matchesType && !matchesDate) return false;
                }

                return true;
            });

            if (filteredUpdates.length > 0) {
                totalRendered += filteredUpdates.length;

                // Create Date group
                const dateGroup = document.createElement('div');
                dateGroup.className = 'date-group';

                const dateHeader = document.createElement('div');
                dateHeader.className = 'date-header';
                // Add anchor ID to support copy-links
                const dateAnchor = entry.date_str.replace(/[\s,]+/g, '_');
                dateHeader.id = dateAnchor;
                dateHeader.textContent = entry.date_str;
                dateGroup.appendChild(dateHeader);

                const cardsList = document.createElement('div');
                cardsList.className = 'cards-list';

                filteredUpdates.forEach(update => {
                    const card = createNoteCard(entry.date_str, entry.link, update);
                    cardsList.appendChild(card);
                });

                dateGroup.appendChild(cardsList);
                releasesFeed.appendChild(dateGroup);
            }
        });

        // Toggle feed view or empty state
        if (totalRendered === 0) {
            releasesFeed.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            releasesFeed.classList.remove('hidden');
            emptyState.classList.add('hidden');
        }
    }

    // Helper to generate a single release note card HTML element
    function createNoteCard(dateStr, entryLink, update) {
        const card = document.createElement('div');
        card.className = 'note-card';
        
        // Determine category tag class
        let tagClass = 'tag-general';
        const typeLower = update.type.toLowerCase();
        if (typeLower.includes('feature')) tagClass = 'tag-feature';
        else if (typeLower.includes('issue')) tagClass = 'tag-issue';
        else if (typeLower.includes('breaking')) tagClass = 'tag-breaking';
        else if (typeLower.includes('change')) tagClass = 'tag-change';
        else if (typeLower.includes('announcement')) tagClass = 'tag-announcement';

        // Custom card link based on anchor date
        const dateAnchor = dateStr.replace(/[\s,]+/g, '_');
        const cardShareLink = `${window.location.origin}${window.location.pathname}#${dateAnchor}`;
        
        // Use primary link if set, fallback to compiled link
        const readMoreLink = entryLink || 'https://docs.cloud.google.com/bigquery/docs/release-notes';

        card.innerHTML = `
            <div class="card-header">
                <span class="category-tag ${tagClass}">${update.type}</span>
            </div>
            <div class="card-content">
                ${update.content_html}
            </div>
            <div class="card-actions">
                <button class="btn-card-action btn-card-tweet" title="Share this update on X">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet</span>
                </button>
                <button class="btn-card-action btn-card-copy-text" title="Copiar nota al portapapeles">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copiar Nota</span>
                </button>
                <button class="btn-card-action btn-card-copy-link" title="Copiar enlace directo al portapapeles">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <span>Copiar Enlace</span>
                </button>
            </div>
        `;

        // Attach listeners
        const tweetBtn = card.querySelector('.btn-card-tweet');
        const copyTextBtn = card.querySelector('.btn-card-copy-text');
        const copyLinkBtn = card.querySelector('.btn-card-copy-link');

        tweetBtn.addEventListener('click', () => {
            const draft = prepareTweetDraft(dateStr, update.type, update.content_text, readMoreLink);
            openTweetModal(draft);
        });

        copyTextBtn.addEventListener('click', async () => {
            try {
                const text = `BigQuery Release Note (${dateStr}) - [${update.type}]\n${update.content_text}\n\nRead more: ${readMoreLink}`;
                await navigator.clipboard.writeText(text);
                showToast('¡Nota copiada al portapapeles!');
            } catch (err) {
                showToast('Error al copiar el texto.');
            }
        });

        copyLinkBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(cardShareLink);
                showToast('¡Enlace de fecha copiado!');
            } catch (err) {
                showToast('Error al copiar el enlace.');
            }
        });

        return card;
    }

    // Modal Operations
    function openTweetModal(initialText) {
        tweetTextarea.value = initialText;
        tweetModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // prevent scrolling
        updateCharCounter();
        
        // Auto focus and set selection to start of content
        setTimeout(() => {
            tweetTextarea.focus();
            tweetTextarea.setSelectionRange(0, 0);
        }, 100);
    }

    function closeTweetModal() {
        tweetModal.classList.remove('active');
        document.body.style.overflow = ''; // restore scrolling
    }

    // Theme Initialization
    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
    }

    // Event Listeners Setup
    refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Theme Switcher Listener
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        showToast(`Modo ${theme === 'light' ? 'claro' : 'oscuro'} activado`);
    });

    // CSV Exporter Listener
    exportCsvBtn.addEventListener('click', () => {
        if (!releaseData || !releaseData.entries) {
            showToast('No hay datos para exportar.');
            return;
        }

        const rows = [['Date', 'Category', 'Description', 'Link']];

        releaseData.entries.forEach(entry => {
            const filteredUpdates = entry.updates.filter(update => {
                // Category filter
                if (activeCategory !== 'All') {
                    const updateType = update.type.toLowerCase();
                    const activeNorm = activeCategory.toLowerCase();
                    if (activeNorm === 'feature' && !updateType.includes('feature')) return false;
                    if (activeNorm === 'issue' && !updateType.includes('issue')) return false;
                    if (activeNorm === 'change' && !updateType.includes('change')) return false;
                    if (activeNorm === 'breaking' && !updateType.includes('breaking')) return false;
                    if (activeNorm === 'announcement' && !updateType.includes('announcement')) return false;
                }

                // Search query filter
                if (searchQuery) {
                    const contentTextLower = update.content_text.toLowerCase();
                    const typeLower = update.type.toLowerCase();
                    const searchLower = searchQuery.toLowerCase();
                    const matchesContent = contentTextLower.includes(searchLower);
                    const matchesType = typeLower.includes(searchLower);
                    const matchesDate = entry.date_str.toLowerCase().includes(searchLower);
                    if (!matchesContent && !matchesType && !matchesDate) return false;
                }

                return true;
            });

            filteredUpdates.forEach(update => {
                const readMoreLink = entry.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
                rows.push([
                    entry.date_str,
                    update.type,
                    update.content_text,
                    readMoreLink
                ]);
            });
        });

        if (rows.length <= 1) {
            showToast('No hay notas que coincidan con los filtros para exportar.');
            return;
        }

        const csvContent = rows.map(e => e.map(val => {
            const cleanVal = (val || '').toString().replace(/"/g, '""');
            return `"${cleanVal}"`;
        }).join(",")).join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${activeCategory.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('¡CSV exportado con éxito!');
    });

    // Initialize - Fetch notes on startup
    fetchReleases();

    // Modal Events
    modalCloseBtn.addEventListener('click', closeTweetModal);
    modalCancelBtn.addEventListener('click', closeTweetModal);
    
    // Clicking outside modal content closes it
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    tweetTextarea.addEventListener('input', updateCharCounter);

    tweetSubmitBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(xUrl, '_blank', 'width=550,height=420,referrerpolicy=no-referrer');
        closeTweetModal();
    });

    // Filter pills
    categoryPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;

        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        activeCategory = pill.getAttribute('data-category');
        renderFeed();
    });

    // Stats Dashboard quick filters
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.getAttribute('data-filter');
            
            // Find and activate the matching pill
            pills.forEach(p => {
                if (p.getAttribute('data-category') === filterType) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });

            activeCategory = filterType;
            renderFeed();
            
            // Scroll control panel into view if needed
            categoryPills.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });

    // Search input
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        
        if (searchQuery) {
            searchClearBtn.style.display = 'block';
        } else {
            searchClearBtn.style.display = 'none';
        }

        // Debounce rendering slightly for smooth typing feel
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderFeed();
        }, 150);
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        renderFeed();
        searchInput.focus();
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderFeed();
    });

    // Reset filters empty state button
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        
        pills.forEach(p => {
            if (p.getAttribute('data-category') === 'All') {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
        activeCategory = 'All';
        
        renderFeed();
    });

    // Initialize - Fetch notes on startup
    fetchReleases();

    // Check if URL has a hash for deep link scrolling
    setTimeout(() => {
        if (window.location.hash) {
            const targetElement = document.querySelector(window.location.hash);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
                targetElement.classList.add('highlight-scroll');
                setTimeout(() => {
                    targetElement.classList.remove('highlight-scroll');
                }, 3000);
            }
        }
    }, 1200); // Wait for feed to fetch and render
});
