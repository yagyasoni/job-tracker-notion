    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import App from './App.jsx'; // Import your main App component

    // Get the root element from popup.html
    const rootElement = document.getElementById('root');

    // Create a React root and render the App component
    if (rootElement) {
        ReactDOM.createRoot(rootElement).render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    } else {
        console.error("Root element with ID 'root' not found in popup.html. This is required for the React app to render.");
    }
    