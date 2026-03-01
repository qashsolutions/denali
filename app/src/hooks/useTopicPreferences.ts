"use client";

import { useState, useEffect, useCallback } from "react";
import type { HealthTopic } from "@/types/cms";

interface UseTopicPreferencesReturn {
  topics: HealthTopic[];
  isLoading: boolean;
  updateTopics: (topics: HealthTopic[]) => Promise<void>;
  toggleTopic: (topic: HealthTopic) => Promise<void>;
}

export function useTopicPreferences(): UseTopicPreferencesReturn {
  const [topics, setTopics] = useState<HealthTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch("/api/preferences/topics");
        if (res.ok) {
          const data = await res.json();
          setTopics(data.topics ?? []);
        }
      } catch (error) {
        console.warn("Failed to fetch topic preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, []);

  const updateTopics = useCallback(async (newTopics: HealthTopic[]) => {
    const prev = topics;
    // Optimistic update
    setTopics(newTopics);

    try {
      const res = await fetch("/api/preferences/topics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: newTopics }),
      });

      if (!res.ok) {
        setTopics(prev);
      }
    } catch {
      setTopics(prev);
    }
  }, [topics]);

  const toggleTopic = useCallback(async (topic: HealthTopic) => {
    const isSelected = topics.includes(topic);
    let newTopics: HealthTopic[];

    if (isSelected) {
      newTopics = topics.filter((t) => t !== topic);
    } else {
      // Max 2 topics — replace oldest if full
      if (topics.length >= 2) {
        newTopics = [topics[1], topic];
      } else {
        newTopics = [...topics, topic];
      }
    }

    await updateTopics(newTopics);
  }, [topics, updateTopics]);

  return { topics, isLoading, updateTopics, toggleTopic };
}
