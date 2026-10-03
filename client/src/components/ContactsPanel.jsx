import { useEffect, useState, useCallback } from 'react';
import { fetchContacts, addContactApi, removeContactApi, searchUsersApi } from '../services/api';
import { useCall } from '../context/CallContext';

export function ContactsPanel() {
  const { initiateCall, callState, onlineUserIds } = useCall();
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadContacts = useCallback(async () => {
    try {
      const list = await fetchContacts();
      setContacts(list);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setStatusMessage(null);
    try {
      const results = await searchUsersApi(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setStatusMessage({ type: 'info', text: 'No users found matching your search.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to search users.' });
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (user) => {
    try {
      await addContactApi({ contactId: user.id });
      setStatusMessage({ type: 'success', text: `Added ${user.username} to contacts!` });
      setSearchQuery('');
      setSearchResults([]);
      loadContacts();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add contact.';
      setStatusMessage({ type: 'error', text: msg });
    }
  };

  const handleRemoveContact = async (contactId) => {
    try {
      await removeContactApi(contactId);
      loadContacts();
    } catch (err) {
      console.error('Failed to remove contact:', err);
    }
  };

  return (
    <div className="contacts-panel">
      {/* Search & Add Contacts Section */}
      <div className="panel-card search-card">
        <h3>Find & Add Contacts</h3>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            id="user-search-input"
          />
          <button type="submit" disabled={searching} className="btn-search" id="search-submit-btn">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {statusMessage && (
          <div className={`status-alert ${statusMessage.type}`}>
            {statusMessage.text}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="search-results-list">
            <h4>Search Results</h4>
            {searchResults.map((user) => {
              const isAlreadyContact = contacts.some((c) => c.id === user.id);
              const isUserOnline = onlineUserIds.has(user.id);
              return (
                <div key={user.id} className="search-result-item">
                  <div className="contact-info">
                    <span className="contact-name">{user.username}</span>
                    <span className="contact-email">{user.email}</span>
                  </div>
                  <div className="search-item-actions">
                    <span className={`presence-pill ${isUserOnline ? 'online' : 'offline'}`}>
                      {isUserOnline ? 'Online' : 'Offline'}
                    </span>
                    {isAlreadyContact ? (
                      <span className="badge-already-contact">In Contacts</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddContact(user)}
                        className="btn-add-contact"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact List Section */}
      <div className="panel-card contacts-card">
        <div className="contacts-header">
          <h3>Your Contacts</h3>
          <span className="contacts-count">{contacts.length} total</span>
        </div>

        {loadingContacts ? (
          <p className="loading-text">Loading contacts...</p>
        ) : contacts.length === 0 ? (
          <div className="empty-contacts">
            <p>No contacts yet.</p>
            <p className="subtext">Use the search box above to find and add users to call.</p>
          </div>
        ) : (
          <div className="contacts-list">
            {contacts.map((contact) => {
              const isOnline = onlineUserIds.has(contact.id);
              return (
                <div key={contact.id} className="contact-item">
                  <div className="contact-left">
                    <div className="avatar-wrapper">
                      <div className="avatar-circle">{contact.username.charAt(0).toUpperCase()}</div>
                      <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
                    </div>
                    <div className="contact-details">
                      <span className="contact-username">{contact.username}</span>
                      <span className="contact-status-text">
                        {isOnline ? 'Online • Ready to call' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="contact-actions">
                    <button
                      type="button"
                      onClick={() => initiateCall(contact)}
                      disabled={!isOnline || callState !== 'idle'}
                      className={`btn-call ${isOnline ? 'active' : 'disabled'}`}
                      title={isOnline ? `Call ${contact.username}` : 'User is offline'}
                      id={`call-btn-${contact.username}`}
                    >
                      📞 Call
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(contact.id)}
                      className="btn-remove-contact"
                      title="Remove contact"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
