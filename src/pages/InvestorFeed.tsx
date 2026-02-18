import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Lock,
  Globe,
  Clock,
  ArrowRight,
  Inbox,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";

const MARKET_OPTIONS = [
  { value: "stocks", label: "Stocks", icon: "📈" },
  { value: "crypto", label: "Crypto", icon: "₿" },
  { value: "forex", label: "Forex", icon: "💱" },
  { value: "bonds", label: "Bonds", icon: "📊" },
  { value: "commodities", label: "Commodities", icon: "🛢️" },
];

interface FeedPost {
  id: string;
  content: string;
  asset: string | null;
  market: string | null;
  timeframe: string | null;
  visibility: "public" | "private";
  created_at: string;
  expert_id: string;
  image_url: string | null;
}

interface SubscriptionWithExpert {
  expert_id: string;
  expert_name: string | null;
  expert_avatar: string | null;
  expert_credentials: string | null;
}

const InvestorFeed = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<SubscriptionWithExpert[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filterExpert, setFilterExpert] = useState<string>("all");
  const [filterMarket, setFilterMarket] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "investor")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === "investor") {
      fetchFeedData();
    }
  }, [user, userRole]);

  const fetchFeedData = async () => {
    if (!user) return;
    setLoadingData(true);

    // Get active subscriptions
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("expert_id")
      .eq("investor_id", user.id)
      .eq("status", "active");

    if (!subs || subs.length === 0) {
      setSubscriptions([]);
      setPosts([]);
      setLoadingData(false);
      return;
    }

    const expertIds = subs.map((s) => s.expert_id);

    // Fetch expert profiles and posts in parallel
    const [profilesRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", expertIds),
      supabase.from("posts").select("*").in("expert_id", expertIds).order("created_at", { ascending: false }),
    ]);

    // Also get expert credentials
    const { data: expertProfiles } = await supabase
      .from("expert_profiles")
      .select("user_id, credentials")
      .in("user_id", expertIds);

    const subsList: SubscriptionWithExpert[] = expertIds.map((eid) => {
      const prof = profilesRes.data?.find((p) => p.id === eid);
      const exp = expertProfiles?.find((e) => e.user_id === eid);
      return {
        expert_id: eid,
        expert_name: prof?.full_name || null,
        expert_avatar: prof?.avatar_url || null,
        expert_credentials: exp?.credentials || null,
      };
    });

    setSubscriptions(subsList);
    setPosts((postsRes.data as FeedPost[]) || []);
    setLoadingData(false);
  };

  const handleUnsubscribe = async (expertId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" as const })
      .eq("investor_id", user.id)
      .eq("expert_id", expertId);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Unsubscribed", description: "You have been unsubscribed from this expert." });
      fetchFeedData();
    }
  };

  const filteredPosts = posts.filter((post) => {
    const matchExpert = filterExpert === "all" || post.expert_id === filterExpert;
    const matchMarket = filterMarket === "all" || post.market === filterMarket;
    return matchExpert && matchMarket;
  });

  const getExpertInfo = (expertId: string) => {
    return subscriptions.find((s) => s.expert_id === expertId);
  };

  if (authLoading || loadingData) {
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
          <h1 className="font-display text-3xl font-bold text-foreground">
            My Feed
          </h1>
          <p className="mt-1 text-muted-foreground">
            Private insights from your subscribed experts
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <Inbox className="mx-auto h-16 w-16 text-muted-foreground/40" />
              <h2 className="mt-6 font-display text-xl font-semibold text-foreground">
                No subscriptions yet
              </h2>
              <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                Subscribe to experts to see their private insights here. Browse our directory to find analysts covering your markets.
              </p>
              <Button className="mt-8" asChild>
                <Link to="/experts">
                  Browse Experts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-4">
            {/* Sidebar: Subscriptions */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      My Experts ({subscriptions.length})
                    </h3>
                    <div className="space-y-3">
                      {subscriptions.map((sub) => (
                        <div key={sub.expert_id} className="flex items-center justify-between gap-2">
                          <Link
                            to={`/expert/${sub.expert_id}`}
                            className="flex items-center gap-2 group flex-1 min-w-0"
                          >
                            <Avatar className="h-8 w-8 border border-border">
                              <AvatarImage src={sub.expert_avatar || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {(sub.expert_name || "?").charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                {sub.expert_name || "Expert"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {sub.expert_credentials || ""}
                              </p>
                            </div>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Unsubscribe from {sub.expert_name || "this expert"}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You will lose access to their private insights. You can re-subscribe anytime.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUnsubscribe(sub.expert_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Confirm Unsubscribe
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Filters */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-foreground text-sm">Filters</h3>
                    <Select value={filterExpert} onValueChange={setFilterExpert}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Experts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Experts</SelectItem>
                        {subscriptions.map((sub) => (
                          <SelectItem key={sub.expert_id} value={sub.expert_id}>
                            {sub.expert_name || "Expert"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterMarket} onValueChange={setFilterMarket}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Markets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Markets</SelectItem>
                        {MARKET_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.icon} {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Main Feed */}
            <div className="lg:col-span-3 space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                {filteredPosts.length} post{filteredPosts.length !== 1 && "s"}
              </p>

              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => {
                  const expert = getExpertInfo(post.expert_id);
                  const market = MARKET_OPTIONS.find((m) => m.value === post.market);

                  return (
                    <Card key={post.id}>
                      <CardContent className="p-6">
                        {/* Expert row */}
                        <Link to={`/expert/${post.expert_id}`} className="flex items-center gap-3 group">
                          <Avatar className="h-10 w-10 border-2 border-border">
                            <AvatarImage src={expert?.expert_avatar || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {(expert?.expert_name || "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {expert?.expert_name || "Expert"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </Link>

                        {/* Meta */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {market && (
                            <Badge variant="outline" className="text-xs">
                              {market.icon} {market.label}
                            </Badge>
                          )}
                          {post.asset && (
                            <Badge variant="secondary" className="text-xs">{post.asset}</Badge>
                          )}
                          {post.timeframe && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="mr-1 h-3 w-3" />
                              {post.timeframe}
                            </Badge>
                          )}
                          {post.visibility === "public" ? (
                            <Badge variant="outline" className="text-xs text-success border-success/20">
                              <Globe className="mr-1 h-3 w-3" />
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-accent border-accent/20">
                              <Lock className="mr-1 h-3 w-3" />
                              Exclusive
                            </Badge>
                          )}
                        </div>

                        {/* Image */}
                        {post.image_url && (
                          <div className="mt-4 rounded-lg overflow-hidden">
                            <img
                              src={post.image_url}
                              alt={post.asset || "Insight"}
                              className="w-full max-h-80 object-contain bg-muted rounded-lg"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Content */}
                        <p className="mt-4 text-foreground leading-relaxed">{post.content}</p>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No posts match your filters</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InvestorFeed;
