# Webpage Annotator

This project is a collection of tools to manage and annotate text, built primarily with the help of Google's Jules AI.

[**Try It Live**](https://dulani.github.io/webpage-annotator/index.html)

## Core Features

This list describes the current features of the application. It serves as a set of requirements that should be maintained and respected during future development.

*   **Page Management:**
    *   Fetched articles appear in a list in the sidebar.
    *   Users can delete pages from this list.

*   **URL Content Fetching:**
    *   Users can provide a URL to any public webpage.
    *   The application will fetch the page's HTML, extract the main article content (stripping away ads, navigation, etc.), and load it into the editor.

*   **Rich Text Editor:**
    *   The main content area is a rich text editor powered by [Quill.js](https://quilljs.com/).
    *   Users can perform standard text editing, including formatting (bold, italics), creating lists, and highlighting text with different background colors.

*   **Text-to-Speech:**
    *   Users can use the "Play", "Pause", and "Stop" controls to have the text in the editor read aloud using the browser's native speech synthesis engine.

*   **Data Persistence:**
    *   All data, including fetched articles and user edits, is automatically saved to the browser's `localStorage`.
    *   This ensures that all work is preserved between sessions and is not lost when the page is reloaded.
