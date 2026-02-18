import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageSquare, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  user_name: string | null;
  user_avatar: string | null;
  replies: Comment[];
}

interface PostEngagementProps {
  postId: string;
  expertId: string;
  rightAction?: React.ReactNode;
}

const PostEngagement = ({ postId, expertId, rightAction }: PostEngagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEngagement();
  }, [postId, user]);

  const fetchEngagement = async () => {
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from("post_likes").select("id, user_id").eq("post_id", postId),
      supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
    ]);

    const likes = likesRes.data || [];
    setLikeCount(likes.length);
    if (user) setLiked(likes.some((l) => l.user_id === user.id));

    const rawComments = commentsRes.data || [];
    setCommentCount(rawComments.length);

    if (rawComments.length > 0) {
      const userIds = [...new Set(rawComments.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);

      const enriched = rawComments.map((c) => {
        const p = profiles?.find((pr) => pr.id === c.user_id);
        return {
          ...c,
          user_name: p?.full_name || null,
          user_avatar: p?.avatar_url || null,
          replies: [] as Comment[],
        };
      });

      // Build tree
      const topLevel: Comment[] = [];
      const map: Record<string, Comment> = {};
      enriched.forEach((c) => { map[c.id] = c; });
      enriched.forEach((c) => {
        if (c.parent_id && map[c.parent_id]) {
          map[c.parent_id].replies.push(c);
        } else {
          topLevel.push(c);
        }
      });
      setComments(topLevel);
    }
  };

  const requireAuth = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to engage with posts." });
      navigate("/auth");
      return false;
    }
    return true;
  };

  const handleLike = async () => {
    if (!requireAuth()) return;
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user!.id);
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user!.id });
      setLiked(true);
      setLikeCount((c) => c + 1);
      // Notify expert
      if (expertId !== user!.id) {
        await supabase.from("notifications").insert({
          user_id: expertId,
          type: "like",
          title: "Post Liked",
          description: "Someone liked your insight",
        });
      }
    }
  };

  const handleComment = async () => {
    if (!requireAuth() || !newComment.trim()) return;
    setSubmitting(true);
    await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user!.id,
      content: newComment.trim(),
    });
    setNewComment("");
    setSubmitting(false);
    if (expertId !== user!.id) {
      await supabase.from("notifications").insert({
        user_id: expertId,
        type: "comment",
        title: "New Comment",
        description: "Someone commented on your insight",
      });
    }
    fetchEngagement();
  };

  const handleReply = async (parentId: string, parentUserId: string) => {
    if (!requireAuth() || !replyContent.trim()) return;
    setSubmitting(true);
    await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user!.id,
      parent_id: parentId,
      content: replyContent.trim(),
    });
    setReplyContent("");
    setReplyTo(null);
    setSubmitting(false);
    if (parentUserId !== user!.id) {
      await supabase.from("notifications").insert({
        user_id: parentUserId,
        type: "reply",
        title: "New Reply",
        description: "Someone replied to your comment",
      });
    }
    fetchEngagement();
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? "ml-8 mt-2" : "mt-3"}`}>
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 border border-border">
          <AvatarImage src={comment.user_avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
            {(comment.user_name || "?").charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-xs font-medium text-foreground">{comment.user_name || "User"}</p>
            <p className="text-sm text-foreground mt-0.5">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {user && (
              <button
                className="text-[10px] font-medium text-muted-foreground hover:text-primary"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              >
                Reply
              </button>
            )}
          </div>
          {replyTo === comment.id && (
            <div className="flex gap-2 mt-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={1}
                className="text-sm min-h-[36px]"
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => handleReply(comment.id, comment.user_id)} disabled={submitting}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
          {comment.replies.map((r) => renderComment(r, true))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="border-t border-border pt-3 mt-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
            onClick={handleLike}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageSquare className="h-4 w-4" />
            {commentCount > 0 && <span>{commentCount}</span>}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>

      {showComments && (
        <div className="mt-3">
          {user && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={1}
                className="text-sm min-h-[36px]"
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleComment} disabled={submitting || !newComment.trim()}>
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </Button>
            </div>
          )}
          {comments.length > 0 ? (
            comments.map((c) => renderComment(c))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PostEngagement;
