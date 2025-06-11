import React, { useState, useEffect } from 'react';
import { RefreshCcw, Save, Link, Building, Briefcase, Info, Tag } from 'lucide-react'; // Added Tag icon

// Main App component for the Chrome Extension popup
const App = () => {
    // State variables for Notion API Key, Database ID, Job URL, and extracted data
    const [notionApiKey, setNotionApiKey] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');
    const [jobUrl, setJobUrl] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [jobStatus, setJobStatus] = useState('Applied'); // New state for job status, default to 'Applied'
    const [statusMessage, setStatusMessage] = useState(''); // To display messages to the user (e.g., success, error)
    const [isSavingConfig, setIsSavingConfig] = useState(false); // To indicate if config is being saved
    const [isScraping, setIsScraping] = useState(false); // To indicate if scraping is in progress
    const [isAddingToNotion, setIsAddingToNotion] = useState(false); // To indicate if Notion update is in progress

    // Effect to load configuration (API Key, Database ID) from Chrome storage on component mount
    useEffect(() => {
        // Check if chrome.storage is available (it won't be in a regular browser environment)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId'], (result) => {
                if (result.notionApiKey) {
                    setNotionApiKey(result.notionApiKey);
                }
                if (result.notionDatabaseId) {
                    setNotionDatabaseId(result.notionDatabaseId);
                }
                setStatusMessage('Configuration loaded from Chrome storage.');
            });
        } else {
            setStatusMessage('Chrome storage API not available. Running in development mode (simulated storage).');
        }
    }, []);

    // Function to save Notion configuration to Chrome storage
    const saveConfig = () => {
        if (!notionApiKey || !notionDatabaseId) {
            setStatusMessage('Please enter both Notion API Key and Database ID.');
            return;
        }

        setIsSavingConfig(true);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ notionApiKey, notionDatabaseId }, () => {
                setStatusMessage('Notion configuration saved successfully!');
                setIsSavingConfig(false);
            });
        } else {
            // Simulate saving for development environment if chrome.storage is not available
            setTimeout(() => {
                setStatusMessage('Notion configuration saved (simulated).');
                setIsSavingConfig(false);
            }, 500);
        }
    };

    // Function to handle scraping job details
    const handleScrapeDetails = async () => {
        setStatusMessage(''); // Clear previous status
        setIsScraping(true);

        if (!jobUrl) {
            setStatusMessage('Error: Please enter a Job Posting URL to scrape.');
            setIsScraping(false);
            return;
        }

        // Ensure the chrome.runtime API is available
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            setStatusMessage('Error: Chrome runtime API not available. This app must run as a Chrome Extension.');
            setIsScraping(false);
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'scrapeJobDetails',
                jobUrl,
            });

            if (response.success) {
                // Update the UI with scraped data
                setCompanyName(response.data.companyName || '');
                setJobTitle(response.data.jobTitle || '');
                setLocation(response.data.location || '');
                setDescription(response.data.description || '');
                setStatusMessage(`Success: ${response.message}`);
            } else {
                setStatusMessage(`Error: ${response.message || 'Failed to scrape job posting.'}`);
                // Clear any pre-filled scraped data on error
                setCompanyName('');
                setJobTitle('');
                setLocation('');
                setDescription('');
            }
        } catch (error) {
            console.error('Error sending message to background script for scraping:', error);
            setStatusMessage(`Error: Could not communicate with background script. ${error.message}`);
        } finally {
            setIsScraping(false);
        }
    };

    // Function to handle adding job details to Notion
    const handleAddJobToNotion = async () => {
        setStatusMessage(''); // Clear previous status
        setIsAddingToNotion(true);

        if (!notionApiKey || !notionDatabaseId || !jobUrl || !companyName || !jobTitle || !location || !description) {
            setStatusMessage('Error: Please ensure Notion configuration is saved, URL is present, and job details are scraped or filled.');
            setIsAddingToNotion(false);
            return;
        }

        // Ensure the chrome.runtime API is available
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            setStatusMessage('Error: Chrome runtime API not available. This app must run as a Chrome Extension.');
            setIsAddingToNotion(false);
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'addJobToNotion',
                notionApiKey,
                notionDatabaseId,
                jobUrl,
                companyName,
                jobTitle,
                location,
                description,
                status: jobStatus, // Pass the selected job status
            });

            if (response.success) {
                setStatusMessage(`Success: ${response.message}`);
                // Optionally clear fields after successful addition
                setJobUrl('');
                setCompanyName('');
                setJobTitle('');
                setLocation('');
                setDescription('');
                setJobStatus('Applied'); // Reset status to default
            } else {
                setStatusMessage(`Error: ${response.message}`);
            }
        } catch (error) {
            console.error('Error sending message to background script for Notion:', error);
            setStatusMessage(`Error: Could not communicate with background script. ${error.message}`);
        } finally {
            setIsAddingToNotion(false);
        }
    };

    return (
        <div id="root-container">
            <h1 className="title">Job Posting to Notion</h1>

            <div className="section">
                <label>Notion API Key:</label>
                <input
                    type="text"
                    value={notionApiKey}
                    onChange={(e) => setNotionApiKey(e.target.value)}
                    placeholder="Enter your Notion Integration Token"
                />
                <label>Notion Database ID:</label>
                <input
                    type="text"
                    value={notionDatabaseId}
                    onChange={(e) => setNotionDatabaseId(e.target.value)}
                    placeholder="Enter your Notion Database ID"
                />
                <button
                    onClick={saveConfig}
                    className="btn btn-secondary"
                    disabled={isSavingConfig}
                >
                    {isSavingConfig ? (
                        <>
                            <div className="loading-spinner"></div> Saving Config...
                        </>
                    ) : (
                        <>
                            <Save size={16} /> Save Notion Config
                        </>
                    )}
                </button>
                <p className="hint">
                    <Info size={12} className="icon-inline" />
                    Find your Notion Integration Token (API Key) under "Settings & members" &gt; "Integrations". Share your database with the integration.
                    <br />
                    Find your Database ID in the URL: `https://www.notion.so/&#123;your_workspace_name&#125;/&#123;DATABASE_ID&#125;?v=&#123;view_id&#125;`
                </p>
            </div>

            <hr />

            <div className="section">
                <label>Job Posting URL:</label>
                <input
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="e.g., https://example.com/job/senior-dev"
                />
            </div>

            <div className="section">
                <label>Company Name (Scraped/Editable):</label>
                <div className="input-group">
                    <Building size={16} />
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g., Google"
                    />
                </div>

                <label>Job Title (Scraped/Editable):</label>
                <div className="input-group">
                    <Briefcase size={16} />
                    <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g., Software Engineer"
                    />
                </div>

                <label>Location (Scraped/Editable):</label>
                <div className="input-group">
                    <Link size={16} />
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., Remote, Mountain View, CA"
                    />
                </div>

                <label>Description (Scraped/Editable):</label>
                <div className="input-group">
                    <Info size={16} />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Summary of job description..."
                        rows="3"
                    ></textarea>
                </div>

                <label>Status:</label>
                <div className="input-group">
                    <Tag size={16} />
                    <select
                        value={jobStatus}
                        onChange={(e) => setJobStatus(e.target.value)}
                        style={{ width: 'calc(100% - 20px)', padding: '8px 10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                    >
                        <option value="Applied">Applied</option>
                        <option value="Wishlist">Wishlist</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Offer">Offer</option>
                        <option value="Closed">Closed</option>
                        <option value="N/A">N/A</option>
                    </select>
                </div>
                 <div style={{ display: 'flex', gap: '10px'}}>
                    <button
                        onClick={handleScrapeDetails}
                        className="btn btn-primary"
                        disabled={isScraping}
                        style={{ flex: 1 }} // Make buttons take equal width
                    >
                        {isScraping ? (
                            <>
                                <div className="loading-spinner"></div> Scraping...
                            </>
                        ) : (
                            <>
                                <RefreshCcw size={16} /> Scrape Details
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleAddJobToNotion}
                        className="btn btn-primary"
                        disabled={isAddingToNotion || !companyName || !jobTitle || !location || !description} // Disable if details are not filled
                        style={{ flex: 1 }} // Make buttons take equal width
                    >
                        {isAddingToNotion ? (
                            <>
                                <div className="loading-spinner"></div> Add to Notion...
                            </>
                        ) : (
                            <>
                                <Save size={16} /> Add to Notion
                            </>
                        )}
                    </button>
                </div>
            </div>
            {statusMessage && (
                <div className={`status-message ${statusMessage.startsWith('Error:') ? 'status-error' : 'status-success'}`}>
                    {statusMessage}
                </div>
            )}
        </div>
    );
};

export default App;