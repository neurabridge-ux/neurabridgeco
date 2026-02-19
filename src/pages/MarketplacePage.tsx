import { useState, useEffect, useMemo } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { Link } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Star,
  Users,
  BookOpen,
  Video,
  Zap,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  course: { label: "Course", icon: BookOpen, color: "text-primary" },
  webinar: { label: "Webinar", icon: Video, color: "text-info" },
  opportunity: { label: "Opportunity", icon: Zap, color: "text-accent" },
};

interface MarketplaceItem {
  id: string;
  expert_id: string;
  title: string;
  description: string;
  type: string;
  image_url: string | null;
  price: number;
  expert_name: string | null;
  expert_avatar: string | null;
  review_count: number;
  avg_rating: number | null;
}

const MarketplacePage = () => {
  usePageSEO({
    title: "Marketplace — Courses, Webinars & Opportunities",
    description: "Browse educational courses, webinars, and exclusive investment opportunities from top market experts on NeuraBridge.",
    canonical: "/marketplace",
  });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("marketplace_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const expertIds = [...new Set(data.map((i: any) => i.expert_id))];
    const itemIds = data.map((i: any) => i.id);

    const [profilesRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", expertIds),
      supabase.from("course_reviews").select("item_id, score").in("item_id", itemIds),
    ]);

    const reviewMap: Record<string, { count: number; total: number }> = {};
    reviewsRes.data?.forEach((r) => {
      if (!reviewMap[r.item_id]) reviewMap[r.item_id] = { count: 0, total: 0 };
      reviewMap[r.item_id].count++;
      reviewMap[r.item_id].total += r.score;
    });

    const enriched: MarketplaceItem[] = data.map((i: any) => {
      const profile = profilesRes.data?.find((p) => p.id === i.expert_id);
      const review = reviewMap[i.id];
      return {
        id: i.id,
        expert_id: i.expert_id,
        title: i.title,
        description: i.description,
        type: i.type,
        image_url: i.image_url,
        price: i.price,
        expert_name: profile?.full_name || null,
        expert_avatar: profile?.avatar_url || null,
        review_count: review?.count || 0,
        avg_rating: review ? review.total / review.count : null,
      };
    });

    setItems(enriched);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || item.type === typeFilter;
      const matchPrice =
        priceFilter === "all" ||
        (priceFilter === "free" && item.price === 0) ||
        (priceFilter === "paid" && item.price > 0);
      return matchSearch && matchType && matchPrice;
    });
  }, [items, search, typeFilter, priceFilter]);

  const hasFilters = search || typeFilter !== "all" || priceFilter !== "all";

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
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Marketplace</h1>
          <p className="mt-2 text-muted-foreground">Courses, webinars, and exclusive opportunities from top experts</p>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search courses, webinars..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="course">Courses</SelectItem>
              <SelectItem value="webinar">Webinars</SelectItem>
              <SelectItem value="opportunity">Opportunities</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="All Prices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter("all"); setPriceFilter("all"); }}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        <p className="mb-4 text-sm text-muted-foreground">{filtered.length} item{filtered.length !== 1 && "s"} found</p>

        {filtered.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const cfg = typeConfig[item.type] || typeConfig.course;
              const TypeIcon = cfg.icon;
              return (
                <Card key={item.id} className="group overflow-hidden transition-all duration-300 hover:shadow-large hover:-translate-y-1 flex flex-col">
                  {item.image_url && (
                    <div className="relative aspect-video overflow-hidden cursor-pointer" onClick={(e) => { e.preventDefault(); setLightboxSrc(item.image_url); }}>
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105 hover:opacity-90" loading="lazy" />
                      <Badge className="absolute top-3 left-3 gap-1" variant="secondary">
                        <TypeIcon className={`h-3 w-3 ${cfg.color}`} />
                        {cfg.label}
                      </Badge>
                      {item.price === 0 && (
                        <Badge className="absolute top-3 right-3 bg-success/90 text-success-foreground">Free</Badge>
                      )}
                    </div>
                  )}
                  <CardContent className="flex flex-1 flex-col p-5">
                    <h3 className="font-display font-semibold text-foreground line-clamp-2">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2 flex-1">{item.description}</p>
                    {item.expert_name && (
                      <Link to={`/expert/${item.expert_id}`} className="mt-4 flex items-center gap-2 group/expert">
                        <Avatar className="h-6 w-6 border border-border">
                          <AvatarImage src={item.expert_avatar || undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{item.expert_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground group-hover/expert:text-primary transition-colors">{item.expert_name}</span>
                      </Link>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      {item.avg_rating !== null && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-accent fill-accent" />
                          {item.avg_rating.toFixed(1)} ({item.review_count})
                        </span>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      {item.price > 0 ? (
                        <p className="font-display font-semibold text-foreground">${item.price}</p>
                      ) : (
                        <Badge className="bg-success/10 text-success border-success/20">Free</Badge>
                      )}
                      <Button variant="ghost" size="sm" className="text-primary" asChild>
                        <Link to={`/marketplace/${item.id}`}>
                          View Details <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-lg font-medium text-foreground">No items found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0 ? "No marketplace items have been added yet" : "Try adjusting your search or filters"}
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">Educational content only. Not financial advice.</p>
      </div>
      <ImageLightbox src={lightboxSrc || ""} open={!!lightboxSrc} onOpenChange={(open) => { if (!open) setLightboxSrc(null); }} />
    </Layout>
  );
};

export default MarketplacePage;
