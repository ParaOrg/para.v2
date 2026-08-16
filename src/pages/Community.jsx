import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../utils/api";
import ReactMarkdown from "react-markdown";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";

const API = getApiBaseUrl();
const TAGS = ["All", "Routes", "Tips", "Review", "News", "Questions"];

export default function Community() {
  const auth = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeTag, setActiveTag] = useState("All");
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", tag: "Routes", image: "" });
  const [selectedThread, setSelectedThread] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [sortBy, setSortBy] = useState("new");

  const fetchThreads = () => {
    fetch(`${API}/community/threads`)
      .then(r => r.json())
      .then(d => setThreads(d.threads || []))
      .catch(() => {});
  };

  useEffect(() => { fetchThreads(); }, []);

  const filtered = activeTag === "All" ? threads : threads.filter(t => t.tag === activeTag);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "new") return (b.created_at || "").localeCompare(a.created_at || "");
    if (sortBy === "top") return (b.upvotes || 0) - (a.upvotes || 0);
    return 0;
  });

  const handleNewPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    try {
      const res = await fetch(`${API}/community/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: auth.user?.email || "anonymous",
          author_name: auth.user?.handle || JSON.parse(localStorage.getItem("para_auth_user_v1") || "{}").handle || "Anonymous",
          title: newPost.title,
          content: newPost.content,
          tag: newPost.tag,
          image: newPost.image,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        fetchThreads();
        setNewPost({ title: "", content: "", tag: "Routes", image: "" });
        setShowNewPost(false);
      }
    } catch (e) { console.error(e); }
  };

  const deleteThread = async (threadUuid) => {
    try {
      await fetch(`${API}/community/threads/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_uuid: threadUuid }),
      });
      fetchThreads();
      setSelectedThread(null);
    } catch (e) { console.error(e); }
  };

  const openThread = (thread) => {
    setSelectedThread(thread);
    fetch(`${API}/community/comments?thread_uuid=${thread.thread_uuid}`)
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => setComments([]));
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
      const d = await res.json();
      setComments(d.comments || []);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#381D65]">Community</h1>
          <div className="flex gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none bg-white">
              <option value="new">New</option>
              <option value="top">Top</option>
            </select>
            <button onClick={() => setShowNewPost(!showNewPost)}
              className="bg-[#7A4BC8] text-white px-4 py-2 rounded-xl text-sm font-bold">
              {showNewPost ? "Close" : "+ New Post"}
            </button>
          </div>
        </div>

        {/* New Post Form */}
        {showNewPost && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <input value={newPost.title} onChange={(e) => setNewPost({...newPost, title: e.target.value})}
              placeholder="Post title..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
            <textarea value={newPost.content} onChange={(e) => setNewPost({...newPost, content: e.target.value})}
              placeholder="Share your commute experience... Markdown supported!"
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none font-mono" />
            <input value={newPost.image} onChange={(e) => setNewPost({...newPost, image: e.target.value})}
              placeholder="Image URL (optional)..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
            <div className="flex items-center gap-2">
              <select value={newPost.tag} onChange={(e) => setNewPost({...newPost, tag: e.target.value})}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
                {TAGS.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={handleNewPost}
                className="ml-auto bg-[#7A4BC8] text-white px-4 py-1.5 rounded-lg text-xs font-bold">
                Post
              </button>
            </div>
          </div>
        )}

        {/* Tag filters */}
        <div className="flex gap-2 flex-wrap">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${activeTag === tag ? "bg-[#7A4BC8] text-white" : "bg-white text-gray-500 border border-gray-200"}`}>
              {tag}
            </button>
          ))}
        </div>

        {/* Threads */}
        {sorted.map((thread) => (
          <div key={thread.thread_uuid}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
            <div className="p-4" onClick={() => openThread(thread)}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#7A4BC8]">{thread.tag || "General"}</span>
                <span className="text-xs text-gray-400 ml-auto">{thread.author_name || "Anonymous"}</span>
              </div>
              <h2 className="font-bold text-gray-900 mt-1">{thread.title}</h2>
              <div className="text-sm text-gray-500 mt-1 line-clamp-3">
                <ReactMarkdown>{thread.content}</ReactMarkdown>
              </div>
              {thread.image && (
                <img src={thread.image} alt="" className="mt-2 rounded-xl w-full max-h-48 object-cover"
                  onError={(e) => e.target.style.display = "none"} />
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span>👍 {thread.upvotes || 0}</span>
                <span>💬 {comments.length || 0}</span>
                <span>{thread.created_at?.slice(0, 10)}</span>
                <button className="ml-auto text-[#7A4BC8] font-medium">Read more →</button>
              </div>
            </div>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <span className="text-4xl">💬</span>
            <p className="text-gray-400 text-sm mt-2">No posts yet. Be the first!</p>
          </div>
        )}
      </div>

      {/* Thread Modal */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedThread(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7A4BC8]">{selectedThread.tag || "General"}</span>
              <div className="flex gap-2">
                <button onClick={() => deleteThread(selectedThread.thread_uuid)}
                  className="text-red-400 text-xs font-medium">Delete</button>
                <button onClick={() => setSelectedThread(null)} className="text-gray-400">✕</button>
              </div>
            </div>
            <h2 className="text-xl font-black text-gray-900 mt-1">{selectedThread.title}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Posted by {selectedThread.author_name || "Anonymous"} • {selectedThread.created_at?.slice(0, 10)}
            </p>
            <div className="mt-4 prose prose-sm max-w-none">
              <ReactMarkdown>{selectedThread.content}</ReactMarkdown>
            </div>
            {selectedThread.image && (
              <img src={selectedThread.image} alt="" className="mt-3 rounded-xl w-full"
                onError={(e) => e.target.style.display = "none"} />
            )}

            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 mb-3">{comments.length} Comments</p>
              {comments.map((comment) => (
                <div key={comment.comment_uuid} className="mb-3 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700">{comment.author_name || "Anonymous"}</p>
                  <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                    <ReactMarkdown>{comment.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment... Markdown supported"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
                <button onClick={postComment}
                  className="bg-[#7A4BC8] text-white px-4 py-2 rounded-lg text-xs font-bold">
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
