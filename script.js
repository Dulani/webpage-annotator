document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pageList = document.getElementById('page-list');
    const textContentDiv = document.getElementById('text-content');
    const editBtn = document.getElementById('edit-btn');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const colorPaletteToolbar = document.querySelector('.toolbar'); // Get the toolbar
    const colorBtns = document.querySelectorAll('.color-btn');

    const annotationPopup = document.getElementById('annotation-popup');
    const closePopupBtn = annotationPopup.querySelector('.close-btn');
    const changeColorBtn = document.getElementById('change-color-btn');
    const addCommentBtn = document.getElementById('add-comment-btn');
    const deleteAnnotationBtn = document.getElementById('delete-annotation-btn');

    const commentModal = document.getElementById('comment-modal');
    const closeCommentModalBtn = commentModal.querySelector('.close-comment-modal-btn');
    const commentInput = document.getElementById('comment-input');
    const saveCommentBtn = document.getElementById('save-comment-btn');

    // App State
    let pagesData = {
        "page1": {
            title: "Sample Page 1",
            content: "<p>This is the first sample page. It contains some text that can be highlighted and annotated.</p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>",
            annotations: []
        },
        "page2": {
            title: "Sample Page 2",
            content: "<p>This is another example page. Feel free to select text and try out the highlighting features.</p><p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>",
            annotations: []
        },
        "page3": {
            title: "A Short Story",
            content: "<p>Once upon a time, in a land far away, there lived a curious programmer who wanted to build a text annotation tool.</p><p>The programmer worked diligently, crafting HTML, CSS, and JavaScript to bring their vision to life. Many cups of coffee were consumed during this endeavor.</p><p>Finally, the tool was complete, and it allowed users to highlight text, add comments, and marvel at the power of web technologies.</p>",
            annotations: []
        }
    };
    let currentPageId = null;
    let selectedAnnotation = null; // To keep track of the clicked annotation span
    let isEditing = false;
    let currentHighlightColor = 'yellow'; // Default highlight color

    // --- Page Loading and Rendering ---

    function renderPageList() {
        pageList.innerHTML = ''; // Clear existing list
        if (Object.keys(pagesData).length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No pages available.';
            pageList.appendChild(li);
            return;
        }
        for (const pageId in pagesData) {
            const page = pagesData[pageId];
            const li = document.createElement('li');
            li.textContent = page.title;
            li.dataset.pageId = pageId;
            li.addEventListener('click', () => loadPage(pageId));
            pageList.appendChild(li);
        }
    }

    function loadPage(pageId) {
        if (!pagesData[pageId]) {
            console.error("Page not found:", pageId);
            textContentDiv.innerHTML = "<p>Error: Page not found.</p>";
            return;
        }
        currentPageId = pageId;
        textContentDiv.innerHTML = pagesData[pageId].content;
        renderAnnotations(pageId); // Render existing annotations for this page
        console.log(`Loaded page: ${pagesData[pageId].title}`);

        // Highlight the selected page in the list
        Array.from(pageList.children).forEach(li => {
            li.classList.remove('active');
            if (li.dataset.pageId === pageId) {
                li.classList.add('active');
            }
        });
    }

    // --- Text Selection and Highlighting ---

    // Hide toolbar initially (CSS already does this, but good for consistency)
    if (colorPaletteToolbar) {
        colorPaletteToolbar.classList.remove('active');
    }

    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection.isCollapsed && textContentDiv.contains(selection.anchorNode) && textContentDiv.contains(selection.focusNode)) {
            // Check if the selection is within an editable area and not part of an existing annotation interaction
            if (!isEditing && annotationPopup.style.display === 'none' && commentModal.style.display === 'none') {
                 if (colorPaletteToolbar) colorPaletteToolbar.classList.add('active');
            }
        } else {
            // Hide toolbar if selection is collapsed or outside relevant area
            // Add a small delay to allow clicking on buttons in the toolbar
            setTimeout(() => {
                const newSelection = window.getSelection();
                if (newSelection.isCollapsed) {
                    if (colorPaletteToolbar) colorPaletteToolbar.classList.remove('active');
                }
            }, 200);
        }
    });

    // Helper to create an annotation from the current selection (if valid)
    function createAnnotationFromCurrentSelection(selectedColor) {
        if (isEditing || !currentPageId) return;

        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        if (!textContentDiv.contains(range.commonAncestorContainer)) {
            console.warn("Selection is outside the content area.");
            return;
        }

        // Prevent creating annotations that overlap existing highlights
        if (
            (range.startContainer.parentElement && range.startContainer.parentElement.classList.contains('highlight')) ||
            (range.endContainer.parentElement && range.endContainer.parentElement.classList.contains('highlight')) ||
            (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE && range.commonAncestorContainer.classList && range.commonAncestorContainer.classList.contains('highlight')) ||
            (range.commonAncestorContainer.nodeType !== Node.ELEMENT_NODE && range.commonAncestorContainer.parentElement && range.commonAncestorContainer.parentElement.classList.contains('highlight'))
        ) {
            console.log("Selection is already part of an annotation or contains one.");
            return;
        }

        const annotationId = Date.now().toString();
        const newAnnotation = {
            id: annotationId,
            color: selectedColor,
            comment: "",
            // Storing range requires more robust serialization.
            // For simplicity, we'll store paths and offsets.
            // This is still simplified and might break with complex HTML edits.
            startContainerPath: getPathTo(range.startContainer),
            startOffset: range.startOffset,
            endContainerPath: getPathTo(range.endContainer),
            endOffset: range.endOffset,
        };

        const span = document.createElement('span');
        span.className = `highlight ${newAnnotation.color}`;
        span.dataset.annotationId = newAnnotation.id;
        span.addEventListener('click', handleAnnotationClick);

        try {
            if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
                range.surroundContents(span);
            } else {
                const fragment = range.extractContents();
                span.appendChild(fragment);
                range.insertNode(span);
            }
            selection.removeAllRanges();

            if (!pagesData[currentPageId].annotations) {
                pagesData[currentPageId].annotations = [];
            }
            pagesData[currentPageId].annotations.push(newAnnotation);
            console.log(`Annotation created:`, newAnnotation);
        } catch (e) {
            console.error("Error surrounding contents:", e);
            // Restore selection if highlighting failed
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }


    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentHighlightColor = btn.dataset.color;
            colorBtns.forEach(b => b.classList.remove('active-color'));
            btn.classList.add('active-color');
            console.log("Highlight color set to:", currentHighlightColor);
            // Toolbar should remain visible after color selection if text is still selected.
            // The selectionchange event will handle hiding it if selection is lost.
            
            // New feature: apply highlight immediately if there's an active selection
            createAnnotationFromCurrentSelection(currentHighlightColor);
        });
    });
    // Set default selected color button
    const defaultColorButton = document.querySelector(`.color-btn[data-color="${currentHighlightColor}"]`);
    if (defaultColorButton) {
        defaultColorButton.classList.add('active-color');
    }

    function getPathTo(element) {
        if (element === textContentDiv) return [];
        if (!element.parentNode) return null; // Should not happen in this context

        const path = [];
        let child = element;
        while (child.parentNode !== textContentDiv) {
            const parent = child.parentNode;
            if (!parent) return null; // Should not happen if element is within textContentDiv
            const children = Array.from(parent.childNodes);
            const index = children.indexOf(child);
            path.unshift(index);
            child = parent;
        }
        const childrenOfRoot = Array.from(textContentDiv.childNodes);
        path.unshift(childrenOfRoot.indexOf(child));
        return path;
    }

    function getNodeByPath(path) {
        let node = textContentDiv;
        for (const index of path) {
            if (!node.childNodes[index]) return null;
            node = node.childNodes[index];
        }
        return node;
    }


    textContentDiv.addEventListener('mouseup', () => {
        if (isEditing || !currentPageId) return;
        createAnnotationFromCurrentSelection(currentHighlightColor);
    });

    function handleAnnotationClick(event) {
        event.stopPropagation(); // Prevent mouseup on textContentDiv from firing
        if (isEditing) return; // Don't open popup if in edit mode
        selectedAnnotation = event.target;
        openModal(annotationPopup);
    }

    // --- Edit Button Functionality ---
    editBtn.addEventListener('click', () => {
        isEditing = !isEditing;
        textContentDiv.contentEditable = isEditing;
        editBtn.textContent = isEditing ? 'Save Text' : 'Edit Text';
        editBtn.style.backgroundColor = isEditing ? '#d9534f' : '#5cb85c'; // Red for save, green for edit

        if (!isEditing && currentPageId) {
            // Save changes
            pagesData[currentPageId].content = textContentDiv.innerHTML;
            // After saving, annotations need to be re-evaluated or re-applied
            // because their DOM paths might have changed. This is a complex problem.
            // A simple approach: clear existing annotation spans and re-render based on stored data.
            // This assumes the underlying text nodes for annotations still exist in similar relative positions.
            // More robust solutions involve complex diffing and path recalculation.

            // Clear all highlight spans first
            textContentDiv.querySelectorAll('.highlight').forEach(span => {
                const parent = span.parentNode;
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
                parent.normalize();
            });

            // Re-render annotations. The paths in `pagesData` are based on the *original* structure
            // or the structure *before* the last edit. This will likely be problematic if text
            // containing an annotation was significantly altered or removed.
            // For this demo, we'll attempt to re-render. If paths are invalid, those annotations won't show.
            // A truly robust system needs to update annotation ranges upon text edit.
            renderAnnotations(currentPageId);
            console.log("Text saved. Annotations re-rendered (best effort).");
        } else if (isEditing) {
            // Optionally, indicate that annotations cannot be interacted with during editing.
            // For example, by temporarily removing their click listeners or styling them differently.
            // For now, the `handleAnnotationClick` and `mouseup` listeners check `isEditing`.
            console.log("Text editing enabled. Annotation interaction is disabled.");
        }
    });


    // TODO: Color button functionality (already partially done by selecting currentHighlightColor)

    // --- Annotation Popup Actions ---

    changeColorBtn.addEventListener('click', () => {
        if (!selectedAnnotation || !currentPageId) return;
        // Simple: Cycle through available colors or open a color picker
        // For now, let's just allow picking from the existing toolbar colors
        // This would require a small UI to pick the new color from the popup.
        // For simplicity, let's assume the user has already selected a new color from the main toolbar.
        const newColor = currentHighlightColor; // Use the globally selected color
        const annotationId = selectedAnnotation.dataset.annotationId;
        const annotation = pagesData[currentPageId].annotations.find(a => a.id === annotationId);

        if (annotation) {
            selectedAnnotation.classList.remove(annotation.color); // Remove old color class
            selectedAnnotation.classList.add(newColor); // Add new color class
            annotation.color = newColor;
            console.log(`Annotation ${annotationId} color changed to ${newColor}`);
        }
        closeModal(annotationPopup);
    });

    addCommentBtn.addEventListener('click', () => {
        if (!selectedAnnotation || !currentPageId) return;
        const annotationId = selectedAnnotation.dataset.annotationId;
        const annotation = pagesData[currentPageId].annotations.find(a => a.id === annotationId);
        if (annotation) {
            commentInput.value = annotation.comment || '';
            openModal(commentModal);
        }
        closeModal(annotationPopup); // Close annotation popup, open comment modal
    });

    deleteAnnotationBtn.addEventListener('click', () => {
        if (!selectedAnnotation || !currentPageId) return;
        const annotationId = selectedAnnotation.dataset.annotationId;

        // Remove from data
        pagesData[currentPageId].annotations = pagesData[currentPageId].annotations.filter(a => a.id !== annotationId);

        // Remove from DOM
        const parent = selectedAnnotation.parentNode;
        while (selectedAnnotation.firstChild) {
            parent.insertBefore(selectedAnnotation.firstChild, selectedAnnotation);
        }
        parent.removeChild(selectedAnnotation);
        parent.normalize(); // Merges adjacent text nodes

        selectedAnnotation = null;
        console.log(`Annotation ${annotationId} deleted`);
        closeModal(annotationPopup);
    });


    // --- Comment Modal Actions ---
    saveCommentBtn.addEventListener('click', () => {
        // selectedAnnotation should still be the span element that was clicked to trigger
        // the 'add comment' flow.
        if (!selectedAnnotation || !currentPageId) {
            console.error("No annotation selected for saving comment (selectedAnnotation is null).");
            closeModal(commentModal);
            commentInput.value = '';
            return;
        }
        const annotationId = selectedAnnotation.dataset.annotationId;
        const annotation = pagesData[currentPageId].annotations.find(a => a.id === annotationId);
        if (annotation) {
            annotation.comment = commentInput.value;
            console.log(`Comment saved for annotation ${annotationId}: "${annotation.comment}"`);
            selectedAnnotation.title = annotation.comment; // Show comment on hover
        } else {
            console.error(`Annotation with ID ${annotationId} not found in page data.`);
        }
        closeModal(commentModal);
        commentInput.value = ''; // Clear textarea
    });

    // --- Annotation Rendering ---
    function renderAnnotations(pageId) {
        const page = pagesData[pageId];
        if (!page || !page.annotations || page.annotations.length === 0) {
            // If the page has HTML content but no annotations, ensure the original HTML is there.
            // This is implicitly handled by loadPage setting textContentDiv.innerHTML first.
            return;
        }

        // Reset content to base HTML before applying annotations
        // This is crucial if annotations were previously rendered or if content was edited.
        // However, if content can be edited AND have annotations, this strategy needs to be more robust.
        // For now, assuming loadPage sets the "clean" HTML.
        // textContentDiv.innerHTML = pagesData[pageId].content; // Already done by loadPage

        page.annotations.forEach(annotation => {
            try {
                const startContainer = getNodeByPath(annotation.startContainerPath);
                const endContainer = getNodeByPath(annotation.endContainerPath);

                if (!startContainer || !endContainer) {
                    console.warn("Could not find nodes for annotation when rendering:", annotation, "StartPath:", annotation.startContainerPath, "EndPath:", annotation.endContainerPath);
                    // Attempt to log current state of nodes for debugging
                    // console.log("Start container actual:", getNodeByPath(annotation.startContainerPath));
                    // console.log("End container actual:", getNodeByPath(annotation.endContainerPath));
                    return;
                }

                const range = document.createRange();
                range.setStart(startContainer, annotation.startOffset);
                range.setEnd(endContainer, annotation.endOffset);

                // Check if this specific annotation is already rendered to prevent duplicates
                let alreadyRendered = false;
                const existingSpans = textContentDiv.querySelectorAll(`span.highlight[data-annotation-id="${annotation.id}"]`);
                if (existingSpans.length > 0) {
                     // More specific check: does one of these spans exactly cover the range?
                     // This is complex. For now, if a span with this ID exists, assume it's rendered.
                    alreadyRendered = true;
                }

                // A simpler check: if the parent of the start container is already this annotation's span
                if (startContainer.parentNode && startContainer.parentNode.dataset && startContainer.parentNode.dataset.annotationId === annotation.id) {
                    alreadyRendered = true;
                }


                if (alreadyRendered) {
                    // Ensure click handler and title are up-to-date if already rendered
                    existingSpans.forEach(span => {
                        if (!span.onclick) { // Check if event listener is already attached (simple check)
                             span.addEventListener('click', handleAnnotationClick);
                        }
                        if (annotation.comment) span.title = annotation.comment;
                    });
                    // console.log("Annotation already rendered or parent is the highlight:", annotation.id);
                    return;
                }


                const span = document.createElement('span');
                span.className = `highlight ${annotation.color}`;
                span.dataset.annotationId = annotation.id;
                span.addEventListener('click', handleAnnotationClick);
                if (annotation.comment) {
                    span.title = annotation.comment;
                }

                // Ensure not to wrap an existing highlight span if paths are slightly off due to prior manipulations
                if (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE && range.commonAncestorContainer.classList.contains('highlight')) {
                    console.warn("Attempted to wrap an existing highlight span. Skipping annotation:", annotation.id);
                    return;
                }


                if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
                    range.surroundContents(span);
                } else {
                    const fragment = range.extractContents();
                    span.appendChild(fragment);
                    range.insertNode(span);
                }
                 // console.log("Re-rendered annotation:", annotation.id);

            } catch (e) {
                console.error("Error re-rendering annotation:", annotation.id, e, "Paths:", annotation.startContainerPath, annotation.endContainerPath);
            }
        });
        textContentDiv.normalize();
    }

    // --- Basic Modal Functionality ---
    function openModal(modal) {
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }

    if (closePopupBtn) {
        closePopupBtn.onclick = () => closeModal(annotationPopup);
    }

    if (closeCommentModalBtn) {
        closeCommentModalBtn.onclick = () => closeModal(commentModal);
    }

    window.onclick = (event) => {
        if (event.target === annotationPopup) {
            closeModal(annotationPopup);
        }
        if (event.target === commentModal) {
            closeModal(commentModal);
        }
    };

    // --- URL Fetching ---
    async function fetchAndDisplayArticle() {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a URL.');
            return;
        }

        // Simple validation for URL format
        try {
            new URL(url);
        } catch (_) {
            alert('Please enter a valid URL.');
            return;
        }

        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

        // Give user feedback that something is happening
        fetchBtn.textContent = 'Fetching...';
        fetchBtn.disabled = true;

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();

            // Note: Readability modifies the DOM it's given.
            // To avoid messing up the current page's DOM, we parse the fetched HTML
            // into a new document.
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // We also need to set the document's URL for Readability to resolve relative links correctly.
            // Although we don't display images/links from the article, it's good practice.
            doc.baseURI = url;

            const reader = new Readability(doc);
            const article = reader.parse();

            if (article && article.content) {
                const newPageId = `page-${Date.now()}`;
                pagesData[newPageId] = {
                    title: article.title || 'Untitled Article',
                    content: article.content,
                    annotations: []
                };
                renderPageList();
                loadPage(newPageId);
                urlInput.value = ''; // Clear input
            } else {
                alert('Could not extract article content. Please try another URL.');
            }
        } catch (error) {
            console.error('Error fetching or parsing article:', error);
            alert('Failed to fetch or parse the article. See console for details.');
        } finally {
            // Restore button state
            fetchBtn.textContent = 'Fetch & Annotate';
            fetchBtn.disabled = false;
        }
    }

    if(fetchBtn) {
        fetchBtn.addEventListener('click', fetchAndDisplayArticle);
    }


    // --- Initial Setup ---
    renderPageList();
    // Load the first page by default if pages exist
    const firstPageId = Object.keys(pagesData)[0];
    if (firstPageId) {
        loadPage(firstPageId);
    } else {
        textContentDiv.innerHTML = "<p>No sample pages available to display.</p>";
    }
    console.log("Text Annotation tool initialized.");
});
