'use client';

import React, { useState, useEffect } from 'react';
import { saveApiKey, getApiKey, clearApiKey } from '@/lib/apiKeyStorage';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const existingKey = getApiKey();
    if (existingKey) {
      setApiKey(existingKey);
      setHasExistingKey(true);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      saveApiKey(apiKey.trim());
      setSaveSuccess(true);
      setHasExistingKey(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    }
  };

  const handleClear = () => {
    clearApiKey();
    setApiKey('');
    setHasExistingKey(false);
    setSaveSuccess(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '500px',
          width: '90%',
          zIndex: 101,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>
          API Key Settings
        </h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: 'var(--foreground-muted)' }}>
          Configure your own Gemini API key for natural language event parsing
        </p>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>
            Gemini API Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API key"
              style={{
                width: '100%',
                padding: '12px',
                paddingRight: '100px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'transparent',
                color: 'var(--foreground-muted)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {hasExistingKey && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--primary)' }}>
              ✓ API key is currently saved
            </p>
          )}
        </div>

        <div
          style={{
            padding: '12px',
            background: 'var(--background)',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: 'var(--foreground-muted)',
          }}
        >
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Don&apos;t have an API key?</strong>
          </p>
          <p style={{ margin: 0 }}>
            Get your free Gemini API key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'underline' }}
            >
              Google AI Studio
            </a>
          </p>
        </div>

        {saveSuccess && (
          <div
            style={{
              padding: '12px',
              background: '#10b981',
              color: 'white',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              fontWeight: '500',
            }}
          >
            ✓ API key saved successfully!
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {hasExistingKey && (
            <button
              onClick={handleClear}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
              }}
            >
              Clear Key
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: apiKey.trim() ? 'var(--primary)' : 'var(--border)',
              color: 'white',
              border: 'none',
              cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
            }}
          >
            Save Key
          </button>
        </div>
      </div>
    </>
  );
};

export default ApiKeyModal;
