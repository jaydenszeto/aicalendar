'use client';

import React, { useState, useEffect } from 'react';
import { ColorRule, getColorRules, saveColorRules, resetToDefaults } from '@/lib/colorRulesStorage';

interface ColorRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f97316',
  '#06b6d4', '#ec4899', '#eab308', '#14b8a6', '#6366f1',
];

const ColorRulesModal: React.FC<ColorRulesModalProps> = ({ isOpen, onClose }) => {
  const [rules, setRules] = useState<ColorRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setRules(getColorRules());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveColorRules(rules);
    onClose();
  };

  const handleAddRule = () => {
    const newRule: ColorRule = {
      id: Date.now().toString(),
      name: 'New Rule',
      keywords: ['keyword'],
      color: PRESET_COLORS[rules.length % PRESET_COLORS.length],
    };
    setRules([...rules, newRule]);
    setEditingId(newRule.id);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleUpdateRule = (id: string, updates: Partial<ColorRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleReset = () => {
    if (confirm('Reset to default color rules?')) {
      setRules(resetToDefaults());
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: '12px', padding: '24px',
          width: '500px', maxWidth: '95%', maxHeight: '80vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>🎨 Color Rules</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--foreground-muted)' }}>
          Type a keyword and press <strong>Enter</strong> to add. Click × to remove.
        </p>

        {/* Rules List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {rules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px',
              background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)',
            }}>
              {/* Color Picker */}
              <input
                type="color"
                value={rule.color}
                onChange={e => handleUpdateRule(rule.id, { color: e.target.value })}
                style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}
              />

              {/* Name & Keywords */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={rule.name}
                  onChange={e => handleUpdateRule(rule.id, { name: e.target.value })}
                  placeholder="Rule name"
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    fontWeight: '600', fontSize: '0.9rem', color: 'var(--foreground)',
                    marginBottom: '6px',
                  }}
                />
                {/* Keyword Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  {rule.keywords.map((kw, i) => (
                    <span key={i} style={{
                      background: rule.color + '30', color: 'var(--foreground)',
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      {kw}
                      <button
                        onClick={() => handleUpdateRule(rule.id, { keywords: rule.keywords.filter((_, idx) => idx !== i) })}
                        style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
                      >×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ add keyword"
                    style={{
                      background: 'transparent', border: 'none', fontSize: '0.75rem',
                      color: 'var(--foreground-muted)', width: '80px', outline: 'none',
                    }}
                    onKeyDown={e => {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if ((e.key === 'Enter' || e.key === ',') && val) {
                        e.preventDefault();
                        handleUpdateRule(rule.id, { keywords: [...rule.keywords, val] });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    onBlur={e => {
                      const val = e.target.value.trim();
                      if (val) {
                        handleUpdateRule(rule.id, { keywords: [...rule.keywords, val] });
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDeleteRule(rule.id)}
                style={{
                  background: 'transparent', border: 'none', color: '#ef4444',
                  cursor: 'pointer', fontSize: '1.2rem', padding: '4px', flexShrink: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleAddRule} style={{
            padding: '8px 16px', background: 'var(--background)', color: 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer',
          }}>+ Add Rule</button>
          <button onClick={handleReset} style={{
            padding: '8px 16px', background: 'transparent', color: 'var(--foreground-muted)',
            border: 'none', cursor: 'pointer', fontSize: '0.85rem',
          }}>Reset to Defaults</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', color: 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            padding: '8px 16px', background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500',
          }}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default ColorRulesModal;
