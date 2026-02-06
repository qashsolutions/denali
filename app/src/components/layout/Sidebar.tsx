"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useConversationHistory,
  groupConversationsByDate,
  type ConversationHistoryItem,
} from "@/hooks/useConversationHistory";
import { MountainIcon } from "@/components/icons";
import { BRAND } from "@/config";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId?: string;
  onNewChat: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  currentConversationId,
  onNewChat,
}: SidebarProps) {
  const router = useRouter();
  const { conversations, isLoading, isVerifiedUser, refresh } = useConversationHistory();
  const groupedConversations = groupConversationsByDate(conversations);

  // Refresh conversation list when a new conversation is created
  useEffect(() => {
    if (currentConversationId) {
      refresh();
    }
  }, [currentConversationId, refresh]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleConversationClick = (id: string) => {
    router.push(`/chat?id=${id}`);
    onClose();
  };

  const handleNewChatClick = () => {
    onNewChat();
    onClose();
  };

  const handleSettingsClick = () => {
    router.push("/settings");
    onClose();
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)]
          flex flex-col z-50 transition-transform duration-200 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:z-auto
        `}
        aria-label="Sidebar"
      >
        {/* Header with logo */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2">
            <MountainIcon className="w-8 h-6" />
            <span className="font-bold text-[var(--text-primary)]">
              {BRAND.NAME}
            </span>
          </Link>

          {/* Close button (mobile only) */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <CloseIcon className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChatClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-primary)]/90 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {!isVerifiedUser ? (
            <div className="text-center py-8 px-4">
              <LockIcon className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                Verify your email to see chat history
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-[var(--bg-tertiary)] rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <ChatBubblesIcon className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                No conversations yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedConversations).map(([group, items]) => (
                <div key={group}>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-2">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {items.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === currentConversationId}
                        onClick={() => handleConversationClick(conv.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings at bottom */}
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={handleSettingsClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-sm font-medium">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                Settings
              </p>
            </div>
            <SettingsIcon className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      </aside>
    </>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationHistoryItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg transition-colors
        ${
          isActive
            ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
            : "hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
        }
      `}
    >
      <div className="flex items-start gap-2">
        {conversation.isAppeal && (
          <span className="mt-0.5 text-amber-500 flex-shrink-0">
            <FileIcon className="w-4 h-4" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{conversation.title}</p>
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
            {conversation.preview}
          </p>
        </div>
      </div>
    </button>
  );
}

// Hamburger menu button for mobile
export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
      aria-label="Open menu"
    >
      <MenuIcon className="w-6 h-6 text-[var(--text-primary)]" />
    </button>
  );
}

// Icons
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function ChatBubblesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
