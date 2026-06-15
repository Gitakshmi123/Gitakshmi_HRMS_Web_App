import { useEffect, useRef } from 'react';
import { getToken } from '../../../utils/token';
import { loadExternalScript, resolveApiOrigin } from '../../../utils/runtimeAssets';
import { useSocialAnalyticsStore } from '../store/useSocialAnalyticsStore';

export default function useSocialAnalyticsSocket(enabled = true) {
  const socketRef = useRef(null);
  const subscribedPostIdsRef = useRef(new Set());
  const posts = useSocialAnalyticsStore((state) => state.posts);
  const socketConnected = useSocialAnalyticsStore((state) => state.socketConnected);
  const applyMetricEvent = useSocialAnalyticsStore((state) => state.applyMetricEvent);
  const setSocketConnected = useSocialAnalyticsStore((state) => state.setSocketConnected);

  useEffect(() => {
    if (!enabled) return undefined;

    let mounted = true;
    const subscribedPostIds = subscribedPostIdsRef.current;

    async function connect() {
      try {
        const token = getToken();
        if (!token) return;

        const origin = resolveApiOrigin();
        await loadExternalScript(`${origin}/socket.io/socket.io.js`, 'io');
        if (!mounted || socketRef.current || !window.io) return;

        const socket = window.io(origin, {
          auth: { token },
          withCredentials: true,
          transports: ['websocket', 'polling']
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          setSocketConnected(true);
        });

        socket.on('disconnect', () => {
          setSocketConnected(false);
        });

        socket.on('connect_error', () => {
          setSocketConnected(false);
        });

        socket.on('social:metrics:update', (payload) => {
          applyMetricEvent(payload);
        });

        socket.on('metrics_update', (payload) => {
          applyMetricEvent(payload);
        });
      } catch (error) {
        setSocketConnected(false);
        console.warn('[SocialAnalytics] Socket connection failed:', error?.message || error);
      }
    }

    connect();

    return () => {
      mounted = false;
      setSocketConnected(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      subscribedPostIds.clear();
    };
  }, [applyMetricEvent, enabled, setSocketConnected]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !socketConnected || !socket?.connected) return;

    const currentIds = new Set(posts.map((post) => String(post.id || '').trim()).filter(Boolean));
    const newIds = [...currentIds].filter((postId) => !subscribedPostIdsRef.current.has(postId));
    const staleIds = [...subscribedPostIdsRef.current].filter((postId) => !currentIds.has(postId));

    if (newIds.length) {
      socket.emit('social:metrics:subscribe', { postIds: newIds });
      newIds.forEach((postId) => subscribedPostIdsRef.current.add(postId));
    }

    if (staleIds.length) {
      socket.emit('social:metrics:unsubscribe', { postIds: staleIds });
      staleIds.forEach((postId) => subscribedPostIdsRef.current.delete(postId));
    }
  }, [enabled, posts, socketConnected]);
}
