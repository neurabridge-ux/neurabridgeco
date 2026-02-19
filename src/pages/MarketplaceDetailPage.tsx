import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ImageLightbox from "@/components/ImageLightbox";
import CourseDetailedDisplay from "@/components/marketplace/CourseDetailedDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Star,
  Users,
  Clock,
  CheckCircle2,
  BookOpen,
  Video,
  Zap,
  Loader2,
} from "lucide-react";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  course: { label: "Course", icon: BookOpen, color: "text-primary" },
  webinar: { label: "Webinar", icon: Video, color: "text-info" },
  opportunity: { label: "Opportunity", icon: Zap, color: "text-accent" },
};

interface Review {
  id: string;
  score: number;
  comment: string | null;
  user_name: string | null;
  created_at: string;
}

const MarketplaceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [item, setItem] = useState<any>(null);
  const [expert, setExpert] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (id) fetchItem();
  }, [id]);

  const fetchItem = async () => {
    if (!id) return;
    setLoading(true);

    const { data: itemData } = await supabase
      .from("marketplace_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!itemData) {
      setLoading(false);
      return;
    }

    setItem(itemData);

    const [profileRes, expertRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", itemData.expert_id).maybeSingle(),
      supabase.from("expert_profiles").select("*").eq("user_id", itemData.expert_id).maybeSingle(),
      supabase.from("course_reviews").select("*").eq("item_id", id).order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) {
      setExpert({
        ...profileRes.data,
        credentials: expertRes.data?.credentials || null,
      });
    }

    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const userIds = [...new Set(reviewsRes.data.map((r) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);

      setReviews(
        reviewsRes.data.map((r) => ({
          id: r.id,
          score: r.score,
          comment: r.comment,
          user_name: profiles?.find((p) => p.id === r.user_id)?.full_name || null,
          created_at: r.created_at,
        }))
      );
    }

    setLoading(false);
  };

  const handlePurchase = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to enroll." });
      return;
    }
    setPurchasing(true);
    setTimeout(() => {
      setPurchasing(false);
      toast({
        title: "Purchase Successful!",
        description: `You've enrolled in "${item?.title}". Check your email for access details.`,
      });
    }, 1500);
  };

  const handleSubmitReview = async () => {
    if (!user || !id || reviewScore === 0) return;
    setSubmittingReview(true);

    const { error } = await supabase.from("course_reviews").insert({
      item_id: id,
      user_id: user.id,
      score: reviewScore,
      comment: reviewComment || null,
    });

    setSubmittingReview(false);
    if (error) {
      if (error.code === "23505") {
        toast({ variant: "destructive", title: "Already reviewed", description: "You've already reviewed this item." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    } else {
      toast({ title: "Review submitted!", description: "Thank you for your feedback." });
      setReviewScore(0);
      setReviewComment("");
      fetchItem();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Item not found</h1>
          <Button className="mt-6" asChild>
            <Link to="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const cfg = typeConfig[item.type] || typeConfig.course;
  const TypeIcon = cfg.icon;
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
    : null;

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {item.image_url && (
              <div className="rounded-xl overflow-hidden cursor-pointer" onClick={() => setLightboxOpen(true)}>
                <img src={item.image_url} alt={item.title} className="w-full aspect-video object-cover transition-opacity hover:opacity-90" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant="secondary" className="gap-1">
                  <TypeIcon className={`h-3 w-3 ${cfg.color}`} />
                  {cfg.label}
                </Badge>
                {avgRating !== null && (
                  <Badge variant="outline" className="gap-1">
                    <Star className="h-3 w-3 text-accent fill-accent" />
                    {avgRating.toFixed(1)} ({reviews.length} reviews)
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{item.title}</h1>
              <p className="mt-4 text-muted-foreground leading-relaxed">{item.description}</p>
            </div>

            <CourseDetailedDisplay detailedContent={item.detailed_content} />

            <Separator />

            {/* Reviews Section */}
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                Reviews ({reviews.length})
              </h2>

              {user && (
                <Card className="mb-6">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Leave a review</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setReviewScore(s)}>
                          <Star className={`h-6 w-6 cursor-pointer ${s <= reviewScore ? "text-accent fill-accent" : "text-muted-foreground/30"}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="Share your experience (optional)"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={2}
                    />
                    <Button size="sm" onClick={handleSubmitReview} disabled={submittingReview || reviewScore === 0}>
                      {submittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Submit Review
                    </Button>
                  </CardContent>
                </Card>
              )}

              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-4 w-4 ${s <= r.score ? "text-accent fill-accent" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-foreground">{r.user_name || "User"}</span>
                        </div>
                        {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card>
                <CardContent className="p-6">
                  {item.price > 0 ? (
                    <p className="font-display text-4xl font-bold text-foreground text-center">${item.price}</p>
                  ) : (
                    <Badge className="bg-success/10 text-success border-success/20 text-xl px-6 py-2 mx-auto block w-fit">Free</Badge>
                  )}
                  <Button className="w-full mt-6" size="lg" onClick={handlePurchase} disabled={purchasing}>
                    {purchasing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                    ) : item.price > 0 ? (
                      `Enroll for $${item.price}`
                    ) : (
                      "Enroll for Free"
                    )}
                  </Button>
                  <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Lifetime access</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Certificate of completion</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />30-day money-back guarantee</li>
                    <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Self-paced learning</li>
                  </ul>
                  <p className="mt-4 text-xs text-center text-muted-foreground">Educational content only. Not financial advice.</p>
                </CardContent>
              </Card>

              {expert && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-foreground text-sm mb-4">Your Instructor</h3>
                    <Link to={`/expert/${expert.id}`} className="flex items-center gap-3 group">
                      <Avatar className="h-12 w-12 border-2 border-border">
                        <AvatarImage src={expert.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">{(expert.full_name || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{expert.full_name || "Expert"}</p>
                        <p className="text-xs text-muted-foreground">{expert.credentials || ""}</p>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      <ImageLightbox src={item.image_url || ""} alt={item.title} open={lightboxOpen} onOpenChange={setLightboxOpen} />
    </Layout>
  );
};

export default MarketplaceDetailPage;
