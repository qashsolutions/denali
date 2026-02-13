"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useConversationHistory,
  groupConversationsByDate,
  type ConversationHistoryItem,
} from "@/hooks/useConversationHistory";

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
  const { conversations, isLoading, refresh } = useConversationHistory();
  const groupedConversations = groupConversationsByDate(conversations);

  // Refresh conversation list when conversation changes (new chat or new conversation created)
  const prevConversationIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevConversationIdRef.current;
    prevConversationIdRef.current = currentConversationId;
    // Refresh when: new conversation created (null→id) OR new chat clicked (id→undefined)
    if (currentConversationId || (prev && !currentConversationId)) {
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
    router.push(`/app/chat?id=${id}`);
    onClose();
  };

  const handleNewChatClick = () => {
    onNewChat();
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
        {/* Close button (mobile only) */}
        <div className="flex items-center justify-end p-4 border-b border-[var(--border)] md:hidden">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
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
          {isLoading ? (
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
          <p className="text-[11px] italic text-[var(--text-muted)] mt-0.5">
            {formatConversationDate(conversation.createdAt)}
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

// Helpers
function formatConversationDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const convDate = new Date(date);

  if (convDate >= today) {
    return convDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (convDate >= yesterday) {
    return "Yesterday " + convDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return convDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + convDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
