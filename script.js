document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pageList = document.getElementById('page-list');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const newPageBtn = document.getElementById('new-page-btn');
    // TTS Controls
    const playPauseBtn = document.getElementById('tts-play-pause-btn');
    const progress = document.getElementById('tts-progress');
    const voiceSelect = document.getElementById('tts-voice-select');
    const rateSlider = document.getElementById('tts-rate-slider');

    // App State
    let pagesData = { "page1": { title: "Sample Page 1", content: { ops: [{ insert: 'Welcome! You can edit this text and use the toolbar to format it, including highlighting sections by changing their background color.\n' }] } } };
    let currentPageId = null;
    let quill = null;
    let voices = [];

    // --- State Management ---
    function saveState() {
        if (quill && currentPageId && pagesData[currentPageId]) {
            pagesData[currentPageId].content = quill.getContents();
        }
        try { localStorage.setItem('pagesData', JSON.stringify(pagesData)); } catch (e) { console.error("Could not save state", e); }
    }

    function loadState() {
        try {
            const savedData = localStorage.getItem('pagesData');
            if (savedData && Object.keys(JSON.parse(savedData)).length > 0) pagesData = JSON.parse(savedData);
        } catch (e) { console.error("Could not load state", e); }
    }

    // --- Page Management ---
    function renderPageList() {
        pageList.innerHTML = '';
        if (Object.keys(pagesData).length === 0) { pageList.innerHTML = '<li>No pages available.</li>'; return; }
        for (const pageId in pagesData) {
            const li = document.createElement('li');
            const titleSpan = document.createElement('span');
            titleSpan.textContent = pagesData[pageId].title;
            titleSpan.className = 'page-title';
            titleSpan.addEventListener('dblclick', () => handleRename(pageId, titleSpan));
            li.appendChild(titleSpan);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.className = 'delete-page-btn';
            deleteBtn.dataset.pageId = pageId;
            li.appendChild(deleteBtn);
            li.dataset.pageId = pageId;
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-page-btn')) handleDeletePage(e);
                else if (!e.target.classList.contains('rename-input')) loadPage(pageId);
            });
            pageList.appendChild(li);
        }
    }

    function handleRename(pageId, titleSpan) {
        const currentTitle = pagesData[pageId].title;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'rename-input';
        titleSpan.replaceWith(input);
        input.focus();
        input.select();
        const saveRename = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                pagesData[pageId].title = newTitle;
                saveState();
            }
            renderPageList();
        };
        input.addEventListener('blur', saveRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveRename();
            else if (e.key === 'Escape') renderPageList();
        });
    }

    function handleDeletePage(event) {
        event.stopPropagation();
        const pageIdToDelete = event.target.dataset.pageId;
        if (confirm(`Are you sure you want to delete "${pagesData[pageIdToDelete].title}"?`)) {
            speechSynthesis.cancel();
            delete pagesData[pageIdToDelete];
            saveState();
            renderPageList();
            if (currentPageId === pageIdToDelete) {
                quill.setText('Select a page or fetch a new one.');
                currentPageId = null;
            }
        }
    }

    function handleNewPage() {
        const newPageId = `page-${Date.now()}`;
        pagesData[newPageId] = { title: "Untitled Page", content: { ops: [{ insert: '\n' }] } };
        saveState();
        renderPageList();
        loadPage(newPageId);
    }

    function loadPage(pageId) {
        if (!pagesData[pageId] || !quill) return;
        speechSynthesis.cancel();
        currentPageId = pageId;
        quill.setContents(pagesData[pageId].content);
        Array.from(pageList.children).forEach(li => li.classList.toggle('active', li.dataset.pageId === pageId));
    }

    // --- URL Fetching ---
    async function fetchAndDisplayArticle() {
        const url = urlInput.value.trim();
        if (!url) { return alert('Please enter a URL.'); }
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        fetchBtn.textContent = 'Fetching...';
        fetchBtn.disabled = true;
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const article = new Readability(doc).parse();
            if (article && article.content) {
                const tempQuill = new Quill(document.createElement('div'));
                tempQuill.clipboard.dangerouslyPasteHTML(article.content);
                const newPageId = `page-${Date.now()}`;
                pagesData[newPageId] = { title: article.title || 'Untitled Article', content: tempQuill.getContents() };
                renderPageList();
                loadPage(newPageId);
                saveState();
            } else { alert('Could not extract article content.'); }
        } catch (error) { console.error('Error fetching article:', error); alert('Failed to fetch article.'); } finally {
            fetchBtn.textContent = 'Fetch & Annotate';
            fetchBtn.disabled = false;
        }
    }

    // --- Text-to-Speech ---
    function populateVoiceList() {
        voices = speechSynthesis.getVoices();
        voiceSelect.innerHTML = '';
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);
        });
    }

    function handlePlayPause() {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
        } else if (speechSynthesis.paused) {
            speechSynthesis.resume();
        } else {
            const range = quill.getSelection();
            let textToSpeak = range && range.length > 0 ? quill.getText(range.index, range.length) : quill.getText(range ? range.index : 0);
            if (!textToSpeak.trim()) return alert("No text to speak.");

            speechSynthesis.cancel(); // Clear any previous utterance

            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            const selectedVoiceName = voiceSelect.selectedOptions[0].getAttribute('data-name');
            utterance.voice = voices.find(voice => voice.name === selectedVoiceName);
            utterance.rate = rateSlider.value;

            utterance.onboundary = (event) => {
                progress.value = (event.charIndex / textToSpeak.length) * 100;
            };
            utterance.onend = () => {
                progress.value = 0;
                playPauseBtn.textContent = '▶';
            };

            speechSynthesis.speak(utterance);
        }
    }

    function handleTTSSettingChange() {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
            setTimeout(handlePlayPause, 100);
        }
    }

    function updateTTS_UI() {
        if (!speechSynthesis) return;
        if (speechSynthesis.paused) {
             playPauseBtn.textContent = '▶';
        } else if (speechSynthesis.speaking) {
             playPauseBtn.textContent = '❚❚';
        } else {
             playPauseBtn.textContent = '▶';
             progress.value = 0;
        }
    }

    // --- Initial Setup ---
    function initialize() {
        loadState();
        quill = new Quill('#editor', {
            theme: 'snow',
            modules: { toolbar: [
                [{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'background': ['rgba(255, 255, 0, 0.5)', 'rgba(255, 192, 203, 0.5)', 'rgba(173, 216, 230, 0.5)', false] }],
                ['clean']
            ] }
        });

        // TTS setup
        populateVoiceList();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
        playPauseBtn.addEventListener('click', handlePlayPause);
        voiceSelect.addEventListener('change', handleTTSSettingChange);
        rateSlider.addEventListener('input', handleTTSSettingChange);
        setInterval(updateTTS_UI, 250);

        // Other event listeners
        quill.on('text-change', () => {
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => saveState(), 500);
        });
        fetchBtn.addEventListener('click', fetchAndDisplayArticle);
        newPageBtn.addEventListener('click', handleNewPage);

        renderPageList();
        const firstPageId = Object.keys(pagesData)[0];
        if (firstPageId) loadPage(firstPageId);
        else quill.setText('No content.');
    }

    initialize();
});
