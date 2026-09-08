import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../utils/api";
const API = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";
import ReactMarkdown from "react-markdown";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";



export default function Community() {
  const auth = useAuth();
  const [threads, setThreads] = useState([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ content: "" });
  const [selectedThread, setSelectedThread] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState("");

  const fetchThreads = async () => {
    try {
      const res = await fetch(`${API}/community/threads`);
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) {
      console.error("Failed to fetch threads:", e);
      setError("Failed to load posts. Please try again.");
    }
  };

  useEffect(() => { fetchThreads(); }, []);

  const handleNewPost = async () => {
    if (!newPost.content.trim()) return;
    setError("");
    try {
      const res = await fetch(`${API}/community/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: auth.user?.email || "anonymous",
          author_name: auth.user?.handle || auth.user?.name || auth.user?.email?.split("@")[0] || "Anonymous",
          content: newPost.content.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setNewPost({ content: "" });
        setShowNewPost(false);
        fetchThreads();
      } else {
        setError(data.message || "Failed to post.");
      }
    } catch (e) {
      console.error("Post failed:", e);
      setError("Network error. Please try again.");
    }
  };

  const openThread = async (thread) => {
    setSelectedThread(thread);
    try {
      const res = await fetch(`${API}/community/comments?thread_uuid=${thread.thread_uuid}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) {
      setComments([]);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !selectedThread) return;
    try {
      await fetch(`${API}/community/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_uuid: selectedThread.thread_uuid,
          user_email: auth.user?.email || "anonymous",
          content: newComment.trim(),
        }),
      });
      setNewComment("");
      const res = await fetch(`${API}/community/comments?thread_uuid=${selectedThread.thread_uuid}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) {
      console.error("Comment failed:", e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#381D65]">Community</h1>
          <button onClick={() => setShowNewPost(!showNewPost)}
            className="bg-[#7A4BC8] text-white px-4 py-2 rounded-xl text-sm font-bold">
            {showNewPost ? "Close" : "+ New Post"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {showNewPost && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <textarea
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              placeholder="Share your commute experience... Markdown supported!"
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none font-mono"
            />
            <button
              onClick={handleNewPost}
              disabled={!newPost.content.trim()}
              className="ml-auto bg-[#7A4BC8] text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              Post
            </button>
          </div>
        )}

        {threads.length === 0 && !error && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <span className="text-4xl">💬</span>
            <p className="text-gray-400 text-sm mt-2">No posts yet. Be the first!</p>
          </div>
        )}

        {threads.map((thread) => (
          <div key={thread.thread_uuid || thread.id}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openThread(thread)}>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">
                  {thread.author_name || (thread.user_email || "anonymous").split("@")[0]}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {thread.created_at?.slice(0, 10)}
                </span>
              </div>
              <div className="text-sm text-gray-700 mt-2 line-clamp-4 prose prose-sm max-w-none">
                <ReactMarkdown>{thread.content}</ReactMarkdown>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                💬 {comments.length || 0} comments
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedThread(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">
                {selectedThread.author_name || (selectedThread.user_email || "anonymous").split("@")[0]}
              </span>
              <button onClick={() => setSelectedThread(null)} className="text-gray-400">✕</button>
            </div>
            <p className="text-xs text-gray-400 mt-1">{selectedThread.created_at?.slice(0, 10)}</p>
            <div className="mt-4 prose prose-sm max-w-none">
              <ReactMarkdown>{selectedThread.content}</ReactMarkdown>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 mb-3">{comments.length} Comments</p>
              {comments.map((comment) => (
                <div key={comment.id || comment.comment_uuid || Math.random()} className="mb-3 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700">
                    {(comment.user_email || "anonymous").split("@")[0]}
                  </p>
                  <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                    <ReactMarkdown>{comment.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none"
                />
                <button
                  onClick={postComment}
                  disabled={!newComment.trim()}
                  className="bg-[#7A4BC8] text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
