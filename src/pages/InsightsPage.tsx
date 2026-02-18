import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Globe, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import PostEngagement from "@/components/insights/PostEngagement";

const MARKET_OPTIONS = [
  { value: "stocks", label: "Stocks", icon: "📈" },
  { value: "crypto", label: "Crypto", icon: "₿" },
  { value: "forex", label: "Forex", icon: "💱" },
  { value: "bonds", label: "Bonds", icon: "📊" },
  { value: "commodities", label: "Commodities", icon: "🛢️" },
];

interface PostWithExpert {
  id: string;
  content: string;
  asset: string | null;
  market: string | null;
  timeframe: string | null;
  visibility: string;
  created_at: string;
  image_url: string | null;
  expert_id: string;
  expert_name: string | null;
  expert_avatar: string | null;
  expert_credentials: string | null;
}

const InsightCard = ({ post }: { post: PostWithExpert }) => {
  const market = MARKET_OPTIONS.find((m) => m.value === post.market);

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-large hover:-translate-y-1">
      <CardContent className="p-6">
        <Link to={`/expert/${post.expert_id}`} className="flex items-center gap-3 group">
          <Avatar className="h-10 w-10 border-2 border-border">
            <AvatarImage src={post.expert_avatar || undefined} alt={post.expert_name || ""} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {(post.expert_name || "?").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
              {post.expert_name || "Expert"}
            </p>
            <p className="text-xs text-muted-foreground">{post.expert_credentials || ""}</p>
          </div>
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {market && (
            <Badge variant="outline" className="text-xs">
              {market.icon} {market.label}
            </Badge>
          )}
          {post.asset && <Badge variant="secondary" className="text-xs">{post.asset}</Badge>}
          {post.timeframe && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />
              {post.timeframe}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs text-success border-success/20">
            <Globe className="mr-1 h-3 w-3" />
            Public
          </Badge>
        </div>

        {post.image_url && (
          <div className="mt-4 rounded-lg overflow-hidden">
            <img src={post.image_url} alt={post.asset || "Insight"} className="w-full max-h-80 object-contain bg-muted rounded-lg" loading="lazy" />
          </div>
        )}

        <p className="mt-4 text-foreground leading-relaxed">{post.content}</p>

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
          <Link to={`/expert/${post.expert_id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
            View Expert <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <PostEngagement postId={post.id} expertId={post.expert_id} />
      </CardContent>
    </Card>
  );
};

const InsightsPage = () => {
  usePageSEO({
    title: "Public Market Insights — Expert Analysis",
    description: "Explore free public market insights and analysis from verified experts covering stocks, crypto, forex, and more on NeuraBridge.",
    canonical: "/insights",
  });
  const [selectedMarket, setSelectedMarket] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("all");
  const [posts, setPosts] = useState<PostWithExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<{ id: string; name: string }[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<string>("all");

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .eq("visibility", "public")
      .order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const expertIds = [...new Set(postsData.map((p) => p.expert_id))];
    const [profilesRes, expertProfilesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", expertIds),
      supabase.from("expert_profiles").select("user_id, credentials").in("user_id", expertIds),
    ]);

    const enriched: PostWithExpert[] = postsData.map((p) => {
      const profile = profilesRes.data?.find((pr) => pr.id === p.expert_id);
      const expert = expertProfilesRes.data?.find((e) => e.user_id === p.expert_id);
      return {
        id: p.id, content: p.content, asset: p.asset, market: p.market,
        timeframe: p.timeframe, visibility: p.visibility, created_at: p.created_at,
        image_url: (p as any).image_url || null, expert_id: p.expert_id,
        expert_name: profile?.full_name || null, expert_avatar: profile?.avatar_url || null,
        expert_credentials: expert?.credentials || null,
      };
    });

    setPosts(enriched);
    setExperts(expertIds.map((id) => ({
      id, name: profilesRes.data?.find((p) => p.id === id)?.full_name || "Expert",
    })));
    setLoading(false);
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesMarket = selectedMarket === "all" || post.market === selectedMarket;
      const matchesExpert = selectedExpert === "all" || post.expert_id === selectedExpert;
      const matchesTimeframe = selectedTimeframe === "all" || post.timeframe === selectedTimeframe;
      return matchesMarket && matchesExpert && matchesTimeframe;
    });
  }, [posts, selectedMarket, selectedExpert, selectedTimeframe]);

  const timeframes = [...new Set(posts.map((p) => p.timeframe).filter(Boolean))];

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Public Insights</h1>
          <p className="mt-2 text-muted-foreground">Explore market insights shared by our expert community</p>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <Select value={selectedMarket} onValueChange={setSelectedMarket}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Markets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {MARKET_OPTIONS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={selectedExpert} onValueChange={setSelectedExpert}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="All Experts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Experts</SelectItem>
              {experts.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Timeframes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Timeframes</SelectItem>
              {timeframes.map((tf) => (<SelectItem key={tf} value={tf!}>{tf}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {filteredPosts.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {filteredPosts.length} insight{filteredPosts.length !== 1 && "s"} found
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {filteredPosts.map((post) => (<InsightCard key={post.id} post={post} />))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-lg font-medium text-foreground">No insights found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {posts.length === 0 ? "No public insights have been posted yet" : "Try adjusting your filters"}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InsightsPage;
