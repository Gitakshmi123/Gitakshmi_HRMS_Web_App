import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Progress, Segmented, Skeleton, Tag, Tooltip } from 'antd';
import { message } from '../../../utils/antdGlobal';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  Eye,
  Facebook,
  FileText,
  Heart,
  Instagram,
  Linkedin,
  MessageCircle,
  Radio,
  RefreshCw,
  Share,
  Share2,
  TrendingUp,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react';
import usePagePermissions from '../../../hooks/usePagePermissions';
import socialApi from '../services/social.api';
import useSocialAnalyticsSocket from '../hooks/useSocialAnalyticsSocket';
import { buildSummary, useSocialAnalyticsStore } from '../store/useSocialAnalyticsStore';

const POLL_INTERVAL_MS = 2000;

const platformConfig = {
  facebook: { label: 'Facebook', color: '#1877F2', icon: Facebook },
  instagram: { label: 'Instagram', color: '#E4405F', icon: Instagram },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', icon: Linkedin }
};

const compactNumber = (value) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

function AnimatedCounter({ value, compact = false }) {
  const [displayValue, setDisplayValue] = useState(Number(value || 0));
  const previousValueRef = useRef(Number(value || 0));

  useEffect(() => {
    const start = previousValueRef.current;
    const end = Number(value || 0);
    const duration = 550;
    const startedAt = performance.now();
    let frameId = null;

    const tick = (time) => {
      const progress = Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        previousValueRef.current = end;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return compact ? compactNumber(displayValue) : formatNumber(displayValue);
}

function MetricCard({ title, value, icon, tone }) {
  return (
    <Card 
      className="rounded-xl border-slate-200 shadow-sm transition-all hover:shadow-md"
      styles={{ body: { padding: '12px' } }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>
          <div className="text-2xl font-black leading-tight text-slate-900">
            <AnimatedCounter value={value} compact />
          </div>
        </div>
        <div className="flex-shrink-0 rounded-lg border border-slate-100 bg-slate-50 p-2" style={{ color: tone }}>
          {React.createElement(icon, { size: 16 })}
        </div>
      </div>
    </Card>
  );
}

function PlatformBadge({ platform }) {
  const config = platformConfig[platform] || { label: platform || 'Unknown', color: '#64748B', icon: Share2 };
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: config.color }}>
      <Icon size={12} />
      {config.label}
    </div>
  );
}

function ChannelMix({ summary }) {
  const totalPosts = Math.max(summary.totalPosts || 0, 1);
  const platforms = ['facebook', 'instagram', 'linkedin'];

  return (
    <Card
      title={<span className="text-sm font-black uppercase tracking-wide text-slate-700">Channel Mix</span>}
      className="h-full rounded-xl border-slate-200 shadow-sm"
    >
      <div className="space-y-5">
        {platforms.map((platform) => {
          const config = platformConfig[platform];
          const Icon = config.icon;
          const count = summary.platformCounts?.[platform] || 0;
          const percent = Math.round((count / totalPosts) * 100);

          return (
            <div key={platform}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Icon size={16} style={{ color: config.color }} />
                  {config.label}
                </div>
                <span className="text-sm font-black text-slate-900">{percent}%</span>
              </div>
              <Progress percent={percent} showInfo={false} strokeColor={config.color} trailColor="#EEF2F7" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PostSummaryCard({ post }) {
  const engagement =
    Number(post.metrics?.likes || 0) +
    Number(post.metrics?.comments || 0) +
    Number(post.metrics?.shares || 0);

  return (
    <Card className="h-full rounded-xl border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" styles={{ body: { padding: '12px' } }}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <PlatformBadge platform={post.platform} />
            <h3 className="mt-2 line-clamp-1 text-sm font-black text-slate-900">{post.title}</h3>
          </div>
          <Tooltip title="Platform specific identifier">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-right">
              <p className="text-[10px] font-black text-slate-900">
                {post.handle || post.accountName || post.platformAccountId || 'N/A'}
              </p>
            </div>
          </Tooltip>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex w-full max-w-[135px] items-center gap-2 rounded-lg border border-slate-100 bg-white p-1.5 text-rose-700 shadow-sm">
            <div className="flex-shrink-0 rounded-md bg-rose-50 p-1">
              <Heart size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-none text-slate-900"><AnimatedCounter value={post.metrics?.likes} compact /></p>
              <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Likes</p>
            </div>
          </div>
          <div className="flex w-full max-w-[135px] items-center gap-2 rounded-lg border border-slate-100 bg-white p-1.5 text-blue-700 shadow-sm">
            <div className="flex-shrink-0 rounded-md bg-blue-50 p-1">
              <MessageCircle size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-none text-slate-900"><AnimatedCounter value={post.metrics?.comments} compact /></p>
              <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Comments</p>
            </div>
          </div>
          <div className="flex w-full max-w-[135px] items-center gap-2 rounded-lg border border-slate-100 bg-white p-1.5 text-indigo-700 shadow-sm">
            <div className="flex-shrink-0 rounded-md bg-indigo-50 p-1">
              <Share size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-none text-slate-900"><AnimatedCounter value={post.metrics?.shares} compact /></p>
              <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Shares</p>
            </div>
          </div>
          <div className="flex w-full max-w-[135px] items-center gap-2 rounded-lg border border-slate-100 bg-white p-1.5 text-amber-700 shadow-sm">
            <div className="flex-shrink-0 rounded-md bg-amber-50 p-1">
              <Eye size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-none text-slate-900"><AnimatedCounter value={post.metrics?.reach} compact /></p>
              <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Reach</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const Dashboard = ({ permissions }) => {
  const fallbackPerms = usePagePermissions('socialMedia.dashboard');
  const { canView } = permissions || fallbackPerms;
  const [platform, setPlatform] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    joinAccounts: 0,
    activePost: 0,
    published: 0,
    draftPosts: 0,
    scheduled: 0,
    failures: 0
  });

  const posts = useSocialAnalyticsStore((state) => state.posts);
  const loading = useSocialAnalyticsStore((state) => state.loading);
  const error = useSocialAnalyticsStore((state) => state.error);
  const socketConnected = useSocialAnalyticsStore((state) => state.socketConnected);
  const lastUpdatedAt = useSocialAnalyticsStore((state) => state.lastUpdatedAt);
  const fetchPosts = useSocialAnalyticsStore((state) => state.fetchPosts);

  useSocialAnalyticsSocket(canView);

  const fetchDashboardStats = async (currentPlatform) => {
    try {
      const response = await socialApi.getDashboardStats(currentPlatform);
      if (response?.success && response?.stats) {
        setDashboardStats(response.stats);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  useEffect(() => {
    if (!canView) return undefined;

    fetchPosts();
    fetchDashboardStats(platform);
    const intervalId = window.setInterval(() => {
      fetchPosts({ silent: true });
      fetchDashboardStats(platform);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [canView, fetchPosts, platform]);

  const filteredPosts = useMemo(() => {
    if (platform === 'all') return posts;
    return posts.filter((post) => post.platform === platform);
  }, [platform, posts]);

  const visibleSummary = useMemo(() => buildSummary(filteredPosts), [filteredPosts]);
  const allSummary = useMemo(() => buildSummary(posts), [posts]);

  const handleSync = async () => {
    if (!canView) return;
    setSyncing(true);
    try {
      const result = await socialApi.syncAnalytics();
      message.success(`Synced ${result?.synced || 0} post(s).`);
      await fetchPosts({ silent: true });
      await fetchDashboardStats(platform);
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-16 text-center">
        <BarChart3 size={42} className="text-slate-300" />
        <h3 className="mt-4 text-xl font-black text-slate-800">Access Restricted</h3>
        <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
          You do not have permission to view the Social Media Dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Social Media Live Dashboard</h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Segmented
            value={platform}
            onChange={setPlatform}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Facebook', value: 'facebook' },
              { label: 'Instagram', value: 'instagram' },
              { label: 'LinkedIn', value: 'linkedin' }
            ]}
          />
          <Button
            icon={<RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />}
            loading={syncing}
            onClick={handleSync}
          >
            Sync
          </Button>
        </div>
      </div>



      {error && (
        <Alert
          type="warning"
          showIcon
          message="Real-time analytics service unavailable"
          description={error}
          className="rounded-xl"
        />
      )}

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton.Button key={item} active block className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard title="Join Accounts" value={dashboardStats.joinAccounts} icon={Users} tone="#4F46E5" />
            <MetricCard title="Active Post" value={dashboardStats.activePost} icon={Activity} tone="#0EA5E9" />
            <MetricCard title="Published" value={dashboardStats.published} icon={CheckCircle} tone="#10B981" />
            <MetricCard title="Draft Posts" value={dashboardStats.draftPosts} icon={FileText} tone="#64748B" />
            <MetricCard title="Scheduled" value={dashboardStats.scheduled} icon={Calendar} tone="#F59E0B" />
            <MetricCard title="Failures" value={dashboardStats.failures} icon={AlertCircle} tone="#EF4444" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Card
                title={<span className="text-sm font-black uppercase tracking-wide text-slate-700">Post Engagement</span>}
                className="h-full rounded-xl border-slate-200 shadow-sm"
              >
                <div className="space-y-4">
                  {[
                    { label: 'Total Likes', value: visibleSummary.totals.likes, icon: Heart, color: 'text-slate-400' },
                    { label: 'Comments', value: visibleSummary.totals.comments, icon: MessageCircle, color: 'text-slate-400' },
                    { label: 'Shares', value: visibleSummary.totals.shares, icon: Share, color: 'text-slate-400' },
                    { label: 'Total Views', value: visibleSummary.totals.reach, icon: Eye, color: 'text-slate-400' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-slate-100 bg-white p-2 text-slate-400">
                          <item.icon size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-900">{item.label}</span>
                      </div>
                      <span className="text-lg font-black text-slate-900">
                        <AnimatedCounter value={item.value} compact />
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="xl:col-span-1">
              <ChannelMix summary={visibleSummary} />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-900">Post Engagement Cards</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {filteredPosts.length} visible
              </span>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12">
                <Empty description={error ? 'Start MongoDB/backend and enable analytics to load live posts.' : 'No posts found for this platform.'} />
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredPosts.map((post) => <PostSummaryCard key={post.id || post.externalPostId} post={post} />)}
            </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
