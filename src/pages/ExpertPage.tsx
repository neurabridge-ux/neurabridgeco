import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Lock, Globe, Clock, TrendingUp, Users, FileText,
  CheckCircle2, Star, BookOpen, Video, Zap, ArrowRight, Heart,
  MessageSquare, Loader2, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import PostEngagement from "@/components/insights/PostEngagement";

const MARKET_OPTIONS = [
  { value: "stocks", label: "Stocks", icon: "📈" },
  { value: "crypto", label: "Crypto", icon: "₿" },
  { value: "forex", label: "Forex", icon: "💱" },
  { value: "bonds", label: "Bonds", icon: "📊" },
  { value: "commodities", label: "Commodities", icon: "🛢️" },
];

interface ExpertData {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  credentials: string | null;
  headline: string | null;
  markets: string[] | null;
  subscription_price: number | null;
  booking_price: number | null;
}

interface PostData {
  id: string; content: string; asset: string | null; market: string | null;
  timeframe: string | null; visibility: string; created_at: string; image_url: string | null;
}

interface MarketplaceItemData {
  id: string; title: string; description: string; type: string;
  image_url: string | null; price: number;
}

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  course: { label: "Course", icon: BookOpen, color: "text-primary" },
  webinar: { label: "Webinar", icon: Video, color: "text-info" },
  opportunity: { label: "Opportunity", icon: Zap, color: "text-accent" },
};

const ExpertPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [expert, setExpert] = useState<ExpertData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [courses, setCourses] = useState<MarketplaceItemData[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);

  const isSelf = user?.id === id;

  const expertSeoTitle = expert ? `${expert.full_name || "Expert"} — Market Expert Profile` : "Expert Profile";
  const expertSeoDesc = expert
    ? `View ${expert.full_name || "expert"}'s market insights, credentials, and courses on NeuraBridge.${expert.markets?.length ? ` Specializing in ${expert.markets.join(", ")}.` : ""}`
    : "View expert profile and market insights on NeuraBridge.";

  usePageSEO({
    title: expertSeoTitle,
    description: expertSeoDesc,
    canonical: `/expert/${id}`,
    ogType: "profile",
    jsonLd: expert ? {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": expert.full_name || "Expert",
      "description": expert.bio || expert.headline || "",
      "url": `https://neurabridgeco.lovable.app/expert/${id}`,
      "jobTitle": expert.credentials || "Market Expert",
      ...(expert.avatar_url ? { "image": expert.avatar_url } : {}),
    } : undefined,
  });

  useEffect(() => { if (id) fetchExpertData(); }, [id, user]);

  const fetchExpertData = async () => {
    if (!id) return;
    setLoading(true);

    const [profileRes, expertRes, postsRes, subsRes, followersRes, coursesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("expert_profiles").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("posts").select("*").eq("expert_id", id).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("id").eq("expert_id", id).eq("status", "active"),
      supabase.from("expert_followers").select("id").eq("expert_id", id),
      supabase.from("marketplace_items").select("*").eq("expert_id", id),
    ]);

    if (profileRes.data && expertRes.data) {
      setExpert({
        user_id: id, full_name: profileRes.data.full_name,
        avatar_url: profileRes.data.avatar_url, bio: expertRes.data.bio,
        credentials: expertRes.data.credentials, headline: expertRes.data.headline,
        markets: expertRes.data.markets, subscription_price: expertRes.data.subscription_price,
        booking_price: (expertRes.data as any).booking_price,
      });
    }

    const postsList = (postsRes.data || []).map((p: any) => ({
      id: p.id, content: p.content, asset: p.asset, market: p.market,
      timeframe: p.timeframe, visibility: p.visibility, created_at: p.created_at,
      image_url: p.image_url || null,
    }));
    setPosts(postsList);
    setPostCount(postsList.length);
    setSubscriberCount(subsRes.data?.length || 0);
    setFollowerCount(followersRes.data?.length || 0);
    setCourses((coursesRes.data || []).map((c: any) => ({
      id: c.id, title: c.title, description: c.description,
      type: c.type, image_url: c.image_url, price: c.price,
    })));

    if (user) {
      const [followRes, subRes] = await Promise.all([
        supabase.from("expert_followers").select("id").eq("follower_id", user.id).eq("expert_id", id).maybeSingle(),
        supabase.from("subscriptions").select("id").eq("investor_id", user.id).eq("expert_id", id).eq("status", "active").maybeSingle(),
      ]);
      setIsFollowing(!!followRes.data);
      setIsSubscribed(!!subRes.data);
    }

    // Fetch ratings
    if (postsList.length > 0) {
      const postIds = postsList.map((p: PostData) => p.id);
      const { data: ratingsData } = await supabase.from("post_ratings").select("score").in("post_id", postIds);
      if (ratingsData && ratingsData.length > 0) {
        const total = ratingsData.reduce((s, r) => s + r.score, 0);
        setAvgRating(total / ratingsData.length);
        setRatingCount(ratingsData.length);
      }
    }

    setLoading(false);
  };

  const handleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    if (isSelf) { toast({ title: "Can't follow yourself" }); return; }
    if (!id) return;

    if (isFollowing) {
      await supabase.from("expert_followers").delete().eq("follower_id", user.id).eq("expert_id", id);
      setIsFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("expert_followers").insert({ follower_id: user.id, expert_id: id });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
      await supabase.from("notifications").insert({
        user_id: id, type: "follow", title: "New Follower", description: "Someone started following you",
      });
    }
  };

  const handleSubscribe = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!id) return;

    if (isSubscribed) {
      // Unsubscribe
      await supabase.from("subscriptions").update({ status: "cancelled" as const })
        .eq("investor_id", user.id).eq("expert_id", id).eq("status", "active");
      setIsSubscribed(false);
      setSubscriberCount((c) => c - 1);
      toast({ title: "Unsubscribed" });
    } else {
      // Check for existing cancelled sub and reactivate, or create new
      const { data: existing } = await supabase.from("subscriptions")
        .select("id").eq("investor_id", user.id).eq("expert_id", id).maybeSingle();
      
      if (existing) {
        await supabase.from("subscriptions").update({ status: "active" as const }).eq("id", existing.id);
      } else {
        await supabase.from("subscriptions").insert({
          investor_id: user.id, expert_id: id, status: "active",
        });
      }
      setIsSubscribed(true);
      setSubscriberCount((c) => c + 1);
      toast({ title: "Subscribed!", description: "You now have access to private insights." });
      await supabase.from("notifications").insert({
        user_id: id, type: "subscribe", title: "New Subscriber", description: "You have a new subscriber!",
      });
    }
  };

  const handleMessage = () => {
    if (!user) { navigate("/auth"); return; }
    navigate("/messages", { state: { recipientId: id, recipientName: expert?.full_name } });
  };

  if (loading) {
    return <Layout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!expert) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Expert not found</h1>
          <Button className="mt-6" asChild><Link to="/experts">Browse Experts</Link></Button>
        </div>
      </Layout>
    );
  }

  const marketNames = (expert.markets || []).map((m) => MARKET_OPTIONS.find((opt) => opt.value === m)).filter(Boolean);

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <Link to="/experts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />Back to Experts
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="insights" className="space-y-6">
              <TabsList>
                <TabsTrigger value="insights"><FileText className="mr-2 h-4 w-4" />Insights ({posts.length})</TabsTrigger>
                <TabsTrigger value="courses"><BookOpen className="mr-2 h-4 w-4" />Courses ({courses.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="insights" className="space-y-6">
                {posts.length > 0 ? posts.map((post) => {
                  const market = MARKET_OPTIONS.find((m) => m.value === post.market);
                  const canView = post.visibility === "public" || isSubscribed || isSelf;
                  return (
                    <Card key={post.id} className={`overflow-hidden ${!canView ? "bg-muted/30" : ""}`}>
                      <CardContent className="p-0">
                        {post.image_url && canView && (
                          <div className="aspect-video overflow-hidden">
                            <img src={post.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </div>
                        )}
                        {post.image_url && !canView && (
                          <div className="aspect-video overflow-hidden relative">
                            <img src={post.image_url} alt="" className="h-full w-full object-cover blur-md scale-105" loading="lazy" />
                            <div className="absolute inset-0 bg-background/40" />
                          </div>
                        )}
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {market && <Badge variant="outline" className="text-xs">{market.icon} {market.label}</Badge>}
                              {post.asset && <Badge variant="secondary" className="text-xs">{post.asset}</Badge>}
                              {post.timeframe && <Badge variant="secondary" className="text-xs"><Clock className="mr-1 h-3 w-3" />{post.timeframe}</Badge>}
                            </div>
                            {post.visibility === "public" ? (
                              <Badge variant="outline" className="text-xs text-success border-success/20"><Globe className="mr-1 h-3 w-3" />Public</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-warning border-warning/20"><Lock className="mr-1 h-3 w-3" />Subscribers</Badge>
                            )}
                          </div>
                          <div className="mt-4">
                            {canView ? (
                              <p className="text-foreground leading-relaxed">{post.content}</p>
                            ) : (
                              <div className="relative">
                                <p className="text-foreground leading-relaxed blur-sm select-none">{post.content}</p>
                                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                                  <div className="text-center">
                                    <Lock className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium text-foreground">Subscribers Only</p>
                                    <p className="text-xs text-muted-foreground mt-1">Subscribe to unlock</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground">{format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                          </div>
                          {canView && <PostEngagement postId={post.id} expertId={expert.user_id} />}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }) : (
                  <Card><CardContent className="py-12 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No posts yet from this expert</p>
                  </CardContent></Card>
                )}
              </TabsContent>

              <TabsContent value="courses" className="space-y-6">
                {courses.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {courses.map((item) => {
                      const cfg = typeConfig[item.type] || typeConfig.course;
                      const TypeIcon = cfg.icon;
                      return (
                        <Card key={item.id} className="group overflow-hidden transition-all duration-300 hover:shadow-large hover:-translate-y-1">
                          {item.image_url && (
                            <div className="relative aspect-video overflow-hidden">
                              <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                              <Badge className="absolute top-3 left-3 gap-1" variant="secondary"><TypeIcon className={`h-3 w-3 ${cfg.color}`} />{cfg.label}</Badge>
                            </div>
                          )}
                          <CardContent className="p-5">
                            <h4 className="font-display font-semibold text-foreground line-clamp-2">{item.title}</h4>
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                              {item.price > 0 ? <p className="font-display font-semibold text-foreground">${item.price}</p> : <Badge className="bg-success/10 text-success border-success/20">Free</Badge>}
                              <Button variant="ghost" size="sm" className="text-primary" asChild>
                                <Link to={`/marketplace/${item.id}`}>View <ArrowRight className="ml-1 h-3 w-3" /></Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card><CardContent className="py-12 text-center">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No courses yet from this expert</p>
                  </CardContent></Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Expert Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card id="expert-card">
                <CardContent className="p-6">
                  {/* Follow button top-right */}
                  {!isSelf && (
                    <div className="flex justify-end -mt-1 -mr-1 mb-2">
                      <Button variant={isFollowing ? "secondary" : "outline"} size="sm" onClick={handleFollow}>
                        <Heart className={`mr-1 h-3.5 w-3.5 ${isFollowing ? "fill-current" : ""}`} />
                        {isFollowing ? "Following" : "Follow"}
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <Avatar className="h-20 w-20 border-4 border-border ring-4 ring-primary/10">
                      <AvatarImage src={expert.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">{(expert.full_name || "?").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h1 className="mt-3 font-display text-2xl font-bold text-foreground">{expert.full_name || "Expert"}</h1>
                    {expert.credentials && <p className="mt-0.5 text-sm text-muted-foreground">{expert.credentials}</p>}
                    {expert.headline && <p className="mt-1 text-sm font-medium text-foreground/80 italic text-center">"{expert.headline}"</p>}
                    {avgRating !== null && (
                      <div className="mt-2 flex items-center justify-center gap-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < Math.round(avgRating) ? "text-accent fill-accent" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">{avgRating.toFixed(1)} ({ratingCount})</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {marketNames.map((market) => (<Badge key={market?.value} variant="secondary">{market?.icon} {market?.label}</Badge>))}
                  </div>

                  {expert.bio && <p className="mt-3 text-sm text-muted-foreground leading-relaxed text-center">{expert.bio}</p>}

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground"><Users className="h-4 w-4 text-primary" />{subscriberCount}</div>
                      <p className="text-xs text-muted-foreground">Subscribers</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground"><Heart className="h-4 w-4 text-primary" />{followerCount}</div>
                      <p className="text-xs text-muted-foreground">Followers</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground"><TrendingUp className="h-4 w-4 text-primary" />{postCount}</div>
                      <p className="text-xs text-muted-foreground">Insights</p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div>
                    <div className="mb-4">
                      {expert.subscription_price && expert.subscription_price > 0 ? (
                        <div className="text-center">
                          <p className="font-display text-3xl font-bold text-foreground">${expert.subscription_price}<span className="text-lg font-normal text-muted-foreground">/month</span></p>
                        </div>
                      ) : (
                        <div className="text-center"><Badge className="bg-success/10 text-success border-success/20 text-lg px-4 py-1">Free</Badge></div>
                      )}
                    </div>

                    <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Access to all private insights</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Real-time market analysis</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Cancel anytime</li>
                    </ul>

                    {!isSelf && (
                      <>
                        {/* 1. Subscribe */}
                        {isSubscribed ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button className="w-full" size="lg" variant="secondary">
                                <CheckCircle2 className="mr-2 h-4 w-4" />Unsubscribe
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Unsubscribe from {expert.full_name || "this expert"}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You will lose access to all private insights. You can re-subscribe anytime.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubscribe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Confirm Unsubscribe
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button className="w-full" size="lg" onClick={handleSubscribe}>
                            {expert.subscription_price ? "Subscribe for Private Insights" : "Subscribe for Free"}
                          </Button>
                        )}

                        {/* 2. Book 1-on-1 */}
                        {expert.booking_price != null && (
                          <Button variant="outline" className="w-full mt-2" onClick={() => {
                            if (!user) { navigate("/auth"); return; }
                            navigate(`/book/${id}`, { state: { expertName: expert.full_name, bookingPrice: expert.booking_price } });
                          }}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {expert.booking_price > 0 ? `Book 1-on-1 ($${expert.booking_price})` : "Book 1-on-1 (Free)"}
                          </Button>
                        )}

                        {/* 3. Send Message */}
                        <Button variant="outline" className="w-full mt-2" onClick={handleMessage}>
                          <MessageSquare className="mr-2 h-4 w-4" />Send Message
                        </Button>
                      </>
                    )}

                    <p className="mt-3 text-xs text-center text-muted-foreground">Educational content only. Not financial advice.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA bar for mobile/tablet */}
      {!isSelf && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm p-3 lg:hidden">
          <div className="container flex items-center gap-2">
            <Button className="flex-1" size="sm" onClick={handleSubscribe}>
              {isSubscribed ? "Subscribed ✓" : (expert.subscription_price ? `Subscribe $${expert.subscription_price}/mo` : "Subscribe Free")}
            </Button>
            {expert.booking_price != null && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                if (!user) { navigate("/auth"); return; }
                navigate(`/book/${id}`, { state: { expertName: expert.full_name, bookingPrice: expert.booking_price } });
              }}>
                <Calendar className="mr-1 h-3.5 w-3.5" />
                {expert.booking_price > 0 ? `Book $${expert.booking_price}` : "Book Free"}
              </Button>
            )}
            <Button variant="outline" size="icon" className="shrink-0" onClick={handleMessage}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ExpertPage;
