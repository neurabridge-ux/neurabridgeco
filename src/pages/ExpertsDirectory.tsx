import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Search, LayoutGrid, List, X, ArrowRight, Users, Star, Loader2 } from "lucide-react";

const MARKET_OPTIONS = [
  { value: "stocks", label: "Stocks", icon: "📈" },
  { value: "crypto", label: "Crypto", icon: "₿" },
  { value: "forex", label: "Forex", icon: "💱" },
  { value: "bonds", label: "Bonds", icon: "📊" },
  { value: "commodities", label: "Commodities", icon: "🛢️" },
];

interface ExpertListItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  credentials: string | null;
  headline: string | null;
  markets: string[] | null;
  subscription_price: number | null;
  subscriber_count: number;
  post_count: number;
}

const ExpertsDirectory = () => {
  usePageSEO({
    title: "Expert Directory — Browse Market Analysts",
    description: "Browse and discover verified market experts in stocks, crypto, forex, bonds, and commodities. Find the right analyst to subscribe to on NeuraBridge.",
    canonical: "/experts",
  });
  const [experts, setExperts] = useState<ExpertListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    fetchExperts();
  }, []);

  const fetchExperts = async () => {
    setLoading(true);

    const { data: expertProfiles } = await supabase
      .from("expert_profiles")
      .select("user_id, credentials, headline, markets, subscription_price");

    if (!expertProfiles || expertProfiles.length === 0) {
      setExperts([]);
      setLoading(false);
      return;
    }

    const userIds = expertProfiles.map((e) => e.user_id);

    const [profilesRes, subsRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      supabase.from("subscriptions").select("expert_id").eq("status", "active").in("expert_id", userIds),
      supabase.from("posts").select("expert_id").in("expert_id", userIds),
    ]);

    // Count subscribers and posts per expert
    const subCounts: Record<string, number> = {};
    subsRes.data?.forEach((s) => {
      subCounts[s.expert_id] = (subCounts[s.expert_id] || 0) + 1;
    });
    const postCounts: Record<string, number> = {};
    postsRes.data?.forEach((p) => {
      postCounts[p.expert_id] = (postCounts[p.expert_id] || 0) + 1;
    });

    const list: ExpertListItem[] = expertProfiles.map((ep) => {
      const profile = profilesRes.data?.find((p) => p.id === ep.user_id);
      return {
        id: ep.user_id,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        credentials: ep.credentials,
        headline: ep.headline,
        markets: ep.markets,
        subscription_price: ep.subscription_price,
        subscriber_count: subCounts[ep.user_id] || 0,
        post_count: postCounts[ep.user_id] || 0,
      };
    });

    setExperts(list);
    setLoading(false);
  };

  const filteredExperts = useMemo(() => {
    return experts.filter((expert) => {
      const matchesSearch =
        !searchQuery ||
        (expert.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (expert.credentials || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMarket =
        selectedMarket === "all" || (expert.markets || []).includes(selectedMarket);
      const matchesPrice =
        priceFilter === "all" ||
        (priceFilter === "free" && (!expert.subscription_price || expert.subscription_price === 0)) ||
        (priceFilter === "paid" && expert.subscription_price && expert.subscription_price > 0);
      return matchesSearch && matchesMarket && matchesPrice;
    });
  }, [experts, searchQuery, selectedMarket, priceFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMarket("all");
    setPriceFilter("all");
  };

  const hasActiveFilters = searchQuery || selectedMarket !== "all" || priceFilter !== "all";

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
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Expert Directory</h1>
          <p className="mt-2 text-muted-foreground">Discover and connect with market experts across all asset classes</p>
        </div>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search experts or markets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Markets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                {MARKET_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Prices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="mr-1 h-4 w-4" />Clear filters
              </Button>
            )}
            <div className="flex rounded-lg border border-border p-1">
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-8 w-8 p-0">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {filteredExperts.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{filteredExperts.length} expert{filteredExperts.length !== 1 && "s"} found</p>
            <div className={viewMode === "grid" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-4"}>
              {filteredExperts.map((expert) => {
                const marketNames = (expert.markets || [])
                  .map((m) => MARKET_OPTIONS.find((opt) => opt.value === m))
                  .filter(Boolean);

                if (viewMode === "list") {
                  return (
                    <Card key={expert.id} className="group overflow-hidden transition-all duration-300 hover:shadow-large hover:-translate-y-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 border-2 border-border">
                            <AvatarImage src={expert.avatar_url || undefined} alt={expert.full_name || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {(expert.full_name || "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display font-semibold text-foreground truncate">{expert.full_name || "Expert"}</h4>
                            <p className="text-xs text-muted-foreground truncate">{expert.credentials || ""}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="text-primary" asChild>
                            <Link to={`/expert/${expert.id}`}>
                              View <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {marketNames.map((market) => (
                            <Badge key={market?.value} variant="secondary" className="text-xs px-2 py-0.5">{market?.label}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card key={expert.id} className="group overflow-hidden transition-all duration-300 hover:shadow-large hover:-translate-y-1 h-full flex flex-col border-border/60">
                    <CardContent className="p-0 flex flex-col flex-1">
                      {/* Large cover image area */}
                      <div className="relative h-44 overflow-hidden bg-muted">
                        {expert.avatar_url ? (
                          <img
                            src={expert.avatar_url}
                            alt={expert.full_name || ""}
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                            onClick={(e) => { e.preventDefault(); setLightboxSrc(expert.avatar_url); }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10">
                            <span className="text-6xl font-bold text-primary/30">
                              {(expert.full_name || "?").charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <h4 className="font-display font-bold text-base text-foreground">{expert.full_name || "Expert"}</h4>
                        {expert.credentials && (
                          <p className="text-xs text-muted-foreground mt-0.5">{expert.credentials}</p>
                        )}

                        {/* Markets */}
                        {marketNames.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {marketNames.map((market) => (
                              <Badge key={market?.value} variant="secondary" className="text-xs px-2 py-0.5">{market?.icon} {market?.label}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Headline */}
                        {expert.headline && (
                          <p className="mt-2 text-sm text-muted-foreground italic line-clamp-2 flex-1">"{expert.headline}"</p>
                        )}

                        {/* Stats */}
                        <div className="mt-auto pt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            <span>{expert.subscriber_count}</span>
                          </div>
                          <span className="text-border">|</span>
                          <span>{expert.post_count} insights</span>
                        </div>

                        {/* Price + View Expert */}
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          <div>
                            {expert.subscription_price && expert.subscription_price > 0 ? (
                              <p className="font-display font-bold text-primary text-lg">
                                ${expert.subscription_price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                              </p>
                            ) : (
                              <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 px-3 py-1">Free</Badge>
                            )}
                          </div>
                          <Button variant="default" size="sm" asChild>
                            <Link to={`/expert/${expert.id}`}>
                              View Expert <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-lg font-medium text-foreground">No experts found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {experts.length === 0 ? "No experts have signed up yet" : "Try adjusting your search or filters"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear all filters</Button>
            )}
          </div>
        )}
      </div>
      <ImageLightbox
        src={lightboxSrc || ""}
        open={!!lightboxSrc}
        onOpenChange={(open) => { if (!open) setLightboxSrc(null); }}
      />
    </Layout>
  );
};

export default ExpertsDirectory;
