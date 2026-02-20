import { useState, useEffect } from "react";
import CourseDetailedForm, { serializeDetailedContent, type CourseDetailedData, EMPTY_DATA } from "@/components/marketplace/CourseDetailedForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, FileText, Users, Globe, Lock, Clock, Trash2, X,
  BarChart3, DollarSign, Star, UserCheck, BookOpen, Video, Zap, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { SubscribersListCard } from "@/components/experts/SubscribersListCard";
import ImageUpload from "@/components/ImageUpload";

const MARKET_OPTIONS = [
  { value: "stocks", label: "Stocks", icon: "📈" },
  { value: "crypto", label: "Crypto", icon: "₿" },
  { value: "forex", label: "Forex", icon: "💱" },
  { value: "bonds", label: "Bonds", icon: "📊" },
  { value: "commodities", label: "Commodities", icon: "🛢️" },
];

interface PostRow {
  id: string;
  content: string;
  asset: string | null;
  market: string | null;
  timeframe: string | null;
  visibility: "public" | "private";
  created_at: string;
  image_url: string | null;
}

interface MarketplaceItemRow {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
  image_url: string | null;
  created_at: string;
  detailed_content: string | null;
}

const ExpertDashboard = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [courses, setCourses] = useState<MarketplaceItemRow[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [creatingPost, setCreatingPost] = useState(false);
  const [activeTab, setActiveTab] = useState("analytics");

  // Post form
  const [showPostForm, setShowPostForm] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postAsset, setPostAsset] = useState("");
  const [postMarket, setPostMarket] = useState("");
  const [postTimeframe, setPostTimeframe] = useState("");
  const [postVisibility, setPostVisibility] = useState<"public" | "private">("public");
  const [postImageUrl, setPostImageUrl] = useState("");

  // Course form
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseType, setCourseType] = useState("course");
  const [coursePrice, setCoursePrice] = useState("");
  const [courseImage, setCourseImage] = useState("");
  const [courseDetailedContent, setCourseDetailedContent] = useState<import("@/components/marketplace/CourseDetailedForm").CourseDetailedData>({ learning_objectives: "", prerequisites: "", curriculum: "", duration: "", target_audience: "" });
  const [creatingCourse, setCreatingCourse] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "expert")) navigate("/auth");
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === "expert") fetchData();
  }, [user, userRole]);

  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);
    const [postsRes, subsRes, followersRes, coursesRes] = await Promise.all([
      supabase.from("posts").select("*").eq("expert_id", user.id).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("id").eq("expert_id", user.id).eq("status", "active"),
      supabase.from("expert_followers").select("id").eq("expert_id", user.id),
      supabase.from("marketplace_items").select("*").eq("expert_id", user.id).order("created_at", { ascending: false }),
    ]);
    setPosts((postsRes.data as PostRow[]) || []);
    setSubscriberCount(subsRes.data?.length || 0);
    setFollowerCount(followersRes.data?.length || 0);
    setCourses((coursesRes.data as MarketplaceItemRow[]) || []);
    setLoadingData(false);
  };

  const handleCreatePost = async () => {
    if (!user || !postContent.trim()) return;
    setCreatingPost(true);
    const { data: newPost, error } = await supabase.from("posts").insert({
      expert_id: user.id, content: postContent, asset: postAsset || null,
      market: postMarket || null, timeframe: postTimeframe || null,
      visibility: postVisibility, image_url: postImageUrl || null,
    } as any).select().single();
    setCreatingPost(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Post published!" });
      // Notify all followers about new post
      if (newPost) {
        notifyFollowers(newPost.id, postVisibility);
      }
      setPostContent(""); setPostAsset(""); setPostMarket(""); setPostTimeframe("");
      setPostVisibility("public"); setPostImageUrl(""); setShowPostForm(false);
      fetchData();
    }
  };

  const notifyFollowers = async (postId: string, visibility: string) => {
    if (!user) return;
    // Get expert's display name
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const expertName = profile?.full_name || "An expert";

    // Get all followers
    const { data: followers } = await supabase.from("expert_followers").select("follower_id").eq("expert_id", user.id);
    if (!followers || followers.length === 0) return;

    const followerNotifications = followers
      .filter((f) => f.follower_id !== user.id)
      .map((f) => ({
        user_id: f.follower_id,
        title: `${expertName} posted a new ${visibility === "private" ? "exclusive" : "public"} insight`,
        description: `Click to view the latest insight from ${expertName}`,
        type: "new_post",
      }));

    if (followerNotifications.length > 0) {
      await supabase.from("notifications").insert(followerNotifications);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Post deleted" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handleCreateCourse = async () => {
    if (!user || !courseTitle.trim() || !courseDesc.trim()) return;
    setCreatingCourse(true);
    const { error } = await supabase.from("marketplace_items").insert({
      expert_id: user.id, title: courseTitle, description: courseDesc,
      type: courseType, price: parseFloat(coursePrice) || 0,
      image_url: courseImage || null,
      detailed_content: serializeDetailedContent(courseDetailedContent),
    });
    setCreatingCourse(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Course created!" });
      setCourseTitle(""); setCourseDesc(""); setCourseType("course");
      setCoursePrice(""); setCourseImage(""); setCourseDetailedContent({ learning_objectives: "", prerequisites: "", curriculum: "", duration: "", target_audience: "" }); setShowCourseForm(false);
      fetchData();
    }
  };

  const handleDeleteCourse = async (id: string) => {
    const { error } = await supabase.from("marketplace_items").delete().eq("id", id);
    if (!error) {
      toast({ title: "Item deleted" });
      setCourses((prev) => prev.filter((c) => c.id !== id));
    }
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
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Expert Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Manage your insights, courses, and subscribers</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setShowPostForm(true); setActiveTab("posts"); }} size="sm">
              <Plus className="mr-2 h-4 w-4" />New Post
            </Button>
            <Button onClick={() => { setShowCourseForm(true); setActiveTab("courses"); }} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />New Course
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4 md:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{posts.length}</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4 md:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{subscriberCount}</p>
                <p className="text-xs text-muted-foreground">Subscribers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4 md:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <UserCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{followerCount}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
            </CardContent>
          </Card>
          <EarningsCard userId={user?.id || ""} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
            <TabsTrigger value="posts"><FileText className="mr-2 h-4 w-4" />Posts</TabsTrigger>
            <TabsTrigger value="courses"><BookOpen className="mr-2 h-4 w-4" />Courses</TabsTrigger>
            <TabsTrigger value="subscribers"><UserCheck className="mr-2 h-4 w-4" />Subscribers</TabsTrigger>
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            {showPostForm && (
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Create New Post</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setShowPostForm(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Asset</Label>
                      <Input placeholder="e.g. AAPL, BTC" value={postAsset} onChange={(e) => setPostAsset(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Market</Label>
                      <Select value={postMarket} onValueChange={setPostMarket}>
                        <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                        <SelectContent>
                          {MARKET_OPTIONS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timeframe</Label>
                      <Select value={postTimeframe} onValueChange={setPostTimeframe}>
                        <SelectTrigger><SelectValue placeholder="Select timeframe" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Short-term">Short-term</SelectItem>
                          <SelectItem value="Medium-term">Medium-term</SelectItem>
                          <SelectItem value="Long-term">Long-term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Insight</Label>
                    <Textarea placeholder="Share your market analysis..." value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={5} />
                  </div>
                  <div className="space-y-2">
                    <Label>Image (optional)</Label>
                    <ImageUpload value={postImageUrl} onChange={setPostImageUrl} folder="posts" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      {postVisibility === "public" ? <Globe className="h-5 w-5 text-success" /> : <Lock className="h-5 w-5 text-warning" />}
                      <div>
                        <p className="font-medium text-foreground">{postVisibility === "public" ? "Public" : "Subscribers Only"}</p>
                        <p className="text-xs text-muted-foreground">{postVisibility === "public" ? "Visible to everyone" : "Only visible to subscribers"}</p>
                      </div>
                    </div>
                    <Switch checked={postVisibility === "private"} onCheckedChange={(c) => setPostVisibility(c ? "private" : "public")} />
                  </div>
                  <Button onClick={handleCreatePost} disabled={creatingPost || !postContent.trim()} className="w-full">
                    {creatingPost ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : <><Plus className="mr-2 h-4 w-4" />Publish Insight</>}
                  </Button>
                </CardContent>
              </Card>
            )}

            {posts.length > 0 ? posts.map((post) => {
              const market = MARKET_OPTIONS.find((m) => m.value === post.market);
              return (
                <Card key={post.id}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {market && <Badge variant="outline" className="text-xs">{market.icon} {market.label}</Badge>}
                        {post.asset && <Badge variant="secondary" className="text-xs">{post.asset}</Badge>}
                        {post.timeframe && <Badge variant="secondary" className="text-xs"><Clock className="mr-1 h-3 w-3" />{post.timeframe}</Badge>}
                        {post.visibility === "public" ? (
                          <Badge variant="outline" className="text-xs text-success border-success/20"><Globe className="mr-1 h-3 w-3" />Public</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-warning border-warning/20"><Lock className="mr-1 h-3 w-3" />Subscribers</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeletePost(post.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {post.image_url && (
                      <div className="mt-3 rounded-lg overflow-hidden">
                        <img src={post.image_url} alt="" className="w-full max-h-60 object-cover bg-muted rounded-lg" />
                      </div>
                    )}
                    <p className="mt-3 text-foreground leading-relaxed text-sm">{post.content}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                  </CardContent>
                </Card>
              );
            }) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 font-medium text-foreground">No posts yet</p>
                  <Button className="mt-6" onClick={() => setShowPostForm(true)}><Plus className="mr-2 h-4 w-4" />Create First Post</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4">
            {showCourseForm && (
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Create Course / Webinar</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setShowCourseForm(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input placeholder="Course title" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea placeholder="Describe what students will learn..." value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} rows={4} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={courseType} onValueChange={setCourseType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="course">Course</SelectItem>
                          <SelectItem value="webinar">Webinar</SelectItem>
                          <SelectItem value="opportunity">Opportunity</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Price ($)</Label>
                      <Input type="number" min="0" placeholder="0 for free" value={coursePrice} onChange={(e) => setCoursePrice(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cover Image</Label>
                    <ImageUpload value={courseImage} onChange={setCourseImage} folder="courses" />
                  </div>
                  <CourseDetailedForm value={courseDetailedContent} onChange={setCourseDetailedContent} />
                  <Button onClick={handleCreateCourse} disabled={creatingCourse || !courseTitle.trim() || !courseDesc.trim()} className="w-full">
                    {creatingCourse ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Plus className="mr-2 h-4 w-4" />Create</>}
                  </Button>
                </CardContent>
              </Card>
            )}

            {courses.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((c) => (
                  <Card key={c.id} className="overflow-hidden">
                    {c.image_url && (
                      <div className="aspect-video overflow-hidden">
                        <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="secondary" className="text-xs mb-2">{c.type}</Badge>
                          <h4 className="font-semibold text-foreground text-sm">{c.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDeleteCourse(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 font-semibold text-foreground">{c.price > 0 ? `$${c.price}` : "Free"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 font-medium text-foreground">No courses yet</p>
                  <Button className="mt-6" onClick={() => setShowCourseForm(true)}><Plus className="mr-2 h-4 w-4" />Create First Course</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Subscribers Tab */}
          <TabsContent value="subscribers" className="space-y-4">
            <SubscribersListCard userId={user?.id || ""} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsSection userId={user?.id || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

function EarningsCard({ userId }: { userId: string }) {
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const calc = async () => {
      const [subsRes, profileRes] = await Promise.all([
        supabase.from("subscriptions").select("id").eq("expert_id", userId).eq("status", "active"),
        supabase.from("expert_profiles").select("subscription_price").eq("user_id", userId).maybeSingle(),
      ]);
      const price = profileRes.data?.subscription_price || 0;
      setMonthlyEarnings((subsRes.data?.length || 0) * price);
    };
    calc();
  }, [userId]);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4 md:p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <DollarSign className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">${monthlyEarnings.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Monthly Earnings</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSection({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState<any[]>([]);
  const [ratingBreakdown, setRatingBreakdown] = useState<{ stars: number; count: number }[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const fetchAnalytics = async () => {
      setLoading(true);

      // Fetch subscriptions, followers, ratings, and expert profile in parallel
      const postIdsRes = await supabase.from("posts").select("id").eq("expert_id", userId);
      const postIds = postIdsRes.data?.map((p: any) => p.id) || [];

      const [subsRes, followersRes, ratingsRes, profileRes] = await Promise.all([
        supabase.from("subscriptions").select("created_at, status").eq("expert_id", userId),
        supabase.from("expert_followers").select("created_at").eq("expert_id", userId),
        postIds.length > 0
          ? supabase.from("post_ratings").select("score").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
        supabase.from("expert_profiles").select("subscription_price").eq("user_id", userId).maybeSingle(),
      ]);

      const subs = subsRes.data || [];
      const followers = followersRes.data || [];
      const subPrice = profileRes.data?.subscription_price || 0;

      // Build growth + earnings by month (last 6 months)
      const now = new Date();
      const months: any[] = [];
      const earnings: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleString("default", { month: "short" });

        const subCount = subs.filter((s) => new Date(s.created_at) <= endOfMonth).length;
        const followerCount = followers.filter((f) => new Date(f.created_at) <= endOfMonth).length;
        // Monthly earnings = active subs at that point * subscription price
        const activeAtMonth = subs.filter(
          (s) => new Date(s.created_at) <= endOfMonth && s.status === "active"
        ).length;

        months.push({ month: label, subscribers: subCount, followers: followerCount });
        earnings.push({ month: label, earnings: activeAtMonth * subPrice });
      }
      setGrowthData(months);
      setEarningsData(earnings);
      setTotalEarnings(earnings.reduce((a: number, e: any) => a + e.earnings, 0));

      // Ratings breakdown
      const ratings = (ratingsRes.data as any[]) || [];
      const breakdown = [5, 4, 3, 2, 1].map((s) => ({
        stars: s,
        count: ratings.filter((r: any) => r.score === s).length,
      }));
      setRatingBreakdown(breakdown);
      setTotalRatings(ratings.length);
      setAvgRating(
        ratings.length > 0 ? ratings.reduce((a: number, r: any) => a + r.score, 0) / ratings.length : 0
      );

      setLoading(false);
    };
    fetchAnalytics();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const maxRatingCount = Math.max(...ratingBreakdown.map((r) => r.count), 1);

  return (
    <>
      {/* Monthly Earnings + Growth Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Monthly Earnings</CardTitle>
            </div>
            <CardDescription>Total: ${totalEarnings.toLocaleString()} over 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={earningsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v}`, "Earnings"]} />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Growth</CardTitle>
            </div>
            <CardDescription>Subscribers & followers over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="subscribers" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="subscribers" />
                <Line type="monotone" dataKey="followers" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 4 }} name="followers" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rating Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Rating Breakdown</CardTitle>
          </div>
          <CardDescription>{avgRating.toFixed(1)} average from {totalRatings} ratings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-8">
            {/* Big average */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <p className="text-5xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
              <div className="flex mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-5 w-5 ${s <= Math.round(avgRating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{totalRatings} ratings</p>
            </div>

            {/* Horizontal bars */}
            <div className="flex-1 space-y-2">
              {ratingBreakdown.map((r) => (
                <div key={r.stars} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-12 text-right">{r.stars} star</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full transition-all"
                      style={{ width: `${(r.count / maxRatingCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default ExpertDashboard;
