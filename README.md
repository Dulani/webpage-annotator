# Webpage Annotator

This project is a collection of tools to manage and annotate text, built primarily with the help of Google's Jules AI.

[**Try It Live**](https://dulani.github.io/webpage-annotator/index.html)

## Core Features

This list describes the current features of the application. It serves as a set of requirements that should be maintained and respected during future development.

*   **URL Content Fetching:**
    *   Users can provide a URL to any public webpage.
    *   The application will fetch the page's HTML, extract the main article content (stripping away ads, navigation, etc.), and load it into the editor.

*   **Rich Text Editor:**
    *   The main content area is a rich text editor powered by [Quill.js](https://quilljs.com/).
    *   Users can perform standard text editing, including formatting (bold, italics), creating lists, and changing colors.

*   **Highlighting & Commenting:**
    *   Users can highlight any piece of text by selecting it and choosing a background color from the toolbar.
    *   Clicking on an existing highlight opens a sidebar where a user can add or edit a comment associated with that specific highlight.
    *   The application links highlights to their comments via a unique ID.

*   **Data Persistence:**
    *   All data, including fetched articles, user edits, highlights, and comments, is automatically saved to the browser's `localStorage`.
    *   This ensures that all work is preserved between sessions and is not lost when the page is reloaded.
